import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CotizacionTipo,
  EstadoLiquidacion,
  EstadoMovimiento,
  EstadoPrestamoEmpleado,
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
  CreateLiquidacionDto,
  FiltrosLiquidacionDto,
  PagarLiquidacionDto,
  UpsertItemDto,
} from './dto/liquidaciones.dto';

/**
 * Liquidaciones semanales v2.
 * - Una liquidación por obra y semana. Los días son un número, no por día.
 * - Items soportan hs. extras y aplicación de préstamos pendientes del empleado.
 * - El pago puede ser total o parcial (LiquidacionPago). Cada pago genera un
 *   Movimiento imputado 100% a la obra de la liquidación.
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
    if (filtros.obraId) where.obraId = filtros.obraId;
    if (filtros.desde || filtros.hasta) {
      where.semanaInicio = { gte: filtros.desde, lte: filtros.hasta };
    }
    return this.prisma.liquidacionSemanal.findMany({
      where,
      orderBy: { semanaInicio: 'desc' },
      include: {
        obra: { select: { id: true, nombre: true } },
        _count: { select: { items: true, pagos: true } },
      },
    });
  }

  async findOne(id: string) {
    const liq = await this.prisma.liquidacionSemanal.findUnique({
      where: { id },
      include: {
        obra: { select: { id: true, nombre: true, tipo: true } },
        items: {
          include: {
            beneficiario: { select: { id: true, nombre: true, tipo: true } },
            aplicacionesPrestamo: {
              include: {
                prestamo: { select: { id: true, fecha: true, monto: true, saldoPendiente: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        pagos: {
          include: {
            caja: { select: { id: true, nombre: true, moneda: true } },
            movimiento: { select: { id: true, estado: true } },
          },
          orderBy: { fecha: 'desc' },
        },
      },
    });
    if (!liq) throw new NotFoundException('Liquidación no encontrada');
    return liq;
  }

  async create(dto: CreateLiquidacionDto, userId: string) {
    const obra = await this.prisma.obra.findUnique({ where: { id: dto.obraId } });
    if (!obra || !obra.activo) throw new BadRequestException('Obra inválida o inactiva');

    const creada = await this.prisma.liquidacionSemanal.create({
      data: {
        semanaInicio: dto.semanaInicio,
        semanaFin: dto.semanaFin,
        obraId: dto.obraId,
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
      observacion: `Semana ${creada.semanaInicio.toISOString().slice(0, 10)} → ${creada.semanaFin.toISOString().slice(0, 10)} · ${obra.nombre}`,
    });
    return creada;
  }

  async upsertItem(liquidacionId: string, dto: UpsertItemDto, userId: string) {
    const liq = await this.prisma.liquidacionSemanal.findUnique({
      where: { id: liquidacionId },
      select: { id: true, estado: true },
    });
    if (!liq) throw new NotFoundException('Liquidación no encontrada');
    if (liq.estado !== EstadoLiquidacion.BORRADOR) {
      throw new BadRequestException('Solo se pueden editar liquidaciones en BORRADOR');
    }

    const dias = Number(dto.diasTrabajados);
    const horasExtras = Number(dto.horasExtras ?? 0);
    const valorDia = Number(dto.valorDia);
    const valorHoraExtra = Number(dto.valorHoraExtra ?? 0);
    const descuentos = Number(dto.descuentos ?? 0);

    if (dias === 0 && horasExtras === 0) {
      throw new BadRequestException('El item debe tener días u horas extra');
    }

    const subtotal = dias * valorDia + horasExtras * valorHoraExtra;

    const prestamosAplicar = dto.prestamosAplicar ?? [];
    const prestamosAplicados = prestamosAplicar.reduce((acc, p) => acc + Number(p.monto), 0);

    const aPagar = Math.max(0, subtotal - descuentos - prestamosAplicados);

    return this.prisma.$transaction(async (tx) => {
      // Si es update, revierto aplicaciones previas (suma los montos de vuelta a los préstamos)
      if (dto.id) {
        await this.revertirAplicacionesItem(tx, dto.id);
      }

      // Valido cada préstamo: existe, pertenece al beneficiario, monto <= saldoPendiente
      if (prestamosAplicar.length > 0) {
        if (!dto.beneficiarioId) {
          throw new BadRequestException('Para aplicar préstamos, el item debe tener beneficiario');
        }
        for (const ap of prestamosAplicar) {
          const prestamo = await tx.prestamoEmpleado.findUnique({ where: { id: ap.prestamoId } });
          if (!prestamo) {
            throw new BadRequestException(`Préstamo ${ap.prestamoId} no encontrado`);
          }
          if (prestamo.beneficiarioId !== dto.beneficiarioId) {
            throw new BadRequestException('El préstamo no pertenece al empleado del item');
          }
          if (prestamo.estado === EstadoPrestamoEmpleado.ANULADO) {
            throw new BadRequestException('No se puede aplicar un préstamo anulado');
          }
          if (Number(prestamo.saldoPendiente) < Number(ap.monto)) {
            throw new BadRequestException(
              `Monto a aplicar ($${ap.monto}) supera el saldo pendiente ($${prestamo.saldoPendiente}) del préstamo`,
            );
          }
        }
      }

      const data: Prisma.LiquidacionItemUncheckedCreateInput = {
        liquidacionId,
        beneficiarioId: dto.beneficiarioId ?? null,
        nombreLibre: dto.nombreLibre.trim(),
        diasTrabajados: new Prisma.Decimal(dias.toFixed(2)),
        valorDia: new Prisma.Decimal(valorDia.toFixed(2)),
        horasExtras: new Prisma.Decimal(horasExtras.toFixed(2)),
        valorHoraExtra: new Prisma.Decimal(valorHoraExtra.toFixed(2)),
        subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
        descuentos: new Prisma.Decimal(descuentos.toFixed(2)),
        prestamosAplicados: new Prisma.Decimal(prestamosAplicados.toFixed(2)),
        aPagar: new Prisma.Decimal(aPagar.toFixed(2)),
        observaciones: dto.observaciones,
      };

      const item = dto.id
        ? await tx.liquidacionItem.update({ where: { id: dto.id }, data })
        : await tx.liquidacionItem.create({ data });

      // Aplico los préstamos nuevos
      for (const ap of prestamosAplicar) {
        await tx.prestamoAplicacion.create({
          data: {
            prestamoId: ap.prestamoId,
            liquidacionItemId: item.id,
            monto: new Prisma.Decimal(Number(ap.monto).toFixed(2)),
          },
        });
        const prestamo = await tx.prestamoEmpleado.findUnique({
          where: { id: ap.prestamoId },
          select: { saldoPendiente: true },
        });
        const nuevoSaldo = new Prisma.Decimal(prestamo!.saldoPendiente).minus(
          new Prisma.Decimal(Number(ap.monto).toFixed(2)),
        );
        await tx.prestamoEmpleado.update({
          where: { id: ap.prestamoId },
          data: {
            saldoPendiente: nuevoSaldo,
            estado: nuevoSaldo.lte(0)
              ? EstadoPrestamoEmpleado.SALDADO
              : EstadoPrestamoEmpleado.VIGENTE,
            updatedById: userId,
          },
        });
      }

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
      await this.revertirAplicacionesItem(tx, itemId);
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
      const saldo = new Prisma.Decimal(liq.totalAPagar).minus(new Prisma.Decimal(liq.totalPagado));
      if (saldo.gt(0)) {
        throw new BadRequestException(
          `No se puede cerrar: saldo pendiente $${saldo.toFixed(2)}`,
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
   * Paga la liquidación (parcial o total).
   * - Si no se pasa monto, se paga el saldo pendiente completo.
   * - Crea LiquidacionPago + Movimiento (EGRESO) imputado 100% a la obra.
   * - Si el saldo se cierra, pasa a PAGADA y marca los items como pagados.
   * - Si queda saldo, pasa a PAGADA_PARCIAL.
   */
  async pagar(liquidacionId: string, dto: PagarLiquidacionDto, userId: string) {
    const liq = await this.findOne(liquidacionId);
    const estadosOk: EstadoLiquidacion[] = [
      EstadoLiquidacion.APROBADA,
      EstadoLiquidacion.PAGADA_PARCIAL,
    ];
    if (!estadosOk.includes(liq.estado)) {
      throw new BadRequestException(
        `No se puede pagar una liquidación en estado ${liq.estado}`,
      );
    }

    const totalAPagar = new Prisma.Decimal(liq.totalAPagar);
    const totalPagado = new Prisma.Decimal(liq.totalPagado);
    const saldoPendiente = totalAPagar.minus(totalPagado);
    if (saldoPendiente.lte(0)) {
      throw new BadRequestException('La liquidación ya está completamente pagada');
    }

    const montoAPagar = dto.monto
      ? new Prisma.Decimal(Number(dto.monto).toFixed(2))
      : saldoPendiente;
    if (montoAPagar.lte(0)) {
      throw new BadRequestException('El monto a pagar debe ser mayor a 0');
    }
    if (montoAPagar.gt(saldoPendiente)) {
      throw new BadRequestException(
        `El monto ($${montoAPagar.toFixed(2)}) supera el saldo pendiente ($${saldoPendiente.toFixed(2)})`,
      );
    }

    const caja = await this.prisma.caja.findUnique({ where: { id: dto.cajaId } });
    if (!caja || !caja.activo) throw new BadRequestException('Caja inválida o inactiva');

    // Cotización del día (congela el movimiento)
    const ultima = await this.cotizaciones.ultimaCotizacion('BLUE');
    const cotizacionNum = ultima ? Number(ultima.venta) : 1;
    const cotizacionTipo: CotizacionTipo = ultima ? CotizacionTipo.BLUE_VENTA : CotizacionTipo.MANUAL;

    const fechaPago = dto.fechaPago ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const grupoId = randomUUID();
      const montoNum = Number(montoAPagar.toFixed(2));
      const montoArs =
        caja.moneda === Moneda.ARS ? montoNum.toFixed(2) : usdAArs(montoNum, cotizacionNum).toFixed(2);
      const montoUsd =
        caja.moneda === Moneda.USD ? montoNum.toFixed(2) : arsAUsd(montoNum, cotizacionNum).toFixed(2);

      // Movimiento EGRESO imputado 100% a la obra de la liquidación
      const mov = await tx.movimiento.create({
        data: {
          tipo: TipoMovimiento.EGRESO,
          fecha: fechaPago,
          cajaId: caja.id,
          moneda: caja.moneda,
          monto: montoAPagar,
          medioPago: dto.medioPago,
          descripcion: dto.observaciones ?? `Pago liquidación · ${liq.obra.nombre}`,
          cotizacion: new Prisma.Decimal(cotizacionNum),
          cotizacionTipo,
          montoArs: new Prisma.Decimal(montoArs),
          montoUsd: new Prisma.Decimal(montoUsd),
          categoriaId: dto.categoriaId ?? null,
          grupoId,
          origen: OrigenMovimiento.LIQUIDACION,
          origenId: liq.id,
          estado: EstadoMovimiento.CONFIRMADO,
          createdById: userId,
          updatedById: userId,
          imputaciones: {
            create: [
              {
                obraId: liq.obraId,
                monto: montoAPagar,
                porcentaje: new Prisma.Decimal(100),
              },
            ],
          },
        },
      });

      // LiquidacionPago vinculado al movimiento
      await tx.liquidacionPago.create({
        data: {
          liquidacionId,
          movimientoId: mov.id,
          monto: montoAPagar,
          fecha: fechaPago,
          medioPago: dto.medioPago,
          cajaId: caja.id,
          observaciones: dto.observaciones,
          createdById: userId,
        },
      });

      const nuevoTotalPagado = totalPagado.plus(montoAPagar);
      const seCompleto = nuevoTotalPagado.gte(totalAPagar);
      const nuevoEstado = seCompleto
        ? EstadoLiquidacion.PAGADA
        : EstadoLiquidacion.PAGADA_PARCIAL;

      await tx.liquidacionSemanal.update({
        where: { id: liquidacionId },
        data: {
          totalPagado: nuevoTotalPagado,
          estado: nuevoEstado,
          updatedById: userId,
        },
      });

      // Si se completó el pago, marcar items pagados y generar recibos
      const recibosCreados: string[] = [];
      if (seCompleto) {
        await tx.liquidacionItem.updateMany({
          where: { liquidacionId },
          data: { pagado: true, fechaPago },
        });
        for (const item of liq.items) {
          if (Number(item.aPagar) <= 0) continue;
          const recibo = await tx.recibo.create({
            data: {
              fecha: fechaPago,
              beneficiarioId: item.beneficiarioId,
              monto: item.aPagar,
              moneda: caja.moneda,
              concepto: `Pago semanal · ${liq.semanaInicio.toISOString().slice(0, 10)} al ${liq.semanaFin.toISOString().slice(0, 10)} · ${liq.obra.nombre} · ${item.nombreLibre}`,
              generadoPorId: userId,
            },
          });
          recibosCreados.push(recibo.id);
        }
      }

      void this.audit.registrar({
        usuarioId: userId,
        accion: 'ACTUALIZAR',
        entidad: 'LiquidacionSemanal',
        entidadId: liquidacionId,
        observacion: `Pago $${montoAPagar.toFixed(2)} · ${seCompleto ? 'cerrada' : 'parcial'}`,
      });

      return {
        movimientoId: mov.id,
        montoPagado: montoAPagar.toFixed(2),
        saldoPendiente: totalAPagar.minus(nuevoTotalPagado).toFixed(2),
        estado: nuevoEstado,
        recibosCreados,
      };
    });
  }

  // ---------- helpers ----------

  private async revertirAplicacionesItem(tx: Prisma.TransactionClient, itemId: string) {
    const aplicaciones = await tx.prestamoAplicacion.findMany({
      where: { liquidacionItemId: itemId },
    });
    for (const ap of aplicaciones) {
      const prestamo = await tx.prestamoEmpleado.findUnique({
        where: { id: ap.prestamoId },
        select: { saldoPendiente: true, monto: true },
      });
      if (!prestamo) continue;
      const nuevoSaldo = new Prisma.Decimal(prestamo.saldoPendiente).plus(ap.monto);
      await tx.prestamoEmpleado.update({
        where: { id: ap.prestamoId },
        data: {
          saldoPendiente: nuevoSaldo,
          estado: nuevoSaldo.gt(0)
            ? EstadoPrestamoEmpleado.VIGENTE
            : EstadoPrestamoEmpleado.SALDADO,
        },
      });
    }
    await tx.prestamoAplicacion.deleteMany({ where: { liquidacionItemId: itemId } });
  }

  private async recalcularTotales(
    tx: Prisma.TransactionClient,
    liquidacionId: string,
    userId: string,
  ) {
    const items = await tx.liquidacionItem.findMany({ where: { liquidacionId } });
    const totalBruto = items.reduce((acc, i) => acc.add(i.subtotal), new Prisma.Decimal(0));
    const totalDescuentos = items.reduce(
      (acc, i) => acc.add(i.descuentos).add(i.prestamosAplicados),
      new Prisma.Decimal(0),
    );
    const totalAPagar = items.reduce((acc, i) => acc.add(i.aPagar), new Prisma.Decimal(0));
    const totalPagado = items
      .filter((i) => i.pagado)
      .reduce((acc, i) => acc.add(i.aPagar), new Prisma.Decimal(0));
    await tx.liquidacionSemanal.update({
      where: { id: liquidacionId },
      data: { totalBruto, totalDescuentos, totalAPagar, totalPagado, updatedById: userId },
    });
  }
}
