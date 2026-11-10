import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  CotizacionTipo,
  EstadoCompromiso,
  EstadoMovimiento,
  Moneda,
  OrigenMovimiento,
  Prisma,
  TipoMovimiento,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { arsAUsd, usdAArs } from '@cardi/shared';
import { assertTransition } from '../../common/state-machines';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';
import type {
  CreateVencimientoDto,
  FiltrosCompromisoDto,
  OmitirCompromisoDto,
  PagarCompromisoDto,
  UpdateVencimientoDto,
} from './dto/compromisos.dto';

/**
 * Gestión de vencimientos recurrentes (plantillas) y compromisos de pago
 * (instancias mensuales).
 *
 * El cron el día 1 a las 00:10 genera los compromisos del mes en curso para
 * cada vencimiento activo. También se puede generar manualmente desde la UI.
 */
@Injectable()
export class CompromisosService {
  private readonly logger = new Logger(CompromisosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
    private readonly cotizaciones: CotizacionesService,
  ) {}

  // =============== VENCIMIENTOS ===============

  listarVencimientos(soloActivos = false) {
    return this.prisma.vencimientoRecurrente.findMany({
      where: soloActivos ? { activo: true } : undefined,
      orderBy: [{ activo: 'desc' }, { diaDelMes: 'asc' }, { concepto: 'asc' }],
      include: {
        obra: { select: { id: true, nombre: true } },
        beneficiario: { select: { id: true, nombre: true } },
        categoria: { select: { id: true, nombre: true } },
      },
    });
  }

  async crearVencimiento(dto: CreateVencimientoDto, userId: string) {
    const creado = await this.prisma.vencimientoRecurrente.create({
      data: {
        ...dto,
        montoEstimado: new Prisma.Decimal(dto.montoEstimado),
      },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'VencimientoRecurrente',
      entidadId: creado.id,
      despues: creado as unknown,
    });
    return creado;
  }

  async actualizarVencimiento(id: string, dto: UpdateVencimientoDto, userId: string) {
    const antes = await this.prisma.vencimientoRecurrente.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Vencimiento no encontrado');
    const despues = await this.prisma.vencimientoRecurrente.update({
      where: { id },
      data: {
        ...dto,
        montoEstimado: dto.montoEstimado != null ? new Prisma.Decimal(dto.montoEstimado) : undefined,
      },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'VencimientoRecurrente',
      entidadId: id,
      antes: antes as unknown,
      despues: despues as unknown,
    });
    return despues;
  }

  async desactivarVencimiento(id: string, _userId: string) {
    const v = await this.prisma.vencimientoRecurrente.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Vencimiento no encontrado');
    if (!v.activo) return v;
    return this.prisma.vencimientoRecurrente.update({
      where: { id },
      data: { activo: false },
    });
  }

  // =============== COMPROMISOS ===============

