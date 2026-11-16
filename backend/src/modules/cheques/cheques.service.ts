import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Caja,
  CotizacionTipo,
  EstadoCheque,
  EstadoMovimiento,
  FuenteCotizacion,
  MedioPago,
  Moneda,
  OrigenMovimiento,
  Prisma,
  TipoCaja,
  TipoCheque,
  TipoMovimiento,
} from '@prisma/client';
import { arsAUsd, usdAArs } from '@cardi/shared';
import { assertTransition } from '../../common/state-machines';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';
import type {
  CambiarEstadoChequeDto,
  CreateChequeDto,
  FiltrosChequeDto,
  UpdateChequeDto,
} from './dto/cheques.dto';

// Estados válidos iniciales según el tipo del cheque.
// Propio: EMITIDO (lo libré yo). Tercero: EN_CARTERA (me lo dieron).
const ESTADO_INICIAL: Record<TipoCheque, EstadoCheque> = {
  PROPIO: EstadoCheque.EMITIDO,
  TERCERO: EstadoCheque.EN_CARTERA,
};

@Injectable()
export class ChequesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
    private readonly cotizaciones: CotizacionesService,
  ) {}

  findAll(filtros: FiltrosChequeDto) {
    const where: Prisma.ChequeWhereInput = {};
    if (filtros.tipo) where.tipo = filtros.tipo;
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.beneficiarioId) where.beneficiarioId = filtros.beneficiarioId;
    if (filtros.desde || filtros.hasta) {
      where.fechaPago = { gte: filtros.desde, lte: filtros.hasta };
    }
    if (filtros.q) {
      where.OR = [
        { numero: { contains: filtros.q, mode: 'insensitive' } },
        { banco: { contains: filtros.q, mode: 'insensitive' } },
        { titular: { contains: filtros.q, mode: 'insensitive' } },
        { librador: { contains: filtros.q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.cheque.findMany({
      where,
      orderBy: [{ fechaPago: 'asc' }, { createdAt: 'desc' }],
      include: { beneficiario: { select: { id: true, nombre: true, tipo: true } } },
    });
  }

  async findOne(id: string) {
    const cheque = await this.prisma.cheque.findUnique({
      where: { id },
      include: {
        beneficiario: true,
        movimientos: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!cheque) throw new NotFoundException('Cheque no encontrado');
    return cheque;
  }

  async create(dto: CreateChequeDto, userId: string) {
    // Para TERCERO: resolver la caja CHEQUES_TERCEROS destino del ingreso.
    // Para PROPIO: por ahora no se genera movimiento (diferido: ver R4/R5 del
    // exploration doc — el cheque propio toca banco al debitarse, no al emitirse).
    let cajaDestino: Caja | null = null;
    if (dto.tipo === TipoCheque.TERCERO) {
      cajaDestino = await this.resolverCajaCheques(dto.cajaIngresoId, dto.moneda);
    }

    if (dto.obraIngresoId) {
      const obra = await this.prisma.obra.findUnique({ where: { id: dto.obraIngresoId } });
      if (!obra || !obra.activo) {
        throw new BadRequestException('La obra indicada no existe o está inactiva');
      }
    }

    const { cotizacion, cotizacionTipo } = cajaDestino
      ? await this.resolverCotizacion()
      : { cotizacion: 0, cotizacionTipo: CotizacionTipo.MANUAL };

    const { creado, movimiento } = await this.prisma.$transaction(async (tx) => {
      const cheque = await tx.cheque.create({
        data: {
          tipo: dto.tipo,
          numero: dto.numero.trim(),
          banco: dto.banco,
          sucursal: dto.sucursal,
          librador: dto.librador,
          titular: dto.titular,
          cuit: dto.cuit,
          monto: new Prisma.Decimal(dto.monto),
          moneda: dto.moneda,
          fechaEmision: dto.fechaEmision,
          fechaPago: dto.fechaPago,
          estado: ESTADO_INICIAL[dto.tipo],
          beneficiarioId: dto.beneficiarioId,
          observaciones: dto.observaciones,
          createdById: userId,
          updatedById: userId,
        },
        include: { beneficiario: true },
      });

      let mov = null;
      if (cajaDestino) {
        const { montoArs, montoUsd } = this.convertirMontos(
          dto.monto,
          cajaDestino.moneda,
          cotizacion,
        );
        mov = await tx.movimiento.create({
          data: {
            tipo: TipoMovimiento.INGRESO,
            fecha: dto.fechaEmision,
            cajaId: cajaDestino.id,
            moneda: cajaDestino.moneda,
            monto: new Prisma.Decimal(dto.monto),
            medioPago: MedioPago.CHEQUE_TERCERO,
            descripcion: this.descripcionCheque(cheque),
            cotizacion: new Prisma.Decimal(cotizacion),
            cotizacionTipo,
            montoArs: new Prisma.Decimal(montoArs),
            montoUsd: new Prisma.Decimal(montoUsd),
            beneficiarioId: dto.beneficiarioId,
            obraIngresoId: dto.obraIngresoId,
            chequeId: cheque.id,
            origen: OrigenMovimiento.MANUAL,
            origenId: cheque.id,
            estado: EstadoMovimiento.CONFIRMADO,
            createdById: userId,
            updatedById: userId,
          },
        });
      }

      return { creado: cheque, movimiento: mov };
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Cheque',
      entidadId: creado.id,
      despues: { ...creado, movimientoIngresoId: movimiento?.id } as unknown,
      observacion: movimiento
        ? `Ingreso ${movimiento.id} generado en ${cajaDestino?.nombre}`
        : undefined,
    });
    return creado;
  }

  // =========== Helpers para generar el ingreso del cheque TERCERO ===========

  private async resolverCajaCheques(cajaIdSugerida: string | undefined, moneda: Moneda) {
    if (cajaIdSugerida) {
      const caja = await this.prisma.caja.findUnique({ where: { id: cajaIdSugerida } });
      if (!caja || !caja.activo) {
        throw new BadRequestException('La caja indicada no existe o está inactiva');
      }
      if (caja.tipo !== TipoCaja.CHEQUES_TERCEROS) {
        throw new BadRequestException(
          `La caja ${caja.nombre} no es de tipo CHEQUES_TERCEROS`,
        );
      }
      if (caja.moneda !== moneda) {
        throw new BadRequestException(
          `El cheque es ${moneda} pero la caja está en ${caja.moneda}`,
        );
      }
      return caja;
    }
    // Auto-detectar la única caja CHEQUES_TERCEROS activa de esa moneda
    const candidatas = await this.prisma.caja.findMany({
      where: { tipo: TipoCaja.CHEQUES_TERCEROS, moneda, activo: true },
    });
    if (candidatas.length === 0) {
      throw new BadRequestException(
        `No hay ninguna caja CHEQUES_TERCEROS en ${moneda}. Creala primero en Billetera → Cuentas.`,
      );
    }
    if (candidatas.length > 1) {
      throw new BadRequestException(
        `Hay ${candidatas.length} cajas CHEQUES_TERCEROS en ${moneda}: especificá cuál usar.`,
      );
    }
    return candidatas[0];
  }

  private descripcionCheque(cheque: {
    numero: string;
    banco: string | null;
    librador: string | null;
    titular: string | null;
  }): string {
    const partes = [`Cheque N° ${cheque.numero}`];
    if (cheque.banco) partes.push(cheque.banco);
    const emisor = cheque.librador ?? cheque.titular;
    if (emisor) partes.push(emisor);
    return partes.join(' · ');
  }

  private async resolverCotizacion(): Promise<{
    cotizacion: number;
    cotizacionTipo: CotizacionTipo;
  }> {
    const ultima = await this.cotizaciones.ultimaCotizacion('BLUE');
    if (ultima) {
      return {
        cotizacion: Number(ultima.venta),
        cotizacionTipo:
          ultima.fuente === FuenteCotizacion.MANUAL
            ? CotizacionTipo.MANUAL
            : CotizacionTipo.BLUE_VENTA,
      };
    }
    try {
      const res = await this.cotizaciones.getBlueHoy();
      const c = res.cotizaciones[0];
      return {
        cotizacion: c.venta,
        cotizacionTipo:
          c.fuente === FuenteCotizacion.MANUAL
            ? CotizacionTipo.MANUAL
            : CotizacionTipo.BLUE_VENTA,
      };
    } catch {
      throw new BadRequestException(
        'No se pudo obtener la cotización. Cargá una manualmente desde Cotización.',
      );
    }
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

  async update(id: string, dto: UpdateChequeDto, userId: string) {
    const antes = await this.findOne(id);
    const despues = await this.prisma.cheque.update({
      where: { id },
      data: { ...dto, updatedById: userId },
      include: { beneficiario: true },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'Cheque',
      entidadId: id,
      antes: antes as unknown,
      despues: despues as unknown,
    });
    return despues;
  }

  async cambiarEstado(id: string, dto: CambiarEstadoChequeDto, userId: string) {
    const actual = await this.findOne(id);
    assertTransition('Cheque', actual.estado, dto.estado);

    // Validaciones extra por tipo
    if (actual.tipo === 'PROPIO' && ['DEPOSITADO', 'COBRADO'].includes(dto.estado)) {
      throw new BadRequestException(
        `Un cheque PROPIO no puede pasar a ${dto.estado} (solo DEBITADO)`,
      );
    }
    if (actual.tipo === 'TERCERO' && ['EMITIDO', 'DEBITADO'].includes(dto.estado)) {
      throw new BadRequestException(
        `Un cheque TERCERO no puede pasar a ${dto.estado}`,
      );
    }

    const nuevaObs = dto.observacion
      ? `${actual.observaciones ? actual.observaciones + '\n' : ''}[${dto.estado}] ${dto.observacion}`
      : actual.observaciones;

    // Si se está anulando un cheque TERCERO que estaba EN_CARTERA, revertir
    // el INGRESO asociado (si existe). Para los anulados desde otros estados
    // no tocamos los movimientos — ese análisis queda para una iteración
    // futura porque implica decisiones sobre reversas de egresos ya emitidos.
    const anuladoDesdeCartera =
      dto.estado === EstadoCheque.ANULADO &&
      actual.estado === EstadoCheque.EN_CARTERA &&
      actual.tipo === TipoCheque.TERCERO;

    const despues = await this.prisma.$transaction(async (tx) => {
      if (anuladoDesdeCartera) {
        const ingresos = actual.movimientos.filter(
          (m) =>
            m.tipo === TipoMovimiento.INGRESO &&
            m.estado === EstadoMovimiento.CONFIRMADO,
        );
        for (const ing of ingresos) {
          await tx.movimiento.update({
            where: { id: ing.id },
            data: {
              estado: EstadoMovimiento.ANULADO,
              anuladoAt: new Date(),
              anuladoPorId: userId,
              motivoAnulacion: `Cheque anulado${dto.observacion ? ': ' + dto.observacion : ''}`,
              updatedById: userId,
            },
          });
          await tx.movimiento.create({
            data: {
              tipo: TipoMovimiento.EGRESO,
              fecha: new Date(),
              cajaId: ing.cajaId,
              moneda: ing.moneda,
              monto: ing.monto,
              medioPago: ing.medioPago,
              descripcion: `Reversa · ${ing.descripcion ?? ''}`.trim(),
              cotizacion: ing.cotizacion,
              cotizacionTipo: ing.cotizacionTipo,
              montoArs: ing.montoArs,
              montoUsd: ing.montoUsd,
              beneficiarioId: ing.beneficiarioId,
              categoriaId: ing.categoriaId,
              movimientoOriginalId: ing.id,
              grupoId: ing.grupoId,
              origen: ing.origen,
              origenId: ing.origenId,
              estado: EstadoMovimiento.REVERSA,
              createdById: userId,
              updatedById: userId,
            },
          });
        }
      }
      return tx.cheque.update({
        where: { id },
        data: { estado: dto.estado, observaciones: nuevaObs, updatedById: userId },
        include: { beneficiario: true },
      });
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'Cheque',
      entidadId: id,
      antes: actual as unknown,
      despues: despues as unknown,
      observacion: anuladoDesdeCartera
        ? `Cambio estado → ${dto.estado} (ingreso revertido)`
        : `Cambio estado → ${dto.estado}`,
    });
    return despues;
  }
}
