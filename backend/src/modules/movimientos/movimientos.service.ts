import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CotizacionTipo,
  EstadoMovimiento,
  FuenteCotizacion,
  MedioPago,
  Moneda,
  OrigenMovimiento,
  Prisma,
  TipoMovimiento,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { arsAUsd, repartirMonto, usdAArs } from '@cardi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';
import type {
  AnularMovimientoDto,
  CambioMonedaDto,
  CrearEgresoDto,
  CrearIngresoDto,
  FiltrosMovimientoDto,
  TransferirDto,
} from './dto/movimientos.dto';

/**
 * Servicio de movimientos (libro único de la billetera).
 *
 * Patrón tomado de `sistemaCocGuana/backend/src/tesoreria/tesoreria.service.ts`,
 * adaptado a Cardi:
 * - Cotización congelada en cada movimiento (monto en ambas monedas).
 * - Anulación por REVERSA (nunca se edita o borra un CONFIRMADO).
 * - Transferencia y cambio de moneda: pares INGRESO+EGRESO con mismo grupoId.
 * - Imputación N obras (nuevo vs Cocoguana): validada con `repartirMonto`
 *   de @cardi/shared para que la suma cierre exacto.
 */
@Injectable()
export class MovimientosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cotizaciones: CotizacionesService,
    private readonly audit: AuditoriaService,
  ) {}

  // ================= LISTADOS =================

  async findAll(filtros: FiltrosMovimientoDto) {
    const where: Prisma.MovimientoWhereInput = {};
    if (filtros.cajaId) where.cajaId = filtros.cajaId;
    if (filtros.tipo) where.tipo = filtros.tipo as TipoMovimiento;
    if (filtros.beneficiarioId) where.beneficiarioId = filtros.beneficiarioId;
    if (filtros.categoriaId) where.categoriaId = filtros.categoriaId;
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.origen) where.origen = filtros.origen;
    if (filtros.desde || filtros.hasta) {
      where.fecha = {
        gte: filtros.desde,
        lte: filtros.hasta,
      };
    }
    if (filtros.obraId) {
      where.imputaciones = { some: { obraId: filtros.obraId } };
    }
    if (filtros.q) {
      where.descripcion = { contains: filtros.q, mode: 'insensitive' };
    }
    const [total, data] = await this.prisma.$transaction([
      this.prisma.movimiento.count({ where }),
      this.prisma.movimiento.findMany({
        where,
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        skip: (filtros.page - 1) * filtros.pageSize,
        take: filtros.pageSize,
        include: {
          caja: true,
          beneficiario: true,
          categoria: true,
          imputaciones: { include: { obra: true } },
          cheque: true,
        },
      }),
    ]);
    return { total, page: filtros.page, pageSize: filtros.pageSize, data };
  }

  async findOne(id: string) {
    const mov = await this.prisma.movimiento.findUnique({
      where: { id },
      include: {
        caja: true,
        beneficiario: true,
        categoria: true,
        imputaciones: { include: { obra: true } },
        cheque: true,
        recibo: true,
      },
    });
    if (!mov) throw new NotFoundException('Movimiento no encontrado');
    return mov;
  }

  // ================= EGRESO =================

  async crearEgreso(dto: CrearEgresoDto, userId: string) {
    const caja = await this.prisma.caja.findUnique({ where: { id: dto.cajaId } });
    if (!caja || !caja.activo) throw new BadRequestException('Caja inválida o inactiva');

    const { cotizacion, cotizacionTipo } = await this.resolverCotizacion(
      dto.cotizacion,
      dto.cotizacionTipo,
    );

    // Valida imputaciones ANTES de abrir la transacción.
    const imputaciones = repartirMonto(dto.monto, dto.imputaciones);
    await this.validarObrasActivas(imputaciones.map((i) => i.obraId));

    const { montoArs, montoUsd } = this.convertirMontos(dto.monto, caja.moneda, cotizacion);

    const grupoId = randomUUID();
    const mov = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.movimiento.create({
        data: {
          tipo: TipoMovimiento.EGRESO,
          fecha: dto.fecha,
          cajaId: caja.id,
          moneda: caja.moneda,
          monto: new Prisma.Decimal(dto.monto),
          medioPago: dto.medioPago,
          descripcion: dto.descripcion,
          cotizacion: new Prisma.Decimal(cotizacion),
          cotizacionTipo,
          montoArs: new Prisma.Decimal(montoArs),
          montoUsd: new Prisma.Decimal(montoUsd),
          beneficiarioId: dto.beneficiarioId,
          categoriaId: dto.categoriaId,
          chequeId: dto.chequeId,
          grupoId,
          origen: OrigenMovimiento.MANUAL,
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
        include: { imputaciones: true, caja: true },
      });
      return creado;
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Movimiento',
      entidadId: mov.id,
      despues: { ...mov, imputaciones: mov.imputaciones } as unknown,
    });
    return mov;
  }

  // ================= INGRESO =================

  async crearIngreso(dto: CrearIngresoDto, userId: string) {
    const caja = await this.prisma.caja.findUnique({ where: { id: dto.cajaId } });
    if (!caja || !caja.activo) throw new BadRequestException('Caja inválida o inactiva');

    const { cotizacion, cotizacionTipo } = await this.resolverCotizacion(
      dto.cotizacion,
      dto.cotizacionTipo,
    );
    const { montoArs, montoUsd } = this.convertirMontos(dto.monto, caja.moneda, cotizacion);

    const mov = await this.prisma.movimiento.create({
      data: {
        tipo: TipoMovimiento.INGRESO,
        fecha: dto.fecha,
        cajaId: caja.id,
        moneda: caja.moneda,
        monto: new Prisma.Decimal(dto.monto),
        medioPago: dto.medioPago,
        descripcion: dto.descripcion,
        cotizacion: new Prisma.Decimal(cotizacion),
        cotizacionTipo,
        montoArs: new Prisma.Decimal(montoArs),
        montoUsd: new Prisma.Decimal(montoUsd),
        beneficiarioId: dto.beneficiarioId,
        categoriaId: dto.categoriaId,
        obraIngresoId: dto.obraIngresoId,
        origen: OrigenMovimiento.MANUAL,
        estado: EstadoMovimiento.CONFIRMADO,
        createdById: userId,
        updatedById: userId,
      },
      include: { caja: true },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Movimiento',
      entidadId: mov.id,
      despues: mov as unknown,
    });
    return mov;
  }

  // ================= TRANSFERENCIA entre cajas (misma moneda) =================

  async transferir(dto: TransferirDto, userId: string) {
    const [origen, destino] = await Promise.all([
      this.prisma.caja.findUnique({ where: { id: dto.cajaOrigenId } }),
      this.prisma.caja.findUnique({ where: { id: dto.cajaDestinoId } }),
    ]);
    if (!origen || !destino) throw new NotFoundException('Caja no encontrada');
    if (!origen.activo || !destino.activo) throw new BadRequestException('Caja inactiva');
    if (origen.moneda !== destino.moneda) {
      throw new BadRequestException(
        'Transferencia entre cajas de distinta moneda: usar el endpoint de cambio de moneda',
      );
    }

    const { cotizacion, cotizacionTipo } = await this.resolverCotizacion();
    const { montoArs, montoUsd } = this.convertirMontos(dto.monto, origen.moneda, cotizacion);
    const desc = dto.descripcion ?? `Transferencia ${origen.nombre} → ${destino.nombre}`;
    const grupoId = randomUUID();

    const [salida, entrada] = await this.prisma.$transaction(async (tx) => {
      const egreso = await tx.movimiento.create({
        data: {
          tipo: TipoMovimiento.EGRESO,
          fecha: dto.fecha,
          cajaId: origen.id,
          moneda: origen.moneda,
          monto: new Prisma.Decimal(dto.monto),
          medioPago: MedioPago.TRANSFERENCIA,
          descripcion: `${desc} (salida)`,
          cotizacion: new Prisma.Decimal(cotizacion),
          cotizacionTipo,
          montoArs: new Prisma.Decimal(montoArs),
          montoUsd: new Prisma.Decimal(montoUsd),
          grupoId,
          origen: OrigenMovimiento.MANUAL,
          estado: EstadoMovimiento.CONFIRMADO,
          createdById: userId,
          updatedById: userId,
        },
      });
      const ingreso = await tx.movimiento.create({
        data: {
          tipo: TipoMovimiento.INGRESO,
          fecha: dto.fecha,
          cajaId: destino.id,
          moneda: destino.moneda,
          monto: new Prisma.Decimal(dto.monto),
          medioPago: MedioPago.TRANSFERENCIA,
          descripcion: `${desc} (entrada)`,
          cotizacion: new Prisma.Decimal(cotizacion),
          cotizacionTipo,
          montoArs: new Prisma.Decimal(montoArs),
          montoUsd: new Prisma.Decimal(montoUsd),
          grupoId,
          origen: OrigenMovimiento.MANUAL,
          estado: EstadoMovimiento.CONFIRMADO,
          createdById: userId,
          updatedById: userId,
        },
      });
      return [egreso, ingreso];
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Movimiento',
      entidadId: grupoId,
      despues: { salida, entrada } as unknown,
      observacion: 'Transferencia',
    });
    return { salida, entrada };
  }

  // ================= CAMBIO DE MONEDA =================

  async cambioMoneda(dto: CambioMonedaDto, userId: string) {
    const [origen, destino] = await Promise.all([
      this.prisma.caja.findUnique({ where: { id: dto.cajaOrigenId } }),
      this.prisma.caja.findUnique({ where: { id: dto.cajaDestinoId } }),
    ]);
    if (!origen || !destino) throw new NotFoundException('Caja no encontrada');
    if (!origen.activo || !destino.activo) throw new BadRequestException('Caja inactiva');
    if (origen.moneda === destino.moneda) {
      throw new BadRequestException(
        'Ambas cajas tienen la misma moneda: usar el endpoint de transferencia',
      );
    }
    const desc = dto.descripcion ?? `Cambio ${origen.moneda} → ${destino.moneda}`;
    const grupoId = randomUUID();

    const [salida, entrada] = await this.prisma.$transaction(async (tx) => {
      const egreso = await tx.movimiento.create({
        data: {
          tipo: TipoMovimiento.EGRESO,
          fecha: dto.fecha,
          cajaId: origen.id,
          moneda: origen.moneda,
          monto: new Prisma.Decimal(dto.montoOrigen),
          medioPago: MedioPago.TRANSFERENCIA,
          descripcion: `${desc} (salida)`,
          cotizacion: new Prisma.Decimal(dto.cotizacion),
          cotizacionTipo: dto.cotizacionTipo,
          montoArs: new Prisma.Decimal(
            this.convertirMontos(dto.montoOrigen, origen.moneda, dto.cotizacion).montoArs,
          ),
          montoUsd: new Prisma.Decimal(
            this.convertirMontos(dto.montoOrigen, origen.moneda, dto.cotizacion).montoUsd,
          ),
          grupoId,
          origen: OrigenMovimiento.MANUAL,
          estado: EstadoMovimiento.CONFIRMADO,
          createdById: userId,
          updatedById: userId,
        },
      });
      const ingreso = await tx.movimiento.create({
        data: {
          tipo: TipoMovimiento.INGRESO,
          fecha: dto.fecha,
          cajaId: destino.id,
          moneda: destino.moneda,
          monto: new Prisma.Decimal(dto.montoDestino),
          medioPago: MedioPago.TRANSFERENCIA,
          descripcion: `${desc} (entrada)`,
          cotizacion: new Prisma.Decimal(dto.cotizacion),
          cotizacionTipo: dto.cotizacionTipo,
          montoArs: new Prisma.Decimal(
            this.convertirMontos(dto.montoDestino, destino.moneda, dto.cotizacion).montoArs,
          ),
          montoUsd: new Prisma.Decimal(
            this.convertirMontos(dto.montoDestino, destino.moneda, dto.cotizacion).montoUsd,
          ),
          grupoId,
          origen: OrigenMovimiento.MANUAL,
          estado: EstadoMovimiento.CONFIRMADO,
          createdById: userId,
          updatedById: userId,
        },
      });
      return [egreso, ingreso];
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Movimiento',
      entidadId: grupoId,
      despues: { salida, entrada } as unknown,
      observacion: 'Cambio de moneda',
    });
    return { salida, entrada };
  }

  // ================= ANULACIÓN POR REVERSA =================

  async anular(id: string, dto: AnularMovimientoDto, userId: string) {
    const original = await this.prisma.movimiento.findUnique({
      where: { id },
      include: { imputaciones: true },
    });
    if (!original) throw new NotFoundException('Movimiento no encontrado');
    if (original.estado !== EstadoMovimiento.CONFIRMADO) {
      throw new BadRequestException(
        `Solo se pueden anular movimientos CONFIRMADOS (actual: ${original.estado})`,
      );
    }

    const tipoReversa =
      original.tipo === TipoMovimiento.INGRESO
        ? TipoMovimiento.EGRESO
        : original.tipo === TipoMovimiento.EGRESO
          ? TipoMovimiento.INGRESO
          : null;
    if (!tipoReversa) {
      throw new BadRequestException(
        `Tipo ${original.tipo} no soporta anulación individual — anular el grupo`,
      );
    }

    const { original: actualizado, reversa } = await this.prisma.$transaction(async (tx) => {
      const reversa = await tx.movimiento.create({
        data: {
          tipo: tipoReversa,
          fecha: new Date(),
          cajaId: original.cajaId,
          moneda: original.moneda,
          monto: original.monto,
          medioPago: original.medioPago,
          descripcion: `Reversa · ${original.descripcion ?? ''}`.trim(),
          cotizacion: original.cotizacion,
          cotizacionTipo: original.cotizacionTipo,
          montoArs: original.montoArs,
          montoUsd: original.montoUsd,
          beneficiarioId: original.beneficiarioId,
          categoriaId: original.categoriaId,
          movimientoOriginalId: original.id,
          grupoId: original.grupoId,
          origen: original.origen,
          origenId: original.origenId,
          estado: EstadoMovimiento.REVERSA,
          createdById: userId,
          updatedById: userId,
          // Las imputaciones de la reversa son las mismas pero con signo lógico opuesto.
          // Al calcular gasto por obra, los EGRESO suman y las REVERSAS de EGRESO (que
          // son del tipo INGRESO) se consideran por su tipo => se cancela automáticamente.
          imputaciones: {
            create: original.imputaciones.map((i) => ({
              obraId: i.obraId,
              monto: i.monto,
              porcentaje: i.porcentaje,
            })),
          },
        },
      });
      const actualizadoAnulado = await tx.movimiento.update({
        where: { id: original.id },
        data: {
          estado: EstadoMovimiento.ANULADO,
          anuladoAt: new Date(),
          anuladoPorId: userId,
          motivoAnulacion: dto.motivo,
          updatedById: userId,
        },
      });
      return { original: actualizadoAnulado, reversa };
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ANULAR',
      entidad: 'Movimiento',
      entidadId: id,
      antes: original as unknown,
      despues: actualizado as unknown,
      observacion: dto.motivo,
    });
    return { original: actualizado, reversa };
  }

  // ================= HELPERS =================

  private async resolverCotizacion(
    cotizacionExplicita?: number,
    tipoExplicito?: CotizacionTipo,
  ): Promise<{ cotizacion: number; cotizacionTipo: CotizacionTipo }> {
    if (cotizacionExplicita) {
      return {
        cotizacion: cotizacionExplicita,
        cotizacionTipo: tipoExplicito ?? CotizacionTipo.MANUAL,
      };
    }
    // Buscar en BD
    const ultima = await this.cotizaciones.ultimaCotizacion('BLUE');
    if (ultima) {
      return {
        cotizacion: Number(ultima.venta),
        cotizacionTipo: this.mapearTipoBlueAVenta(ultima.fuente),
      };
    }
    // Buscar en API
    try {
      const res = await this.cotizaciones.getBlueHoy();
      const c = res.cotizaciones[0];
      return {
        cotizacion: c.venta,
        cotizacionTipo: this.mapearTipoBlueAVenta(c.fuente),
      };
    } catch {
      throw new BadRequestException(
        'No se pudo obtener la cotización. Cargá una manualmente o reintenta más tarde.',
      );
    }
  }

  private mapearTipoBlueAVenta(fuente: FuenteCotizacion): CotizacionTipo {
    // En v1 todas las cotizaciones de referencia son blue venta.
    return fuente === FuenteCotizacion.MANUAL
      ? CotizacionTipo.MANUAL
      : CotizacionTipo.BLUE_VENTA;
  }

  private convertirMontos(
    monto: number,
    moneda: Moneda,
    cotizacion: number,
  ): { montoArs: string; montoUsd: string } {
    if (moneda === Moneda.ARS) {
      return {
        montoArs: monto.toFixed(2),
        montoUsd: arsAUsd(monto, cotizacion).toFixed(2),
      };
    }
    return {
      montoArs: usdAArs(monto, cotizacion).toFixed(2),
      montoUsd: monto.toFixed(2),
    };
  }

  private async validarObrasActivas(obraIds: string[]) {
    const unicas = [...new Set(obraIds)];
    const obras = await this.prisma.obra.findMany({ where: { id: { in: unicas } } });
    if (obras.length !== unicas.length) {
      throw new BadRequestException('Alguna obra no existe');
    }
    const inactivas = obras.filter((o) => !o.activo);
    if (inactivas.length > 0) {
      throw new BadRequestException(
        `Obras inactivas: ${inactivas.map((o) => o.nombre).join(', ')}`,
      );
    }
  }
}