  listarCompromisos(filtros: FiltrosCompromisoDto) {
    const where: Prisma.CompromisoPagoWhereInput = {};
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.obraId) where.obraId = filtros.obraId;
    if (filtros.desde || filtros.hasta) {
      where.fecha = { gte: filtros.desde, lte: filtros.hasta };
    }
    return this.prisma.compromisoPago.findMany({
      where,
      orderBy: [{ fecha: 'asc' }],
      include: {
        vencimiento: { select: { id: true, concepto: true } },
        obra: { select: { id: true, nombre: true } },
        beneficiario: { select: { id: true, nombre: true } },
      },
    });
  }

  /**
   * Genera los compromisos de un mes/año para cada vencimiento activo.
   * Idempotente: si ya existe un compromiso para ese vencimiento y mes, no lo duplica.
   */
  async generarMes(mes?: number, anio?: number, userId?: string) {
    const hoy = new Date();
    const m = mes ?? hoy.getMonth() + 1;
    const a = anio ?? hoy.getFullYear();
    const vencimientos = await this.prisma.vencimientoRecurrente.findMany({
      where: { activo: true },
    });

    let creados = 0;
    for (const v of vencimientos) {
      const dia = Math.min(v.diaDelMes, diasDelMes(a, m));
      const fecha = new Date(Date.UTC(a, m - 1, dia));
      // Idempotencia: ya hay compromiso para este vencimiento y mes?
      const existe = await this.prisma.compromisoPago.findFirst({
        where: {
          vencimientoId: v.id,
          fecha: {
            gte: new Date(Date.UTC(a, m - 1, 1)),
            lt: new Date(Date.UTC(a, m, 1)),
          },
        },
      });
      if (existe) continue;

      await this.prisma.compromisoPago.create({
        data: {
          vencimientoId: v.id,
          fecha,
          concepto: v.concepto,
          obraId: v.obraId,
          beneficiarioId: v.beneficiarioId,
          montoEstimado: v.montoEstimado,
          moneda: v.moneda,
          estado: EstadoCompromiso.PENDIENTE,
        },
      });
      creados++;
    }

    if (userId && creados > 0) {
      void this.audit.registrar({
        usuarioId: userId,
        accion: 'CREAR',
        entidad: 'CompromisoPago',
        observacion: `Generados ${creados} compromisos para ${m}/${a}`,
      });
    }
    return { mes: m, anio: a, creados };
  }

  /**
   * Marca un compromiso como PAGADO generando un egreso en la billetera.
   */
  async pagarCompromiso(id: string, dto: PagarCompromisoDto, userId: string) {
    const comp = await this.prisma.compromisoPago.findUnique({
      where: { id },
      include: { obra: true },
    });
    if (!comp) throw new NotFoundException('Compromiso no encontrado');
    assertTransition('CompromisoPago', comp.estado, EstadoCompromiso.PAGADO);

    const caja = await this.prisma.caja.findUnique({ where: { id: dto.cajaId } });
    if (!caja || !caja.activo) throw new BadRequestException('Caja inválida');
    if (caja.moneda !== comp.moneda) {
      throw new BadRequestException(
        `La caja (${caja.moneda}) y el compromiso (${comp.moneda}) deben tener la misma moneda`,
      );
    }

    const ultima = await this.cotizaciones.ultimaCotizacion('BLUE');
    const cotizacionNum = ultima ? Number(ultima.venta) : 1;
    const cotizacionTipo: CotizacionTipo = ultima ? CotizacionTipo.BLUE_VENTA : CotizacionTipo.MANUAL;
    const fecha = dto.fecha ?? new Date();
    const montoArs =
      caja.moneda === Moneda.ARS ? dto.monto.toFixed(2) : usdAArs(dto.monto, cotizacionNum).toFixed(2);
    const montoUsd =
      caja.moneda === Moneda.USD ? dto.monto.toFixed(2) : arsAUsd(dto.monto, cotizacionNum).toFixed(2);
    const grupoId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      // Imputación: a la obra del compromiso si tiene, sino a GENERAL
      let obraImputarId = comp.obraId;
      if (!obraImputarId) {
        const general = await tx.obra.findFirst({
          where: { tipo: 'GENERAL', activo: true },
        });
        obraImputarId = general?.id ?? null;
      }

      const mov = await tx.movimiento.create({
        data: {
          tipo: TipoMovimiento.EGRESO,
          fecha,
          cajaId: caja.id,
          moneda: caja.moneda,
          monto: new Prisma.Decimal(dto.monto),
          medioPago: dto.medioPago,
          descripcion: dto.descripcion ?? comp.concepto,
          cotizacion: new Prisma.Decimal(cotizacionNum),
          cotizacionTipo,
          montoArs: new Prisma.Decimal(montoArs),
          montoUsd: new Prisma.Decimal(montoUsd),
          beneficiarioId: comp.beneficiarioId,
          grupoId,
          origen: OrigenMovimiento.COMPROMISO,
          origenId: comp.id,
          estado: EstadoMovimiento.CONFIRMADO,
          createdById: userId,
          updatedById: userId,
          imputaciones: obraImputarId
            ? {
                create: [
                  {
                    obraId: obraImputarId,
                    monto: new Prisma.Decimal(dto.monto),
                    porcentaje: new Prisma.Decimal(100),
                  },
                ],
              }
            : undefined,
        },
      });

      const actualizado = await tx.compromisoPago.update({
        where: { id },
        data: { estado: EstadoCompromiso.PAGADO, movimientoId: mov.id },
      });

      void this.audit.registrar({
        usuarioId: userId,
        accion: 'ACTUALIZAR',
        entidad: 'CompromisoPago',
        entidadId: id,
        observacion: `Pago · ${dto.monto} ${comp.moneda}`,
      });

      return { compromiso: actualizado, movimiento: mov };
    });
  }

  async omitirCompromiso(id: string, dto: OmitirCompromisoDto, userId: string) {
    const comp = await this.prisma.compromisoPago.findUnique({ where: { id } });
    if (!comp) throw new NotFoundException('Compromiso no encontrado');
    assertTransition('CompromisoPago', comp.estado, EstadoCompromiso.OMITIDO);
    const actualizado = await this.prisma.compromisoPago.update({
      where: { id },
      data: { estado: EstadoCompromiso.OMITIDO },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'CompromisoPago',
      entidadId: id,
      observacion: `Omitido · ${dto.motivo}`,
    });
    return actualizado;
  }

  // =============== PROYECCIÓN ===============

  async proyeccion(diasAdelante = 30) {
    const hoy = new Date();
    const hasta = new Date(hoy);
    hasta.setDate(hasta.getDate() + diasAdelante);
    const pendientes = await this.prisma.compromisoPago.findMany({
      where: {
        estado: EstadoCompromiso.PENDIENTE,
        fecha: { gte: hoy, lte: hasta },
      },
      orderBy: { fecha: 'asc' },
      include: {
        obra: { select: { id: true, nombre: true } },
        beneficiario: { select: { id: true, nombre: true } },
      },
    });

    // Totales por moneda
    const totales = pendientes.reduce(
      (acc, c) => {
        const monto = Number(c.montoEstimado);
        if (c.moneda === Moneda.ARS) acc.ars += monto;
        else acc.usd += monto;
        return acc;
      },
      { ars: 0, usd: 0 },
    );

    return {
      diasAdelante,
      cantidad: pendientes.length,
      totales,
      items: pendientes,
    };
  }

  // =============== CRON ===============

  /**
   * Día 1 de cada mes a las 00:10 — genera compromisos del nuevo mes.
   */
  @Cron('0 10 0 1 * *', { name: 'generarCompromisosMensuales' })
  async cronMensual() {
    try {
      const r = await this.generarMes(undefined, undefined, undefined);
      this.logger.log(`Compromisos generados para ${r.mes}/${r.anio} · ${r.creados} nuevos`);
    } catch (err) {
      this.logger.error(
        `Error generando compromisos mensuales: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}

function diasDelMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}
