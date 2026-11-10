import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CotizacionTipo,
  EstadoCuota,
  EstadoMovimiento,
  Moneda,
  OrigenMovimiento,
  Prisma,
  TipoMovimiento,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { arsAUsd, repartirMonto, usdAArs } from '@cardi/shared';
import { assertTransition } from '../../common/state-machines';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';
import type {
  CreateContratoDto,
  FiltrosContratoDto,
  PagarCuotaDto,
} from './dto/contratos-cuotas.dto';

@Injectable()
export class ContratosCuotasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
    private readonly cotizaciones: CotizacionesService,
  ) {}

  findAll(filtros: FiltrosContratoDto) {
    const where: Prisma.ContratoCuotaWhereInput = {};
    if (filtros.beneficiarioId) where.beneficiarioId = filtros.beneficiarioId;
    if (filtros.obraId) where.obraId = filtros.obraId;
    if (filtros.activo !== undefined) where.activo = filtros.activo;
    return this.prisma.contratoCuota.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { createdAt: 'desc' }],
      include: {
        beneficiario: { select: { id: true, nombre: true, tipo: true } },
        obra: { select: { id: true, nombre: true } },
        _count: { select: { cuotas: true } },
      },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.contratoCuota.findUnique({
      where: { id },
      include: {
        beneficiario: true,
        obra: true,
        cuotas: { orderBy: { numero: 'asc' } },
      },
    });
    if (!c) throw new NotFoundException('Contrato no encontrado');
    return c;
  }

  async create(dto: CreateContratoDto, userId: string) {
    const beneficiario = await this.prisma.beneficiario.findUnique({
      where: { id: dto.beneficiarioId },
    });
    if (!beneficiario || !beneficiario.activo) {
      throw new BadRequestException('Beneficiario inválido');
    }

    // Cuotas: si vienen explícitas, validar que sumen el total.
    let cuotasData: Array<{ numero: number; monto: number; vencimiento: Date }>;
    if (dto.cuotas && dto.cuotas.length > 0) {
      if (dto.cuotas.length !== dto.cantidadCuotas) {
        throw new BadRequestException(
          `cantidadCuotas (${dto.cantidadCuotas}) no coincide con cuotas.length (${dto.cuotas.length})`,
        );
      }
      const suma = dto.cuotas.reduce((acc, c) => acc + c.monto, 0);
      if (Math.abs(suma - dto.montoTotal) > 0.01) {
        throw new BadRequestException(
          `La suma de las cuotas (${suma.toFixed(2)}) no coincide con el monto total (${dto.montoTotal.toFixed(2)})`,
        );
      }
      cuotasData = dto.cuotas;
    } else {
      // Reparto parejo con redondeo en la última línea
      const porcentaje = 100 / dto.cantidadCuotas;
      const partes = repartirMonto(
        dto.montoTotal,
        Array.from({ length: dto.cantidadCuotas }, () => ({ obraId: 'x', porcentaje })),
      );
      const hoy = new Date();
      cuotasData = partes.map((p, idx) => ({
        numero: idx + 1,
        monto: Number(p.monto.toString()),
        vencimiento: addMonths(hoy, idx + 1),
      }));
    }

    const creado = await this.prisma.contratoCuota.create({
      data: {
        beneficiarioId: dto.beneficiarioId,
        obraId: dto.obraId,
        concepto: dto.concepto.trim(),
        montoTotal: new Prisma.Decimal(dto.montoTotal),
        moneda: dto.moneda,
        cantidadCuotas: dto.cantidadCuotas,
        observaciones: dto.observaciones,
        cuotas: {
          createMany: {
            data: cuotasData.map((c) => ({
              numero: c.numero,
              monto: new Prisma.Decimal(c.monto),
              vencimiento: c.vencimiento,
              estado: EstadoCuota.PENDIENTE,
            })),
          },
        },
      },
      include: { cuotas: { orderBy: { numero: 'asc' } } },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'ContratoCuota',
      entidadId: creado.id,
      despues: creado as unknown,
    });
    return creado;
  }

  async pagarCuota(cuotaId: string, dto: PagarCuotaDto, userId: string) {
    const cuota = await this.prisma.cuota.findUnique({
      where: { id: cuotaId },
      include: { contrato: { include: { beneficiario: true, obra: true } } },
    });
    if (!cuota) throw new NotFoundException('Cuota no encontrada');
    assertTransition('Cuota', cuota.estado, EstadoCuota.PAGADA);

    const caja = await this.prisma.caja.findUnique({ where: { id: dto.cajaId } });
    if (!caja || !caja.activo) throw new BadRequestException('Caja inválida');
    if (caja.moneda !== cuota.contrato.moneda) {
      throw new BadRequestException(
        `La caja (${caja.moneda}) y el contrato (${cuota.contrato.moneda}) deben tener la misma moneda`,
      );
    }

    const ultima = await this.cotizaciones.ultimaCotizacion('BLUE');
    const cotizacionNum = ultima ? Number(ultima.venta) : 1;
    const cotizacionTipo: CotizacionTipo = ultima ? CotizacionTipo.BLUE_VENTA : CotizacionTipo.MANUAL;
    const fecha = dto.fecha ?? new Date();
    const montoNum = Number(cuota.monto);

    const montoArs =
      caja.moneda === Moneda.ARS ? montoNum.toFixed(2) : usdAArs(montoNum, cotizacionNum).toFixed(2);
    const montoUsd =
      caja.moneda === Moneda.USD ? montoNum.toFixed(2) : arsAUsd(montoNum, cotizacionNum).toFixed(2);

    const grupoId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const mov = await tx.movimiento.create({
        data: {
          tipo: TipoMovimiento.EGRESO,
          fecha,
          cajaId: caja.id,
          moneda: caja.moneda,
          monto: cuota.monto,
          medioPago: dto.medioPago,
          descripcion: `Cuota ${cuota.numero}/${cuota.contrato.cantidadCuotas} · ${cuota.contrato.concepto}`,
          cotizacion: new Prisma.Decimal(cotizacionNum),
          cotizacionTipo,
          montoArs: new Prisma.Decimal(montoArs),
          montoUsd: new Prisma.Decimal(montoUsd),
          beneficiarioId: cuota.contrato.beneficiarioId,
          categoriaId: dto.categoriaId ?? null,
          grupoId,
          origen: OrigenMovimiento.CUOTA,
          origenId: cuota.id,
          estado: EstadoMovimiento.CONFIRMADO,
          createdById: userId,
          updatedById: userId,
          imputaciones: cuota.contrato.obraId
            ? {
                create: [
                  {
                    obraId: cuota.contrato.obraId,
                    monto: cuota.monto,
                    porcentaje: new Prisma.Decimal(100),
                  },
                ],
              }
            : undefined,
        },
      });

      // Si el contrato NO tiene obra, igual necesitamos una imputación — a la obra "GENERAL"
      if (!cuota.contrato.obraId) {
        const general = await tx.obra.findFirst({ where: { tipo: 'GENERAL', activo: true } });
        if (general) {
          await tx.imputacion.create({
            data: {
              movimientoId: mov.id,
              obraId: general.id,
              monto: cuota.monto,
              porcentaje: new Prisma.Decimal(100),
            },
          });
        }
      }

      const cuotaActualizada = await tx.cuota.update({
        where: { id: cuotaId },
        data: { estado: EstadoCuota.PAGADA, movimientoId: mov.id },
      });

      void this.audit.registrar({
        usuarioId: userId,
        accion: 'ACTUALIZAR',
        entidad: 'Cuota',
        entidadId: cuotaId,
        observacion: `Pago cuota ${cuota.numero} · ${montoNum} ${cuota.contrato.moneda}`,
      });

      return { cuota: cuotaActualizada, movimiento: mov };
    });
  }

  async desactivar(id: string, _userId: string) {
    const c = await this.findOne(id);
    if (!c.activo) return c;
    return this.prisma.contratoCuota.update({
      where: { id },
      data: { activo: false },
    });
  }
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}
