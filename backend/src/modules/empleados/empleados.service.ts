import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoBeneficiario } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { keyPermiso, PERMISOS_POR_ROL } from '../auth/permisos/roles';
import type {
  ActualizarJornalDto,
  CreateEmpleadoDto,
  FiltrosEmpleadoDto,
  UpdateEmpleadoDto,
} from './dto/empleados.dto';
import { cargarEmpleadosIniciales } from './empleados-seed';

/**
 * Empleados: ABM sobre Beneficiario(EMPLEADO) + EmpleadoLegajo.
 * El jornal se cambia en un endpoint aparte que mantiene historial.
 * La vista de detalle incluye liquidaciones y préstamos.
 */
@Injectable()
export class EmpleadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
  ) {}

  findAll(filtros: FiltrosEmpleadoDto, user: AuthenticatedUser) {
    const where: Prisma.BeneficiarioWhereInput = {
      tipo: TipoBeneficiario.EMPLEADO,
    };
    if (filtros.activo !== undefined) where.activo = filtros.activo;
    if (filtros.q) {
      where.OR = [
        { nombre: { contains: filtros.q, mode: 'insensitive' } },
        { cuitCuil: { contains: filtros.q } },
      ];
    }
    const legajoFilter: Prisma.EmpleadoLegajoWhereInput = {};
    if (filtros.empresaId) legajoFilter.empresaId = filtros.empresaId;
    if (filtros.categoriaId) legajoFilter.categoriaId = filtros.categoriaId;
    if (filtros.obraId) legajoFilter.obraActualId = filtros.obraId;
    if (filtros.situacionFiscal) legajoFilter.situacionFiscal = filtros.situacionFiscal;
    if (Object.keys(legajoFilter).length > 0) {
      where.legajo = legajoFilter;
    }

    const puedeVer = this.puedeVerSensibles(user);
    return this.prisma.beneficiario.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: {
        legajo: puedeVer
          ? {
              include: {
                empresa: { select: { id: true, nombre: true } },
                categoria: { select: { id: true, codigo: true, nombre: true } },
              },
            }
          : { select: { situacionFiscal: true, empresaId: true, categoriaId: true, obraActualId: true } },
      },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const puedeVer = this.puedeVerSensibles(user);
    const emp = await this.prisma.beneficiario.findUnique({
      where: { id },
      include: {
        legajo: puedeVer
          ? {
              include: {
                empresa: { select: { id: true, nombre: true } },
                categoria: { select: { id: true, codigo: true, nombre: true, jornal: true } },
                historialJornales: {
                  orderBy: { vigenteDesde: 'desc' },
                },
              },
            }
          : { select: { situacionFiscal: true, empresaId: true, categoriaId: true, obraActualId: true } },
        aliases: true,
      },
    });
    if (!emp || emp.tipo !== TipoBeneficiario.EMPLEADO) {
      throw new NotFoundException('Empleado no encontrado');
    }
    return emp;
  }

  async liquidacionesDe(id: string) {
    await this.prisma.beneficiario.findUniqueOrThrow({ where: { id } });
    return this.prisma.liquidacionItem.findMany({
      where: { beneficiarioId: id },
      include: {
        liquidacion: {
          select: {
            id: true,
            semanaInicio: true,
            semanaFin: true,
            estado: true,
            obra: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async prestamosDe(id: string) {
    await this.prisma.beneficiario.findUniqueOrThrow({ where: { id } });
    return this.prisma.prestamoEmpleado.findMany({
      where: { beneficiarioId: id },
      orderBy: [{ estado: 'asc' }, { fecha: 'desc' }],
    });
  }

  async create(dto: CreateEmpleadoDto, userId: string) {
    const hoy = new Date();

    // Si se asigna una categoría y no viene jornal propio, se hereda.
    let jornalDecimal = dto.jornal != null ? new Prisma.Decimal(dto.jornal.toFixed(2)) : null;
    let valorHoraExtraDecimal =
      dto.valorHoraExtra != null ? new Prisma.Decimal(dto.valorHoraExtra.toFixed(2)) : null;
    let jornalMotivo = 'Jornal inicial';

    if (dto.categoriaId && (jornalDecimal == null || valorHoraExtraDecimal == null)) {
      const cat = await this.prisma.categoriaEmpleado.findUnique({
        where: { id: dto.categoriaId },
      });
      if (!cat) throw new NotFoundException('Categoría no encontrada');
      if (jornalDecimal == null && cat.jornal) {
        jornalDecimal = new Prisma.Decimal(cat.jornal);
        jornalMotivo = `Heredado de categoría "${cat.nombre}"`;
      }
      if (valorHoraExtraDecimal == null && cat.valorHoraExtra) {
        valorHoraExtraDecimal = new Prisma.Decimal(cat.valorHoraExtra);
      }
    }

    const creado = await this.prisma.$transaction(async (tx) => {
      const beneficiario = await tx.beneficiario.create({
        data: {
          tipo: TipoBeneficiario.EMPLEADO,
          nombre: dto.nombre.trim(),
          cuitCuil: dto.cuitCuil?.trim() || null,
          contacto: dto.contacto?.trim() || null,
          observaciones: dto.observaciones?.trim() || null,
          createdById: userId,
          updatedById: userId,
          legajo: {
            create: {
              fechaIngreso: dto.fechaIngreso,
              dni: dto.dni?.trim() || null,
              empresaId: dto.empresaId ?? null,
              categoriaId: dto.categoriaId ?? null,
              situacionFiscal: dto.situacionFiscal,
              jornal: jornalDecimal,
              valorHoraExtra: valorHoraExtraDecimal,
              obraActualId: dto.obraActualId ?? null,
            },
          },
          aliases: dto.aliases?.length
            ? { createMany: { data: dto.aliases.map((alias) => ({ alias })) } }
            : undefined,
        },
        include: { legajo: true },
      });

      // Si tiene jornal, dejo la primera entrada en el historial
      if (jornalDecimal && beneficiario.legajo) {
        await tx.empleadoJornalHistorico.create({
          data: {
            legajoId: beneficiario.legajo.id,
            jornal: jornalDecimal,
            valorHoraExtra: valorHoraExtraDecimal,
            vigenteDesde: hoy,
            motivo: jornalMotivo,
            createdById: userId,
          },
        });
      }

      return beneficiario;
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Empleado',
      entidadId: creado.id,
      observacion: `Alta empleado "${creado.nombre}"`,
    });
    return creado;
  }

  async update(id: string, dto: UpdateEmpleadoDto, userId: string) {
    const antes = await this.prisma.beneficiario.findUnique({
      where: { id },
      include: { legajo: true },
    });
    if (!antes || antes.tipo !== TipoBeneficiario.EMPLEADO) {
      throw new NotFoundException('Empleado no encontrado');
    }

    const despues = await this.prisma.$transaction(async (tx) => {
      // Campos del beneficiario
      await tx.beneficiario.update({
        where: { id },
        data: {
          nombre: dto.nombre?.trim(),
          cuitCuil: dto.cuitCuil !== undefined ? dto.cuitCuil?.trim() || null : undefined,
          contacto: dto.contacto !== undefined ? dto.contacto?.trim() || null : undefined,
          observaciones:
            dto.observaciones !== undefined ? dto.observaciones?.trim() || null : undefined,
          activo: dto.activo,
          updatedById: userId,
        },
      });

      // Campos del legajo (sin jornal — eso va por /jornal)
      if (
        dto.dni !== undefined ||
        dto.empresaId !== undefined ||
        dto.categoriaId !== undefined ||
        dto.situacionFiscal !== undefined ||
        dto.fechaIngreso !== undefined ||
        dto.obraActualId !== undefined
      ) {
        await tx.empleadoLegajo.update({
          where: { beneficiarioId: id },
          data: {
            dni: dto.dni !== undefined ? dto.dni?.trim() || null : undefined,
            empresaId: dto.empresaId !== undefined ? dto.empresaId : undefined,
            categoriaId: dto.categoriaId !== undefined ? dto.categoriaId : undefined,
            situacionFiscal: dto.situacionFiscal,
            fechaIngreso: dto.fechaIngreso,
            obraActualId: dto.obraActualId !== undefined ? dto.obraActualId : undefined,
          },
        });
      }

      return tx.beneficiario.findUniqueOrThrow({
        where: { id },
        include: { legajo: true, aliases: true },
      });
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'Empleado',
      entidadId: id,
      observacion: `Edición de empleado "${despues.nombre}"`,
    });
    return despues;
  }

  /**
   * Cambia el jornal del empleado y crea una entrada en EmpleadoJornalHistorico.
   * El legajo guarda el valor vigente (desnormalizado).
   */
  async actualizarJornal(id: string, dto: ActualizarJornalDto, userId: string) {
    const emp = await this.prisma.beneficiario.findUnique({
      where: { id },
      include: { legajo: true },
    });
    if (!emp || emp.tipo !== TipoBeneficiario.EMPLEADO || !emp.legajo) {
      throw new NotFoundException('Empleado no encontrado');
    }

    const jornal = new Prisma.Decimal(dto.jornal.toFixed(2));
    const valorHoraExtra =
      dto.valorHoraExtra != null ? new Prisma.Decimal(dto.valorHoraExtra.toFixed(2)) : null;
    const vigenteDesde = dto.vigenteDesde ?? new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const hist = await tx.empleadoJornalHistorico.create({
        data: {
          legajoId: emp.legajo!.id,
          jornal,
          valorHoraExtra,
          vigenteDesde,
          motivo: dto.motivo,
          createdById: userId,
        },
      });

      await tx.empleadoLegajo.update({
        where: { id: emp.legajo!.id },
        data: {
          jornal,
          valorHoraExtra: valorHoraExtra ?? undefined,
        },
      });

      return hist;
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'EmpleadoLegajo',
      entidadId: emp.legajo.id,
      observacion: `Cambio jornal → $${jornal.toFixed(2)}${dto.motivo ? ` (${dto.motivo})` : ''}`,
    });
    return result;
  }

  async historialJornales(id: string) {
    const emp = await this.prisma.beneficiario.findUnique({
      where: { id },
      include: { legajo: { include: { historialJornales: { orderBy: { vigenteDesde: 'desc' } } } } },
    });
    if (!emp || emp.tipo !== TipoBeneficiario.EMPLEADO || !emp.legajo) {
      throw new NotFoundException('Empleado no encontrado');
    }
    return emp.legajo.historialJornales;
  }

  /**
   * Importa empleados iniciales del Excel del cliente (nov 2026).
   * Idempotente: no duplica ni pisa datos editados manualmente.
   */
  async cargarIniciales(userId: string) {
    const resultado = await cargarEmpleadosIniciales(this.prisma);
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Empleado',
      observacion: `Carga inicial: ${resultado.creados} creados · ${resultado.actualizados} actualizados · ${resultado.total} total`,
    });
    return resultado;
  }

  async desactivar(id: string, userId: string) {
    const emp = await this.prisma.beneficiario.findUnique({ where: { id } });
    if (!emp || emp.tipo !== TipoBeneficiario.EMPLEADO) {
      throw new NotFoundException('Empleado no encontrado');
    }
    if (!emp.activo) return emp;
    return this.prisma.beneficiario.update({
      where: { id },
      data: { activo: false, updatedById: userId },
    });
  }

  /**
   * Devuelve el jornal (y valorHoraExtra) vigente del empleado a una fecha.
   * Si no hay historial, usa el valor actual del legajo.
   * Útil para liquidar semanas pasadas con el jornal correcto.
   */
  async jornalVigenteA(beneficiarioId: string, fecha: Date) {
    const legajo = await this.prisma.empleadoLegajo.findUnique({
      where: { beneficiarioId },
    });
    if (!legajo) throw new BadRequestException('El beneficiario no tiene legajo');
    const hist = await this.prisma.empleadoJornalHistorico.findFirst({
      where: { legajoId: legajo.id, vigenteDesde: { lte: fecha } },
      orderBy: { vigenteDesde: 'desc' },
    });
    if (hist) {
      return {
        jornal: Number(hist.jornal),
        valorHoraExtra: hist.valorHoraExtra ? Number(hist.valorHoraExtra) : 0,
        origen: 'historial' as const,
        vigenteDesde: hist.vigenteDesde,
      };
    }
    return {
      jornal: legajo.jornal ? Number(legajo.jornal) : 0,
      valorHoraExtra: legajo.valorHoraExtra ? Number(legajo.valorHoraExtra) : 0,
      origen: 'legajo' as const,
      vigenteDesde: null,
    };
  }

  // ---------- helpers ----------

  private puedeVerSensibles(user: AuthenticatedUser): boolean {
    if (user.rol === 'ADMIN') return true;
    const key = keyPermiso('empleados', 'datos_sensibles');
    if (user.permisos.has(key)) return true;
    const rolSet = PERMISOS_POR_ROL[user.rol];
    return rolSet.has(key);
  }
}
