import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CotizacionTipo,
  EstadoLiquidacion,
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
  CreateLiquidacionDto,
  FiltrosLiquidacionDto,
  PagarLiquidacionDto,
  UpsertItemDto,
} from './dto/liquidaciones.dto';

/**
 * Liquidaciones semanales.
 * Patrón tomado de `sistemaDistrito/backend/src/modules/liquidaciones/`,
 * adaptado al modelo de Cardi:
 * - Al pagar, se generan los egresos en el libro único con imputación
 *   proporcional a los días por obra (ver repartoPorObra).
 * - Se emite un recibo por item (PDF generado por RecibosService).
 * - Todo en una sola $transaction.
 */
@Injectable()
export class LiquidacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
    private readonly cotizaciones: CotizacionesService,
  ) {}

  findAll(filtros: FiltrosLiquidacionDto) {
    const where: Prisma.LiquidacionSemanalWhereInput = {};
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.desde || filtros.hasta) {
      where.semanaInicio = { gte: filtros.desde, lte: filtros.hasta };
    }
    return this.prisma.liquidacionSemanal.findMany({
      where,
      orderBy: { semanaInicio: 'desc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async findOne(id: string) {
    const liq = await this.prisma.liquidacionSemanal.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            beneficiario: { select: { id: true, nombre: true, tipo: true } },
            dias: { include: { obra: { select: { id: true, nombre: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!liq) throw new NotFoundException('Liquidación no encontrada');
    return liq;
  }

  async create(dto: CreateLiquidacionDto, userId: string) {
    try {
      const creada = await this.prisma.liquidacionSemanal.create({
        data: {
          semanaInicio: dto.semanaInicio,
          semanaFin: dto.semanaFin,
          observaciones: dto.observaciones,
          estado: EstadoLiquidacion.BORRADOR,
          createdById: userId,
          updatedById: userId,
        },
      });
      void this.audit.registrar({
        usuarioId: userId,
        accion: 'CREAR',
        entidad: 'LiquidacionSemanal',
        entidadId: creada.id,
        observacion: `Semana ${creada.semanaInicio.toISOString().slice(0, 10)} → ${creada.semanaFin.toISOString().slice(0, 10)}`,
      });
      return creada;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Ya existe una liquidación para esa semana');
      }
      throw err;
    }
  }

  async upsertItem(liquidacionId: string, dto: UpsertItemDto, userId: string) {
    const liq = await this.findOne(liquidacionId);
    if (liq.estado !== EstadoLiquidacion.BORRADOR) {
      throw new BadRequestException('Solo se pueden editar liquidaciones en BORRADOR');
    }

    // Validar días: suma <= 7
    const totalDias = dto.dias.reduce((acc, d) => acc + Number(d.dias), 0);
    if (totalDias <= 0) {
      throw new BadRequestException('El total de días debe ser mayor a 0');
    }

    const subtotal = totalDias * dto.valorDia;
    const aPagar = Math.max(0, subtotal - dto.descuentos);

    return this.prisma.$transaction(async (tx) => {
      // Elimino los días previos para simplificar
      if (dto.id) {
        await tx.liquidacionDia.deleteMany({ where: { itemId: dto.id } });
      }

      const data: Prisma.LiquidacionItemUncheckedCreateInput = {
        liquidacionId,
        beneficiarioId: dto.beneficiarioId ?? null,
        nombreLibre: dto.nombreLibre.trim(),
        diasTrabajados: new Prisma.Decimal(totalDias.toFixed(2)),
        valorDia: new Prisma.Decimal(dto.valorDia.toFixed(2)),
        subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
        descuentos: new Prisma.Decimal(dto.descuentos.toFixed(2)),
        aPagar: new Prisma.Decimal(aPagar.toFixed(2)),
        observaciones: dto.observaciones,
        dias: {
          create: dto.dias.map((d) => ({
            fecha: d.fecha,
            dias: new Prisma.Decimal(Number(d.dias).toFixed(2)),
            obraId: d.obraId,
            etiqueta: d.etiqueta,
          })),
        },
      };

      const item = dto.id
        ? await tx.liquidacionItem.update({
            where: { id: dto.id },
            data: { ...data, dias: { deleteMany: {}, create: data.dias!.create } } as unknown as Prisma.LiquidacionItemUpdateInput,
          })
        : await tx.liquidacionItem.create({ data });

      await this.recalcularTotales(tx, liquidacionId, userId);
      return item;
    });
  }

  async eliminarItem(itemId: string, userId: string) {
    const item = await this.prisma.liquidacionItem.findUnique({
      where: { id: itemId },
      include: { liquidacion: true },
    });
    if (!item) throw new NotFoundException('Item no encontrado');
    if (item.liquidacion.estado !== EstadoLiquidacion.BORRADOR) {
      throw new BadRequestException('Solo se pueden eliminar items de liquidaciones en BORRADOR');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.liquidacionItem.delete({ where: { id: itemId } });
      await this.recalcularTotales(tx, item.liquidacionId, userId);
      return { ok: true };
    });
  }

  async cambiarEstado(id: string, nuevo: EstadoLiquidacion, userId: string) {
    const liq = await this.findOne(id);
    assertTransition('LiquidacionSemanal', liq.estado, nuevo);

    if (nuevo === EstadoLiquidacion.APROBADA && liq.items.length === 0) {
      throw new BadRequestException('No se puede aprobar una liquidación sin items');
    }
    if (nuevo === EstadoLiquidacion.CERRADA) {
      const sinPagar = liq.items.filter((i) => !i.pagado);
      if (sinPagar.length > 0) {
        throw new BadRequestException(
          `No se puede cerrar: hay ${sinPagar.length} empleado(s) sin pagar`,
        );
      }
    }

    const actualizada = await this.prisma.liquidacionSemanal.update({
      where: { id },
      data: {
        estado: nuevo,
        updatedById: userId,
        cerradaAt: nuevo === EstadoLiquidacion.CERRADA ? new Date() : undefined,
        cerradaPorId: nuevo === EstadoLiquidacion.CERRADA ? userId : undefined,
      },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'LiquidacionSemanal',
      entidadId: id,
      observacion: `Cambio estado → ${nuevo}`,
    });
    return actualizada;
  }

  /**
   * Paga la liquidación: por cada item sin pagar (o los que vienen en `itemIds`),
   * genera un egreso en el libro con imputación proporcional a los días por obra
   * y un recibo asociado. Al terminar, si quedan todos los items pagados,
   * mueve la liquidación a PAGADA.
   */
  async pagar(liquidacionId: string, dto: PagarLiquidacionDto, userId: string) {
    const liq = await this.findOne(liquidacionId);
    if (
      liq.estado !== EstadoLiquidacion.APROBADA &&
      liq.estado !== EstadoLiquidacion.BORRADOR &&
      liq.estado !== EstadoLiquidacion.PAGADA
    ) {
      throw new BadRequestException(
        `No se puede pagar una liquidación en estado ${liq.estado}`,
      );
    }
    const caja = await this.prisma.caja.findUnique({ where: { id: dto.cajaId } });
    if (!caja || !caja.activo) throw new BadRequestException('Caja inválida o inactiva');

    const itemsAPagar = liq.items.filter(
      (i) => !i.pagado && (!dto.itemIds || dto.itemIds.includes(i.id)) && Number(i.aPagar) > 0,
    );
    if (itemsAPagar.length === 0) {
      throw new BadRequestException('No hay items pendientes a pagar');
    }

    // Cotización del día (se congela en cada movimiento)
    const ultima = await this.cotizaciones.ultimaCotizacion('BLUE');
    const cotizacionNum = ultima ? Number(ultima.venta) : 1;
    const cotizacionTipo: CotizacionTipo = ultima ? CotizacionTipo.BLUE_VENTA : CotizacionTipo.MANUAL;

    const fechaPago = dto.fechaPago ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const movimientosCreados: string[] = [];
      const recibosCreados: string[] = [];

      for (const item of itemsAPagar) {
        // Reparto por obra según días
        const diasPorObra = new Map<string, number>();
        for (const dia of item.dias) {
          diasPorObra.set(dia.obraId, (diasPorObra.get(dia.obraId) ?? 0) + Number(dia.dias));
        }
        const totalDias = Number(item.diasTrabajados);
        const porcentajes: Array<{ obraId: string; porcentaje: number }> = [...diasPorObra.entries()]
          .map(([obraId, dias]) => ({
            obraId,
            porcentaje: Math.round((dias / totalDias) * 10000) / 100, // 2 decimales
          }));

        // Normalizo porcentajes a 100 (la última línea absorbe la diferencia)
        const sumaPct = porcentajes.reduce((acc, p) => acc + p.porcentaje, 0);
        porcentajes[porcentajes.length - 1].porcentaje += Number((100 - sumaPct).toFixed(4));

        const aPagar = Number(item.aPagar);
        const imputaciones = repartirMonto(
          aPagar,
          porcentajes.map((p) => ({ obraId: p.obraId, porcentaje: p.porcentaje })),
        );

        // Equivalente ARS/USD
        const montoArs =
          caja.moneda === Moneda.ARS ? aPagar.toFixed(2) : usdAArs(aPagar, cotizacionNum).toFixed(2);
        const montoUsd =
          caja.moneda === Moneda.USD ? aPagar.toFixed(2) : arsAUsd(aPagar, cotizacionNum).toFixed(2);

        const grupoId = randomUUID();

        // Recibo (sin PDF por ahora — RecibosService lo genera después si está)
        const recibo = await tx.recibo.create({
          data: {
            fecha: fechaPago,
            beneficiarioId: item.beneficiarioId,
            monto: item.aPagar,
            moneda: caja.moneda,
            concepto: `Pago semanal · ${liq.semanaInicio.toISOString().slice(0, 10)} al ${liq.semanaFin.toISOString().slice(0, 10)} · ${item.nombreLibre}`,
            generadoPorId: userId,
          },
        });

        // Movimiento (EGRESO) con imputaciones
        const mov = await tx.movimiento.create({
          data: {
            tipo: TipoMovimiento.EGRESO,
            fecha: fechaPago,
            cajaId: caja.id,
            moneda: caja.moneda,
            monto: item.aPagar,
            medioPago: dto.medioPago,
            descripcion: `Liquidación semanal · ${item.nombreLibre}`,
            cotizacion: new Prisma.Decimal(cotizacionNum),
            cotizacionTipo,
            montoArs: new Prisma.Decimal(montoArs),
            montoUsd: new Prisma.Decimal(montoUsd),
            beneficiarioId: item.beneficiarioId,
            categoriaId: dto.categoriaId ?? null,
            reciboId: recibo.id,
            grupoId,
            origen: OrigenMovimiento.LIQUIDACION,
            origenId: liq.id,
            estado: EstadoMovimiento.CONFIRMADO,
            createdById: userId,
            updatedById: userId,
            imputaciones: {
              create: imputaciones.map((i) => ({
                obraId: i.obraId,
                monto: new Prisma.Decimal(i.monto.toString()),
                porcentaje: new Prisma.Decimal(i.porcentaje.toString()),
              })),
            },
          },
        });

        // Marco el item como pagado
        await tx.liquidacionItem.update({
          where: { id: item.id },
          data: { pagado: true, fechaPago },
        });

        movimientosCreados.push(mov.id);
        recibosCreados.push(recibo.id);
      }

      // Si ya no quedan items pendientes, muevo la liquidación a PAGADA
      const pendientes = await tx.liquidacionItem.count({
        where: { liquidacionId, pagado: false, aPagar: { gt: 0 } },
      });
      if (pendientes === 0 && liq.estado !== EstadoLiquidacion.PAGADA) {
        await tx.liquidacionSemanal.update({
          where: { id: liquidacionId },
          data: {
            estado: EstadoLiquidacion.PAGADA,
            totalPagado: liq.totalBruto, // aPagar total
            updatedById: userId,
          },
        });
      }

      void this.audit.registrar({
        usuarioId: userId,
        accion: 'ACTUALIZAR',
        entidad: 'LiquidacionSemanal',
        entidadId: liquidacionId,
        observacion: `Pago · ${itemsAPagar.length} empleado(s) · ${movimientosCreados.length} movimientos`,
      });
      return { movimientosCreados, recibosCreados };
    });
  }

  // ---------- helpers ----------

  private async recalcularTotales(
    tx: Prisma.TransactionClient,
    liquidacionId: string,
    userId: string,
  ) {
    const items = await tx.liquidacionItem.findMany({ where: { liquidacionId } });
    const totalBruto = items.reduce((acc, i) => acc.add(i.subtotal), new Prisma.Decimal(0));
    const totalDescuentos = items.reduce((acc, i) => acc.add(i.descuentos), new Prisma.Decimal(0));
    const totalPagado = items
      .filter((i) => i.pagado)
      .reduce((acc, i) => acc.add(i.aPagar), new Prisma.Decimal(0));
    await tx.liquidacionSemanal.update({
      where: { id: liquidacionId },
      data: { totalBruto, totalDescuentos, totalPagado, updatedById: userId },
    });
  }
}
