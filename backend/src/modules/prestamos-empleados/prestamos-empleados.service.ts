import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EstadoPrestamoEmpleado,
  Prisma,
  TipoBeneficiario,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type {
  AnularPrestamoDto,
  CreatePrestamoDto,
  FiltrosPrestamoDto,
  UpdatePrestamoDto,
} from './dto/prestamos-empleados.dto';

/**
 * Préstamos a empleados.
 * Un préstamo típicamente nace desde billetera (egreso con categoría PREST_EMP),
 * pero también puede crearse directamente desde este módulo (sin movimiento asociado).
 * Las aplicaciones (descuentos en liquidaciones) se manejan desde LiquidacionesService.
 */
@Injectable()
export class PrestamosEmpleadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
  ) {}

  findAll(filtros: FiltrosPrestamoDto) {
    const where: Prisma.PrestamoEmpleadoWhereInput = {};
    if (filtros.beneficiarioId) where.beneficiarioId = filtros.beneficiarioId;
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.desde || filtros.hasta) {
      where.fecha = { gte: filtros.desde, lte: filtros.hasta };
    }
    return this.prisma.prestamoEmpleado.findMany({
      where,
      orderBy: [{ estado: 'asc' }, { fecha: 'desc' }],
      include: {
        beneficiario: { select: { id: true, nombre: true } },
        _count: { select: { aplicaciones: true } },
      },
    });
  }

  async findOne(id: string) {
    const prestamo = await this.prisma.prestamoEmpleado.findUnique({
      where: { id },
      include: {
        beneficiario: { select: { id: true, nombre: true } },
        movimiento: { select: { id: true, fecha: true, estado: true } },
        aplicaciones: {
          include: {
            liquidacionItem: {
              include: {
                liquidacion: {
                  select: {
                    id: true,
                    semanaInicio: true,
                    semanaFin: true,
                    obra: { select: { id: true, nombre: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado');
    return prestamo;
  }

  /**
   * Vigentes de un empleado con saldo > 0. Uso principal: UI de liquidaciones
   * muestra estos préstamos como aplicables a los items del empleado.
   */
  vigentesDe(beneficiarioId: string) {
    return this.prisma.prestamoEmpleado.findMany({
      where: {
        beneficiarioId,
        estado: EstadoPrestamoEmpleado.VIGENTE,
        saldoPendiente: { gt: 0 },
      },
      orderBy: { fecha: 'asc' },
    });
  }

  async create(dto: CreatePrestamoDto, userId: string) {
    const emp = await this.prisma.beneficiario.findUnique({
      where: { id: dto.beneficiarioId },
    });
    if (!emp || emp.tipo !== TipoBeneficiario.EMPLEADO) {
      throw new BadRequestException('El préstamo solo aplica a beneficiarios tipo EMPLEADO');
    }
    const monto = new Prisma.Decimal(dto.monto.toFixed(2));

    const creado = await this.prisma.prestamoEmpleado.create({
      data: {
        beneficiarioId: dto.beneficiarioId,
        fecha: dto.fecha,
        monto,
        saldoPendiente: monto,
        movimientoId: dto.movimientoId,
        observaciones: dto.observaciones,
        estado: EstadoPrestamoEmpleado.VIGENTE,
        createdById: userId,
        updatedById: userId,
      },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'PrestamoEmpleado',
      entidadId: creado.id,
      observacion: `Préstamo a ${emp.nombre} · $${monto.toFixed(2)}`,
    });
    return creado;
  }

  async update(id: string, dto: UpdatePrestamoDto, userId: string) {
    const antes = await this.prisma.prestamoEmpleado.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Préstamo no encontrado');
    if (antes.estado === EstadoPrestamoEmpleado.ANULADO) {
      throw new BadRequestException('No se puede editar un préstamo anulado');
    }
    const despues = await this.prisma.prestamoEmpleado.update({
      where: { id },
      data: {
        observaciones:
          dto.observaciones !== undefined ? dto.observaciones ?? null : undefined,
        updatedById: userId,
      },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'PrestamoEmpleado',
      entidadId: id,
    });
    return despues;
  }

  /**
   * Anula un préstamo: revierte todas sus aplicaciones (devuelve saldo a 0 lógico)
   * y marca estado=ANULADO. Si el préstamo tiene un movimiento asociado, el movimiento
   * se anula aparte desde MovimientosService (no se toca acá para no acoplar).
   */
  async anular(id: string, dto: AnularPrestamoDto, userId: string) {
    const prestamo = await this.prisma.prestamoEmpleado.findUnique({
      where: { id },
      include: { aplicaciones: true },
    });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado');
    if (prestamo.estado === EstadoPrestamoEmpleado.ANULADO) return prestamo;

    const anulado = await this.prisma.$transaction(async (tx) => {
      // Eliminar aplicaciones; dejan de descontar del empleado
      // (los items quedan como estaban en su monto, pero ya no referencian este préstamo)
      await tx.prestamoAplicacion.deleteMany({ where: { prestamoId: id } });
      return tx.prestamoEmpleado.update({
        where: { id },
        data: {
          estado: EstadoPrestamoEmpleado.ANULADO,
          saldoPendiente: new Prisma.Decimal(0),
          observaciones: prestamo.observaciones
            ? `${prestamo.observaciones}\n[Anulado: ${dto.motivo}]`
            : `[Anulado: ${dto.motivo}]`,
          updatedById: userId,
        },
      });
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ANULAR',
      entidad: 'PrestamoEmpleado',
      entidadId: id,
      observacion: dto.motivo,
    });
    return anulado;
  }
}
