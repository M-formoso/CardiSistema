import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type {
  ActualizarJornalCategoriaDto,
  CreateCategoriaEmpleadoDto,
  FiltrosCategoriaEmpleadoDto,
  UpdateCategoriaEmpleadoDto,
} from './dto/categorias-empleados.dto';

/**
 * Categorías laborales (Oficial Capataz, Oficial, 1/2 Oficial, Ayudante, etc.).
 * Cada categoría tiene jornal y valor hora extra "de referencia". Al
 * actualizar el jornal, se puede propagar a todos los empleados activos de
 * la categoría (ver `actualizarJornal`) en una sola operación, registrando
 * cambios en el historial de la categoría y de cada empleado afectado.
 */
@Injectable()
export class CategoriasEmpleadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
  ) {}

  findAll(filtros: FiltrosCategoriaEmpleadoDto) {
    const where: Prisma.CategoriaEmpleadoWhereInput = {};
    if (filtros.activo !== undefined) where.activo = filtros.activo;
    return this.prisma.categoriaEmpleado.findMany({
      where,
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: { _count: { select: { empleados: true } } },
    });
  }

  async findOne(id: string) {
    const cat = await this.prisma.categoriaEmpleado.findUnique({
      where: { id },
      include: {
        _count: { select: { empleados: true } },
        historial: { orderBy: { vigenteDesde: 'desc' }, take: 50 },
      },
    });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    return cat;
  }

  async create(dto: CreateCategoriaEmpleadoDto, userId: string) {
    try {
      const creada = await this.prisma.categoriaEmpleado.create({
        data: {
          codigo: dto.codigo.trim().toUpperCase(),
          nombre: dto.nombre.trim(),
          jornal: dto.jornal != null ? new Prisma.Decimal(dto.jornal) : null,
          valorHoraExtra: dto.valorHoraExtra != null ? new Prisma.Decimal(dto.valorHoraExtra) : null,
          orden: dto.orden ?? 0,
          activo: true,
          createdById: userId,
          updatedById: userId,
        },
      });
      void this.audit.registrar({
        usuarioId: userId,
        accion: 'CREAR',
        entidad: 'CategoriaEmpleado',
        entidadId: creada.id,
        despues: creada as unknown,
      });
      return creada;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Código "${dto.codigo}" ya existe`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateCategoriaEmpleadoDto, userId: string) {
    const antes = await this.prisma.categoriaEmpleado.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Categoría no encontrada');
    try {
      const despues = await this.prisma.categoriaEmpleado.update({
        where: { id },
        data: {
          codigo: dto.codigo?.trim().toUpperCase(),
          nombre: dto.nombre?.trim(),
          orden: dto.orden,
          activo: dto.activo,
          updatedById: userId,
        },
      });
      void this.audit.registrar({
        usuarioId: userId,
        accion: 'ACTUALIZAR',
        entidad: 'CategoriaEmpleado',
        entidadId: id,
        antes: antes as unknown,
        despues: despues as unknown,
      });
      return despues;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Código "${dto.codigo}" ya existe`);
      }
      throw err;
    }
  }

  /**
   * Actualiza jornal y/o hora extra de la categoría y propaga a los empleados:
   * - Crea un registro en `CategoriaEmpleadoHistorico` con `empleadosAfectados`.
   * - Para cada empleado activo de la categoría:
   *     - Si `propagarATodos=true`: actualiza su jornal al nuevo valor.
   *     - Si `propagarATodos=false`: solo actualiza a los que tenían exactamente
   *       el valor anterior de la categoría (los que tenían valor propio quedan).
   * - Crea una entrada en `EmpleadoJornalHistorico` por cada empleado modificado.
   * Todo en una sola transacción.
   */
  async actualizarJornal(id: string, dto: ActualizarJornalCategoriaDto, userId: string) {
    const cat = await this.prisma.categoriaEmpleado.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');

    const jornalNuevo = new Prisma.Decimal(dto.jornal.toFixed(2));
    const horaExtraNueva =
      dto.valorHoraExtra != null ? new Prisma.Decimal(dto.valorHoraExtra.toFixed(2)) : null;
    const vigenteDesde = dto.vigenteDesde ?? new Date();

    const jornalAnteriorCat = cat.jornal ? new Prisma.Decimal(cat.jornal) : null;

    const result = await this.prisma.$transaction(async (tx) => {
      // Empleados activos de la categoría
      const legajos = await tx.empleadoLegajo.findMany({
        where: { categoriaId: id, beneficiario: { activo: true } },
        select: { id: true, jornal: true, valorHoraExtra: true },
      });

      const legajosAActualizar = dto.propagarATodos
        ? legajos
        : legajos.filter((l) => {
            if (!jornalAnteriorCat) return l.jornal == null;
            if (l.jornal == null) return true;
            return new Prisma.Decimal(l.jornal).eq(jornalAnteriorCat);
          });

      // Actualizar la categoría
      await tx.categoriaEmpleado.update({
        where: { id },
        data: {
          jornal: jornalNuevo,
          valorHoraExtra: horaExtraNueva ?? undefined,
          updatedById: userId,
        },
      });

      // Historial de la categoría
      await tx.categoriaEmpleadoHistorico.create({
        data: {
          categoriaId: id,
          jornal: jornalNuevo,
          valorHoraExtra: horaExtraNueva,
          vigenteDesde,
          motivo: dto.motivo,
          empleadosAfectados: legajosAActualizar.length,
          createdById: userId,
        },
      });

      // Propagar a los empleados afectados
      for (const legajo of legajosAActualizar) {
        await tx.empleadoLegajo.update({
          where: { id: legajo.id },
          data: {
            jornal: jornalNuevo,
            valorHoraExtra: horaExtraNueva ?? undefined,
          },
        });
        await tx.empleadoJornalHistorico.create({
          data: {
            legajoId: legajo.id,
            jornal: jornalNuevo,
            valorHoraExtra: horaExtraNueva,
            vigenteDesde,
            motivo: `Actualización masiva categoría "${cat.nombre}"${dto.motivo ? ` — ${dto.motivo}` : ''}`,
            createdById: userId,
          },
        });
      }

      return { empleadosAfectados: legajosAActualizar.length, total: legajos.length };
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'CategoriaEmpleado',
      entidadId: id,
      observacion: `Jornal ${cat.jornal ?? 0} → ${jornalNuevo.toFixed(2)} · ${result.empleadosAfectados}/${result.total} empleados`,
    });
    return result;
  }

  async desactivar(id: string, userId: string) {
    const cat = await this.prisma.categoriaEmpleado.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    if (!cat.activo) return cat;
    return this.prisma.categoriaEmpleado.update({
      where: { id },
      data: { activo: false, updatedById: userId },
    });
  }
}
