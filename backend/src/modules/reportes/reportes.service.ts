import { Injectable, Logger } from '@nestjs/common';
import { EstadoMovimiento, Moneda, Prisma, TipoMovimiento } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { formatearMonto } from '@cardi/shared';
import { PrismaService } from '../../prisma/prisma.service';

type FiltroPeriodo = {
  desde?: Date;
  hasta?: Date;
};

export type GastoPorObra = {
  obraId: string;
  nombre: string;
  tipo: string;
  estado: string;
  gastadoArs: string;
  gastadoUsd: string;
  contratado: string | null;
  monedaContrato: 'ARS' | 'USD' | null;
  restante: string | null;
  porcentajeConsumido: string | null;
};

@Injectable()
export class ReportesService {
  private readonly logger = new Logger(ReportesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reporte de gasto por obra: suma de imputaciones de egresos CONFIRMADOS
   * (descuenta reversas) en ARS y USD, usando la cotización congelada de
   * cada movimiento. Si la obra tiene montoContratado, calcula restante y %.
   */
  async gastoPorObra(filtros: FiltroPeriodo = {}): Promise<GastoPorObra[]> {
    const obras = await this.prisma.obra.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    const resultados: GastoPorObra[] = [];
    for (const obra of obras) {
      const totales = await this.totalesImputados(obra.id, filtros);
      const contratado = obra.montoContratado ? Number(obra.montoContratado) : null;
      const gastadoEnMoneda =
        obra.monedaContrato === Moneda.USD ? Number(totales.usd) : Number(totales.ars);
      const restante = contratado != null ? contratado - gastadoEnMoneda : null;
      const porcentajeConsumido =
        contratado && contratado > 0
          ? ((gastadoEnMoneda / contratado) * 100).toFixed(2)
          : null;

      resultados.push({
        obraId: obra.id,
        nombre: obra.nombre,
        tipo: obra.tipo,
        estado: obra.estado,
        gastadoArs: totales.ars,
        gastadoUsd: totales.usd,
        contratado: contratado != null ? contratado.toFixed(2) : null,
        monedaContrato: obra.monedaContrato,
        restante: restante != null ? restante.toFixed(2) : null,
        porcentajeConsumido,
      });
    }
    return resultados;
  }

  /**
   * Reporte agrupado por categoría (combustible, materiales, jornales, etc.)
   * en ARS y USD.
   */
  async gastoPorCategoria(filtros: FiltroPeriodo = {}) {
    const categorias = await this.prisma.categoriaGasto.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
    });

    const resultados: Array<{
      categoriaId: string;
      codigo: string;
      nombre: string;
      ars: string;
      usd: string;
      cantidad: number;
    }> = [];

