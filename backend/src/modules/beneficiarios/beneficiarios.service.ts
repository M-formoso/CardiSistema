import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoBeneficiario } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { keyPermiso, PERMISOS_POR_ROL } from '../auth/permisos/roles';
import type {
  CreateBeneficiarioDto,
  FiltrosBeneficiarioDto,
  UpdateBeneficiarioDto,
  UpsertLegajoDto,
} from './dto/beneficiarios.dto';

@Injectable()
export class BeneficiariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
  ) {}

  findAll(filtros: FiltrosBeneficiarioDto, user: AuthenticatedUser) {
    const where: Prisma.BeneficiarioWhereInput = {};
    if (filtros.tipo) where.tipo = filtros.tipo;
    if (filtros.activo !== undefined) where.activo = filtros.activo;
    if (filtros.q)
      where.OR = [
        { nombre: { contains: filtros.q, mode: 'insensitive' } },
        { cuitCuil: { contains: filtros.q } },
      ];

    return this.prisma.beneficiario.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: { legajo: this.puedeVerSensibles(user) ? true : false },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const b = await this.prisma.beneficiario.findUnique({
      where: { id },
      include: {
        legajo: this.puedeVerSensibles(user) ? true : false,
        aliases: true,
      },
    });
    if (!b) throw new NotFoundException('Beneficiario no encontrado');
    return b;
  }

  async create(dto: CreateBeneficiarioDto, userId: string) {
    if (dto.legajo && dto.tipo !== TipoBeneficiario.EMPLEADO) {
      throw new BadRequestException('El legajo solo se carga para beneficiarios tipo EMPLEADO');
    }
    const creado = await this.prisma.beneficiario.create({
      data: {
        tipo: dto.tipo,
        nombre: dto.nombre,
        cuitCuil: dto.cuitCuil,
        rubro: dto.rubro,
        contacto: dto.contacto,
        condicionPago: dto.condicionPago,
        observaciones: dto.observaciones,
        createdById: userId,
        updatedById: userId,
        legajo: dto.legajo
          ? {
              create: {
                fechaIngreso: dto.legajo.fechaIngreso,
                jornal: dto.legajo.jornal != null ? new Prisma.Decimal(dto.legajo.jornal) : null,
                montoSemanal:
                  dto.legajo.montoSemanal != null
                    ? new Prisma.Decimal(dto.legajo.montoSemanal)
                    : null,
                moneda: dto.legajo.moneda,
                obraActualId: dto.legajo.obraActualId,
                observaciones: dto.legajo.observaciones,
              },
            }
          : undefined,
        aliases: dto.aliases?.length
          ? { createMany: { data: dto.aliases.map((alias) => ({ alias })) } }
          : undefined,
      },
      include: { legajo: true, aliases: true },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Beneficiario',
      entidadId: creado.id,
      despues: { ...creado, legajo: null } as unknown, // nunca auditamos datos sensibles
    });
    return creado;
  }

  async update(id: string, dto: UpdateBeneficiarioDto, userId: string) {
    const antes = await this.prisma.beneficiario.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Beneficiario no encontrado');
    const despues = await this.prisma.beneficiario.update({
      where: { id },
      data: { ...dto, updatedById: userId },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'Beneficiario',
      entidadId: id,
      antes: antes as unknown,
      despues: despues as unknown,
    });
    return despues;
  }

  async desactivar(id: string, userId: string) {
    const b = await this.prisma.beneficiario.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Beneficiario no encontrado');
    if (!b.activo) return b;
    return this.prisma.beneficiario.update({
      where: { id },
      data: { activo: false, updatedById: userId },
    });
  }

  // --- Legajo (solo para EMPLEADO) ---

  async upsertLegajo(beneficiarioId: string, dto: UpsertLegajoDto, userId: string) {
    const b = await this.prisma.beneficiario.findUnique({ where: { id: beneficiarioId } });
    if (!b) throw new NotFoundException('Beneficiario no encontrado');
    if (b.tipo !== TipoBeneficiario.EMPLEADO) {
      throw new BadRequestException('El legajo solo aplica a beneficiarios tipo EMPLEADO');
    }
    const data = {
      fechaIngreso: dto.fechaIngreso,
      jornal: dto.jornal != null ? new Prisma.Decimal(dto.jornal) : null,
      montoSemanal: dto.montoSemanal != null ? new Prisma.Decimal(dto.montoSemanal) : null,
      moneda: dto.moneda,
      obraActualId: dto.obraActualId,
      observaciones: dto.observaciones,
    };
    const legajo = await this.prisma.empleadoLegajo.upsert({
      where: { beneficiarioId },
      create: { beneficiarioId, ...data },
      update: data,
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'EmpleadoLegajo',
      entidadId: legajo.id,
      // no guardamos campos sensibles en el diff
      observacion: 'Alta/actualización de legajo',
    });
    return legajo;
  }

  // --- Aliases ---

  async addAlias(beneficiarioId: string, alias: string) {
    await this.prisma.beneficiario.findUniqueOrThrow({ where: { id: beneficiarioId } });
    try {
      return await this.prisma.beneficiarioAlias.create({
        data: { beneficiarioId, alias: alias.trim() },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`El alias "${alias}" ya existe`);
      }
      throw err;
    }
  }

  async removeAlias(id: string) {
    await this.prisma.beneficiarioAlias.delete({ where: { id } });
    return { ok: true };
  }

  async resolverPorAlias(texto: string) {
    const alias = await this.prisma.beneficiarioAlias.findFirst({
      where: { alias: { equals: texto.trim(), mode: 'insensitive' } },
      include: { beneficiario: true },
    });
    return alias?.beneficiario ?? null;
  }

  // --- helpers ---

  private puedeVerSensibles(user: AuthenticatedUser): boolean {
    if (user.rol === 'ADMIN') return true;
    const key = keyPermiso('empleados', 'datos_sensibles');
    if (user.permisos.has(key)) return true;
    const rolSet = PERMISOS_POR_ROL[user.rol];
    return rolSet.has(key);
  }
}
