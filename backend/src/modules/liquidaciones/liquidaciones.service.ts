import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CotizacionTipo,
  EstadoLiquidacion,
  EstadoMovimiento,
  EstadoPrestamoEmpleado,
  Moneda,
  OrigenMovimiento,
  Prisma,
  TipoConceptoLiquidacion,
  TipoMovimiento,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { arsAUsd, usdAArs } from '@cardi/shared';
import { assertTransition } from '../../common/state-machines';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';
import type {
  ConceptoInput,
  CreateLiquidacionDto,
  FiltrosLiquidacionDto,
  PagarLiquidacionDto,
  UpsertItemDto,
} from './dto/liquidaciones.dto';

/**
 * Signo lógico de cada tipo de concepto en el total del recibo.
 * - Positivo: suma al subtotal.
 * - Negativo: resta.
 * - Cero: informativo (NOTA_SALDO), no se cuenta.
 */
const SIGNO_POR_TIPO: Record<TipoConceptoLiquidacion, 1 | -1 | 0> = {
  JORNAL: 1,
  JORNAL_ESPECIAL: 1,
  HORAS_EXTRA: 1,
  VIATICO: 1,
  VACACIONES: 1,
  CERTIFICACION: 1,
  SUELDO: 1,
  PRESTAMO_ENTREGADO: 1, // suma al total que se entrega (nace el préstamo)
  PRESTAMO_APLICACION: -1, // descuento del total (reduce saldo de préstamo existente)
  DEDUCCION: -1,
  VALE: -1,
  NOTA_SALDO: 0,
};

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
            conceptos: {
              include: {
                obra: { select: { id: true, nombre: true } },
                prestamo: { select: { id: true, fecha: true, monto: true, saldoPendiente: true } },
              },
              orderBy: { orden: 'asc' },
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

    // Validación básica de conceptos
    this.validarConceptos(dto.conceptos, dto.beneficiarioId);

    return this.prisma.$transaction(async (tx) => {
      // Si es update, revertir efectos de conceptos previos (aplicaciones y entregas de préstamo)
      if (dto.id) {
        await this.revertirEfectosDeConceptos(tx, dto.id);
      }

      // Crear o actualizar el item (subtotal/aPagar provisorios, se recalculan abajo)
      const itemData: Prisma.LiquidacionItemUncheckedCreateInput = {
        liquidacionId,
        beneficiarioId: dto.beneficiarioId ?? null,
        nombreLibre: dto.nombreLibre.trim(),
        subtotal: new Prisma.Decimal(0),
        aPagar: new Prisma.Decimal(0),
        observaciones: dto.observaciones,
      };

      const item = dto.id
        ? await tx.liquidacionItem.update({ where: { id: dto.id }, data: itemData })
        : await tx.liquidacionItem.create({ data: itemData });

      // Borrar conceptos y aplicaciones viejas (si era update)
      if (dto.id) {
        await tx.liquidacionItemConcepto.deleteMany({ where: { liquidacionItemId: item.id } });
        await tx.prestamoAplicacion.deleteMany({ where: { liquidacionItemId: item.id } });
      }

      // Aplicar cada concepto: validar préstamos, crear nuevos si corresponde, crear el concepto
      let subtotal = new Prisma.Decimal(0);
      let ordenCursor = 0;
      for (const c of dto.conceptos) {
        const signo = SIGNO_POR_TIPO[c.tipo];
        const montoBruto = new Prisma.Decimal(Math.abs(c.monto).toFixed(2));
        const montoSignado = signo === -1 ? montoBruto.neg() : signo === 1 ? montoBruto : new Prisma.Decimal(0);

        let prestamoId = c.prestamoId ?? null;

        if (c.tipo === TipoConceptoLiquidacion.PRESTAMO_APLICACION) {
          if (!prestamoId) throw new BadRequestException('PRESTAMO_APLICACION requiere prestamoId');
          const prestamo = await tx.prestamoEmpleado.findUnique({ where: { id: prestamoId } });
          if (!prestamo) throw new BadRequestException(`Préstamo ${prestamoId} no encontrado`);
          if (prestamo.beneficiarioId !== dto.beneficiarioId) {
            throw new BadRequestException('El préstamo no pertenece al empleado');
          }
          if (prestamo.estado === EstadoPrestamoEmpleado.ANULADO) {
            throw new BadRequestException('No se puede aplicar un préstamo anulado');
          }
          if (new Prisma.Decimal(prestamo.saldoPendiente).lt(montoBruto)) {
            throw new BadRequestException(
              `Monto a aplicar ($${montoBruto.toFixed(2)}) supera el saldo pendiente ($${prestamo.saldoPendiente}) del préstamo`,
            );
          }
          await tx.prestamoAplicacion.create({
            data: { prestamoId, liquidacionItemId: item.id, monto: montoBruto },
          });
          const nuevoSaldo = new Prisma.Decimal(prestamo.saldoPendiente).minus(montoBruto);
          await tx.prestamoEmpleado.update({
            where: { id: prestamoId },
            data: {
              saldoPendiente: nuevoSaldo,
              estado: nuevoSaldo.lte(0)
                ? EstadoPrestamoEmpleado.SALDADO
                : EstadoPrestamoEmpleado.VIGENTE,
              updatedById: userId,
            },
          });
        }

        if (c.tipo === TipoConceptoLiquidacion.PRESTAMO_ENTREGADO) {
          if (!dto.beneficiarioId) {
            throw new BadRequestException('PRESTAMO_ENTREGADO requiere beneficiario');
          }
          const nuevoPrestamo = await tx.prestamoEmpleado.create({
            data: {
              beneficiarioId: dto.beneficiarioId,
              fecha: new Date(),
              monto: montoBruto,
              saldoPendiente: montoBruto,
              estado: EstadoPrestamoEmpleado.VIGENTE,
              observaciones: c.descripcion,
              createdById: userId,
              updatedById: userId,
            },
          });
          prestamoId = nuevoPrestamo.id;
        }

        await tx.liquidacionItemConcepto.create({
          data: {
            liquidacionItemId: item.id,
            tipo: c.tipo,
            descripcion: c.descripcion,
            cantidad: c.cantidad != null ? new Prisma.Decimal(c.cantidad) : null,
            valorUnitario: c.valorUnitario != null ? new Prisma.Decimal(c.valorUnitario) : null,
            monto: montoSignado,
            obraId: c.obraId ?? null,
            prestamoId,
            orden: c.orden ?? ordenCursor,
          },
        });
        ordenCursor++;

        subtotal = subtotal.plus(montoSignado);
      }

      const aPagar = subtotal;

      await tx.liquidacionItem.update({
        where: { id: item.id },
        data: { subtotal, aPagar },
      });

      await this.recalcularTotales(tx, liquidacionId, userId);
      return tx.liquidacionItem.findUniqueOrThrow({
        where: { id: item.id },
        include: { conceptos: true },
      });
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
      await this.revertirEfectosDeConceptos(tx, itemId);
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
        throw new BadRequestException(`No se puede cerrar: saldo pendiente $${saldo.toFixed(2)}`);
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
   * El movimiento de egreso se imputa por obra según los conceptos positivos:
   *   - Conceptos con obraId → esa obra.
   *   - Conceptos sin obraId → la obra de la liquidación.
   *   - Los conceptos negativos (DEDUCCION, PRESTAMO_APLICACION, VALE) y
   *     NOTA_SALDO no toman imputación — el pago parcial se reparte
   *     proporcionalmente entre los positivos.
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

    // Agrupar positivos por obra para las imputaciones
    const imputacionesPorObra = this.calcularImputacionesPorObra(liq, montoAPagar);

    return this.prisma.$transaction(async (tx) => {
      const grupoId = randomUUID();
      const montoNum = Number(montoAPagar.toFixed(2));
      const montoArs =
        caja.moneda === Moneda.ARS ? montoNum.toFixed(2) : usdAArs(montoNum, cotizacionNum).toFixed(2);
      const montoUsd =
        caja.moneda === Moneda.USD ? montoNum.toFixed(2) : arsAUsd(montoNum, cotizacionNum).toFixed(2);

      // Movimiento EGRESO con imputaciones por obra según conceptos
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
            create: imputacionesPorObra.map((i) => ({
              obraId: i.obraId,
              monto: new Prisma.Decimal(i.monto.toFixed(2)),
              porcentaje: new Prisma.Decimal(i.porcentaje.toFixed(4)),
            })),
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

  private validarConceptos(conceptos: ConceptoInput[], beneficiarioId: string | undefined) {
    const conPrestamoApp = conceptos.some(
      (c) => c.tipo === TipoConceptoLiquidacion.PRESTAMO_APLICACION,
    );
    const conPrestamoEnt = conceptos.some(
      (c) => c.tipo === TipoConceptoLiquidacion.PRESTAMO_ENTREGADO,
    );
    if ((conPrestamoApp || conPrestamoEnt) && !beneficiarioId) {
      throw new BadRequestException('Préstamos (entregados o aplicados) requieren beneficiario');
    }
    for (const c of conceptos) {
      if (
        c.tipo === TipoConceptoLiquidacion.PRESTAMO_APLICACION &&
        !c.prestamoId
      ) {
        throw new BadRequestException(
          'Concepto PRESTAMO_APLICACION: falta prestamoId',
        );
      }
      if (c.monto < 0) {
        throw new BadRequestException(
          'El monto del concepto siempre se envía positivo; el signo lo pone el sistema según el tipo',
        );
      }
    }
  }

  private async revertirEfectosDeConceptos(tx: Prisma.TransactionClient, itemId: string) {
    // 1. Aplicaciones de préstamo: devolver el monto al saldoPendiente
    const aplicaciones = await tx.prestamoAplicacion.findMany({
      where: { liquidacionItemId: itemId },
    });
    for (const ap of aplicaciones) {
      const prestamo = await tx.prestamoEmpleado.findUnique({
        where: { id: ap.prestamoId },
        select: { saldoPendiente: true, estado: true },
      });
      if (!prestamo) continue;
      if (prestamo.estado === EstadoPrestamoEmpleado.ANULADO) continue;
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

    // 2. Préstamos entregados (nacidos desde un concepto): anular los que
    //    todavía no tienen aplicaciones (saldoPendiente == monto).
    //    Si alguien ya empezó a descontar, el préstamo permanece (no podemos
    //    "deshacer" si otro item ya lo aplicó); se marca manualmente.
    const conceptosEntregados = await tx.liquidacionItemConcepto.findMany({
      where: { liquidacionItemId: itemId, tipo: TipoConceptoLiquidacion.PRESTAMO_ENTREGADO },
    });
    for (const c of conceptosEntregados) {
      if (!c.prestamoId) continue;
      const prestamo = await tx.prestamoEmpleado.findUnique({
        where: { id: c.prestamoId },
        include: { aplicaciones: true },
      });
      if (!prestamo) continue;
      if (prestamo.aplicaciones.length === 0 && prestamo.movimientoId == null) {
        // Nadie lo tocó ni se pagó aún; podemos eliminarlo.
        await tx.prestamoEmpleado.delete({ where: { id: c.prestamoId } });
      }
    }
  }

  /**
   * Reparte el monto a pagar entre las obras según los conceptos positivos.
   * - Si todos los positivos apuntan a la obra de la liquidación: una sola imputación 100%.
   * - Si hay conceptos con obraId distinto: se arma el mapa obra → monto y
   *   se saca el porcentaje proporcional. Ajuste de redondeo sobre la última.
   */
  private calcularImputacionesPorObra(
    liq: Awaited<ReturnType<LiquidacionesService['findOne']>>,
    montoAPagar: Prisma.Decimal,
  ): Array<{ obraId: string; monto: number; porcentaje: number }> {
    const obraPorDefecto = liq.obraId;
    const positivosPorObra = new Map<string, Prisma.Decimal>();
    let totalPositivos = new Prisma.Decimal(0);

    for (const item of liq.items) {
      for (const c of item.conceptos) {
        const signo = SIGNO_POR_TIPO[c.tipo];
        if (signo !== 1) continue;
        const obraId = c.obraId ?? obraPorDefecto;
        const monto = new Prisma.Decimal(c.monto).abs();
        positivosPorObra.set(
          obraId,
          (positivosPorObra.get(obraId) ?? new Prisma.Decimal(0)).plus(monto),
        );
        totalPositivos = totalPositivos.plus(monto);
      }
    }

    // Caso borde: no hay positivos (todos los items son NOTA_SALDO o solo descuentos).
    // Pagar con una única imputación 100% a la obra de la liquidación.
    if (totalPositivos.lte(0)) {
      return [
        {
          obraId: obraPorDefecto,
          monto: Number(montoAPagar.toFixed(2)),
          porcentaje: 100,
        },
      ];
    }

    const resultado: Array<{ obraId: string; monto: number; porcentaje: number }> = [];
    const entries = [...positivosPorObra.entries()];
    let acumuladoMonto = new Prisma.Decimal(0);
    let acumuladoPct = new Prisma.Decimal(0);

    for (let i = 0; i < entries.length; i++) {
      const [obraId, aporte] = entries[i];
      const esUltima = i === entries.length - 1;
      let montoObra: Prisma.Decimal;
      let pctObra: Prisma.Decimal;

      if (esUltima) {
        // Absorbe el redondeo
        montoObra = montoAPagar.minus(acumuladoMonto);
        pctObra = new Prisma.Decimal(100).minus(acumuladoPct);
      } else {
        const proporcion = aporte.div(totalPositivos);
        montoObra = montoAPagar.mul(proporcion);
        montoObra = new Prisma.Decimal(montoObra.toFixed(2));
        pctObra = proporcion.mul(100);
        pctObra = new Prisma.Decimal(pctObra.toFixed(4));
        acumuladoMonto = acumuladoMonto.plus(montoObra);
        acumuladoPct = acumuladoPct.plus(pctObra);
      }

      resultado.push({
        obraId,
        monto: Number(montoObra.toFixed(2)),
        porcentaje: Number(pctObra.toFixed(4)),
      });
    }
    return resultado;
  }

  private async recalcularTotales(
    tx: Prisma.TransactionClient,
    liquidacionId: string,
    userId: string,
  ) {
    const items = await tx.liquidacionItem.findMany({
      where: { liquidacionId },
      include: { conceptos: true },
    });

    let totalBruto = new Prisma.Decimal(0);
    let totalDescuentos = new Prisma.Decimal(0);
    let totalAPagar = new Prisma.Decimal(0);
    for (const item of items) {
      totalAPagar = totalAPagar.plus(item.aPagar);
      for (const c of item.conceptos) {
        const signo = SIGNO_POR_TIPO[c.tipo];
        if (signo === 1) totalBruto = totalBruto.plus(new Prisma.Decimal(c.monto).abs());
        if (signo === -1) totalDescuentos = totalDescuentos.plus(new Prisma.Decimal(c.monto).abs());
      }
    }
    const totalPagado = items
      .filter((i) => i.pagado)
      .reduce((acc, i) => acc.plus(i.aPagar), new Prisma.Decimal(0));

    await tx.liquidacionSemanal.update({
      where: { id: liquidacionId },
      data: { totalBruto, totalDescuentos, totalAPagar, totalPagado, updatedById: userId },
    });
  }
}