    for (const cat of categorias) {
      const movs = await this.prisma.movimiento.findMany({
        where: {
          tipo: TipoMovimiento.EGRESO,
          estado: EstadoMovimiento.CONFIRMADO,
          categoriaId: cat.id,
          fecha: { gte: filtros.desde, lte: filtros.hasta },
        },
        select: { montoArs: true, montoUsd: true },
      });
      const ars = movs.reduce((acc, m) => acc.add(m.montoArs), new Prisma.Decimal(0));
      const usd = movs.reduce((acc, m) => acc.add(m.montoUsd), new Prisma.Decimal(0));
      resultados.push({
        categoriaId: cat.id,
        codigo: cat.codigo,
        nombre: cat.nombre,
        ars: ars.toFixed(2),
        usd: usd.toFixed(2),
        cantidad: movs.length,
      });
    }
    return resultados;
  }

  /**
   * Gasto de UNA obra desglosado por categoría.
   */
  async gastoObraPorCategoria(obraId: string, filtros: FiltroPeriodo = {}) {
    const obra = await this.prisma.obra.findUnique({ where: { id: obraId } });
    if (!obra) throw new Error('Obra no encontrada');

    const imputaciones = await this.prisma.imputacion.findMany({
      where: {
        obraId,
        movimiento: {
          tipo: TipoMovimiento.EGRESO,
          estado: { in: [EstadoMovimiento.CONFIRMADO, EstadoMovimiento.REVERSA] },
          fecha: { gte: filtros.desde, lte: filtros.hasta },
        },
      },
      include: {
        movimiento: {
          select: {
            estado: true,
            monto: true,
            montoArs: true,
            montoUsd: true,
            categoria: { select: { id: true, codigo: true, nombre: true } },
          },
        },
      },
    });

    const map = new Map<
      string,
      { id: string; codigo: string; nombre: string; ars: Prisma.Decimal; usd: Prisma.Decimal; cantidad: number }
    >();
    const SIN_CATEGORIA = '__sin__';
    for (const imp of imputaciones) {
      const signo = imp.movimiento.estado === EstadoMovimiento.REVERSA ? -1 : 1;
      const cat = imp.movimiento.categoria;
      const key = cat?.id ?? SIN_CATEGORIA;
      if (!map.has(key)) {
        map.set(key, {
          id: cat?.id ?? SIN_CATEGORIA,
          codigo: cat?.codigo ?? '—',
          nombre: cat?.nombre ?? 'Sin categoría',
          ars: new Prisma.Decimal(0),
          usd: new Prisma.Decimal(0),
          cantidad: 0,
        });
      }
      const entry = map.get(key)!;
      const parteArs = this.calcularParteArs(imp.monto, imp.movimiento.monto, imp.movimiento.montoArs);
      const parteUsd = this.calcularParteUsd(imp.monto, imp.movimiento.monto, imp.movimiento.montoUsd);
      entry.ars = entry.ars.add(new Prisma.Decimal(parteArs).mul(signo));
      entry.usd = entry.usd.add(new Prisma.Decimal(parteUsd).mul(signo));
      entry.cantidad += signo;
    }

    return [...map.values()]
      .map((e) => ({
        categoriaId: e.id,
        codigo: e.codigo,
        nombre: e.nombre,
        ars: e.ars.toFixed(2),
        usd: e.usd.toFixed(2),
        cantidad: e.cantidad,
      }))
      .sort((a, b) => Number(b.ars) - Number(a.ars));
  }

  /**
   * Gasto mensual de una obra en el período dado (para gráfico de evolución).
   */
  async gastoObraPorMes(obraId: string, filtros: FiltroPeriodo = {}) {
    const obra = await this.prisma.obra.findUnique({ where: { id: obraId } });
    if (!obra) throw new Error('Obra no encontrada');

    const imputaciones = await this.prisma.imputacion.findMany({
      where: {
        obraId,
        movimiento: {
          tipo: TipoMovimiento.EGRESO,
          estado: { in: [EstadoMovimiento.CONFIRMADO, EstadoMovimiento.REVERSA] },
          fecha: { gte: filtros.desde, lte: filtros.hasta },
        },
      },
      include: {
        movimiento: {
          select: { estado: true, monto: true, montoArs: true, montoUsd: true, fecha: true },
        },
      },
    });

    const map = new Map<string, { ars: Prisma.Decimal; usd: Prisma.Decimal; cantidad: number }>();
    for (const imp of imputaciones) {
      const signo = imp.movimiento.estado === EstadoMovimiento.REVERSA ? -1 : 1;
      const d = new Date(imp.movimiento.fecha);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, { ars: new Prisma.Decimal(0), usd: new Prisma.Decimal(0), cantidad: 0 });
      }
      const entry = map.get(key)!;
      const parteArs = this.calcularParteArs(imp.monto, imp.movimiento.monto, imp.movimiento.montoArs);
      const parteUsd = this.calcularParteUsd(imp.monto, imp.movimiento.monto, imp.movimiento.montoUsd);
      entry.ars = entry.ars.add(new Prisma.Decimal(parteArs).mul(signo));
      entry.usd = entry.usd.add(new Prisma.Decimal(parteUsd).mul(signo));
      entry.cantidad += signo;
    }

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({
        mes,
        ars: v.ars.toFixed(2),
        usd: v.usd.toFixed(2),
        cantidad: v.cantidad,
      }));
  }

  /**
   * Detalle de movimientos imputados a una obra en un período.
   */
  async detalleObra(obraId: string, filtros: FiltroPeriodo = {}) {
    const obra = await this.prisma.obra.findUnique({ where: { id: obraId } });
    if (!obra) throw new Error('Obra no encontrada');

    const imputaciones = await this.prisma.imputacion.findMany({
      where: {
        obraId,
        movimiento: {
          tipo: TipoMovimiento.EGRESO,
          estado: EstadoMovimiento.CONFIRMADO,
          fecha: { gte: filtros.desde, lte: filtros.hasta },
        },
      },
      include: {
        movimiento: {
          include: {
            beneficiario: { select: { nombre: true } },
            categoria: { select: { codigo: true, nombre: true } },
            caja: { select: { nombre: true, moneda: true } },
          },
        },
      },
      orderBy: { movimiento: { fecha: 'desc' } },
      take: 1000,
    });

    const totales = await this.totalesImputados(obraId, filtros);

    return {
      obra,
      totales,
      items: imputaciones.map((i) => ({
        fecha: i.movimiento.fecha,
        descripcion: i.movimiento.descripcion,
        beneficiario: i.movimiento.beneficiario?.nombre ?? null,
        categoria: i.movimiento.categoria
          ? `${i.movimiento.categoria.codigo} - ${i.movimiento.categoria.nombre}`
          : null,
        caja: i.movimiento.caja.nombre,
        moneda: i.movimiento.moneda,
        monto: i.monto.toString(),
        montoArs: this.calcularParteArs(i.monto, i.movimiento.monto, i.movimiento.montoArs),
        montoUsd: this.calcularParteUsd(i.monto, i.movimiento.monto, i.movimiento.montoUsd),
      })),
      totalItems: imputaciones.length,
    };
  }

  // =============== EXCEL EXPORTS ===============

  async gastoPorObraExcel(filtros: FiltroPeriodo = {}): Promise<ExcelJS.Buffer> {
    const datos = await this.gastoPorObra(filtros);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistema Cardi';
    wb.created = new Date();
    const ws = wb.addWorksheet('Gasto por obra');

    ws.columns = [
      { header: 'Obra', key: 'nombre', width: 30 },
      { header: 'Tipo', key: 'tipo', width: 15 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Gastado ARS', key: 'gastadoArs', width: 18, style: { numFmt: '#,##0.00' } },
      { header: 'Gastado USD', key: 'gastadoUsd', width: 18, style: { numFmt: '#,##0.00' } },
      { header: 'Contratado', key: 'contratado', width: 18, style: { numFmt: '#,##0.00' } },
      { header: 'Mon.', key: 'monedaContrato', width: 6 },
      { header: 'Restante', key: 'restante', width: 18, style: { numFmt: '#,##0.00' } },
      { header: '% Consumido', key: 'porcentajeConsumido', width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4390B6' },
    };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    datos.forEach((d) => {
      ws.addRow({
        nombre: d.nombre,
        tipo: d.tipo,
        estado: d.estado,
        gastadoArs: Number(d.gastadoArs),
        gastadoUsd: Number(d.gastadoUsd),
        contratado: d.contratado ? Number(d.contratado) : null,
        monedaContrato: d.monedaContrato ?? '',
        restante: d.restante ? Number(d.restante) : null,
        porcentajeConsumido: d.porcentajeConsumido ? Number(d.porcentajeConsumido) + '%' : '',
      });
    });

    this.ponerPeriodoEnFila(ws, filtros);
    return wb.xlsx.writeBuffer();
  }

  async movimientosExcel(filtros: {
    cajaId?: string;
    obraId?: string;
    beneficiarioId?: string;
    desde?: Date;
    hasta?: Date;
  }): Promise<ExcelJS.Buffer> {
    const where: Prisma.MovimientoWhereInput = {
      estado: { in: [EstadoMovimiento.CONFIRMADO, EstadoMovimiento.REVERSA] },
    };
    if (filtros.cajaId) where.cajaId = filtros.cajaId;
    if (filtros.beneficiarioId) where.beneficiarioId = filtros.beneficiarioId;
    if (filtros.desde || filtros.hasta) {
      where.fecha = { gte: filtros.desde, lte: filtros.hasta };
    }
    if (filtros.obraId) {
      where.imputaciones = { some: { obraId: filtros.obraId } };
    }

    const movs = await this.prisma.movimiento.findMany({
      where,
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      include: {
        caja: { select: { nombre: true } },
        beneficiario: { select: { nombre: true } },
        categoria: { select: { codigo: true, nombre: true } },
        imputaciones: { include: { obra: { select: { nombre: true } } } },
      },
      take: 5000,
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistema Cardi';
    const ws = wb.addWorksheet('Movimientos');
    ws.columns = [
      { header: 'Fecha', key: 'fecha', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
      { header: 'Tipo', key: 'tipo', width: 10 },
      { header: 'Estado', key: 'estado', width: 12 },
      { header: 'Caja', key: 'caja', width: 20 },
      { header: 'Moneda', key: 'moneda', width: 8 },
      { header: 'Monto', key: 'monto', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Monto ARS', key: 'montoArs', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Monto USD', key: 'montoUsd', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Medio', key: 'medioPago', width: 15 },
      { header: 'Beneficiario', key: 'beneficiario', width: 25 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      { header: 'Obra(s)', key: 'obras', width: 30 },
      { header: 'Descripción', key: 'descripcion', width: 40 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4390B6' },
    };

    movs.forEach((m) => {
      ws.addRow({
        fecha: m.fecha,
        tipo: m.tipo,
        estado: m.estado,
        caja: m.caja.nombre,
        moneda: m.moneda,
        monto: Number(m.monto),
        montoArs: Number(m.montoArs),
        montoUsd: Number(m.montoUsd),
        medioPago: m.medioPago,
        beneficiario: m.beneficiario?.nombre ?? '',
        categoria: m.categoria ? `${m.categoria.codigo} ${m.categoria.nombre}` : '',
        obras: m.imputaciones.map((i) => i.obra.nombre).join(' / '),
        descripcion: m.descripcion ?? '',
      });
    });
    this.ponerPeriodoEnFila(ws, filtros);
    return wb.xlsx.writeBuffer();
  }

  // =============== HELPERS ===============

  private async totalesImputados(obraId: string, filtros: FiltroPeriodo) {
    const imputaciones = await this.prisma.imputacion.findMany({
      where: {
        obraId,
        movimiento: {
          tipo: TipoMovimiento.EGRESO,
          estado: { in: [EstadoMovimiento.CONFIRMADO, EstadoMovimiento.REVERSA] },
          fecha: { gte: filtros.desde, lte: filtros.hasta },
        },
      },
      include: {
        movimiento: {
          select: { estado: true, monto: true, montoArs: true, montoUsd: true },
        },
      },
    });
    let ars = new Prisma.Decimal(0);
    let usd = new Prisma.Decimal(0);
    for (const imp of imputaciones) {
      // Si es una REVERSA, resta (porque la contraparte INGRESO suma al tesoro)
      // En gasto por obra, la reversa de un EGRESO cancela el gasto.
      const signo = imp.movimiento.estado === EstadoMovimiento.REVERSA ? -1 : 1;
      const parteArs = this.calcularParteArs(imp.monto, imp.movimiento.monto, imp.movimiento.montoArs);
      const parteUsd = this.calcularParteUsd(imp.monto, imp.movimiento.monto, imp.movimiento.montoUsd);
      ars = ars.add(new Prisma.Decimal(parteArs).mul(signo));
      usd = usd.add(new Prisma.Decimal(parteUsd).mul(signo));
    }
    return { ars: ars.toFixed(2), usd: usd.toFixed(2) };
  }

  private calcularParteArs(
    montoImputacion: Prisma.Decimal,
    montoMovimiento: Prisma.Decimal,
    montoArsMovimiento: Prisma.Decimal,
  ): string {
    if (montoMovimiento.isZero()) return '0.00';
    const proporcion = montoImputacion.div(montoMovimiento);
    return montoArsMovimiento.mul(proporcion).toFixed(2);
  }

  private calcularParteUsd(
    montoImputacion: Prisma.Decimal,
    montoMovimiento: Prisma.Decimal,
    montoUsdMovimiento: Prisma.Decimal,
  ): string {
    if (montoMovimiento.isZero()) return '0.00';
    const proporcion = montoImputacion.div(montoMovimiento);
    return montoUsdMovimiento.mul(proporcion).toFixed(2);
  }

  private ponerPeriodoEnFila(ws: ExcelJS.Worksheet, filtros: FiltroPeriodo) {
    const desde = filtros.desde ? filtros.desde.toISOString().slice(0, 10) : '—';
    const hasta = filtros.hasta ? filtros.hasta.toISOString().slice(0, 10) : '—';
    ws.addRow([]);
    const row = ws.addRow([`Período: ${desde} al ${hasta}`]);
    row.font = { italic: true, color: { argb: 'FF666666' } };
    ws.addRow([`Generado: ${new Date().toISOString()}`]).font = {
      italic: true,
      color: { argb: 'FF666666' },
    };
    // Suprime el warning de que formatearMonto no se usa en runtime
    void formatearMonto;
  }
}
