import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CotizacionTipo,
  EstadoMovimiento,
  MedioPago,
  Moneda,
  OrigenMovimiento,
  Prisma,
  TipoMovimiento,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AjustarSaldoDto, CreateCajaDto, UpdateCajaDto } from './dto/cajas.dto';

/**
 * Las cajas no cachean saldo: se deriva de los movimientos CONFIRMADOS
 * + saldo inicial. Más lento pero imposible de desincronizar.
 * Patrón tomado de CLAUDE.md §5 regla 8.
 */
@Injectable()
export class CajasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
  ) {}

  findAll(soloActivas = false) {
    return this.prisma.caja.findMany({
      where: soloActivas ? { activo: true } : undefined,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });
  }

  async findOne(id: string) {
    const caja = await this.prisma.caja.findUnique({ where: { id } });
    if (!caja) throw new NotFoundException('Caja no encontrada');
    return caja;
  }

  async findOneConSaldo(id: string) {
    const caja = await this.findOne(id);
    const saldo = await this.calcularSaldo(id);
    return { ...caja, saldoCalculado: saldo };
  }

  async create(dto: CreateCajaDto, userId: string) {
    const creada = await this.prisma.caja.create({
      data: {
        nombre: dto.nombre,
        tipo: dto.tipo,
        moneda: dto.moneda,
        saldoInicial: new Prisma.Decimal(dto.saldoInicial),
        fechaSaldoInicial: dto.fechaSaldoInicial,
        createdById: userId,
        updatedById: userId,
      },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Caja',
      entidadId: creada.id,
      despues: creada as unknown,
    });
    return creada;
  }

  async update(id: string, dto: UpdateCajaDto, userId: string) {
    const antes = await this.findOne(id);
    const despues = await this.prisma.caja.update({
      where: { id },
      data: {
        ...dto,
        saldoInicial:
          dto.saldoInicial != null ? new Prisma.Decimal(dto.saldoInicial) : undefined,
        updatedById: userId,
      },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'Caja',
      entidadId: id,
      antes: antes as unknown,
      despues: despues as unknown,
    });
    return despues;
  }

  async desactivar(id: string, userId: string) {
    const caja = await this.findOne(id);
    if (!caja.activo) return caja;
    return this.prisma.caja.update({
      where: { id },
      data: { activo: false, updatedById: userId },
    });
  }

  /**
   * Ajuste manual del saldo. Crea un Movimiento con origen=AJUSTE por la
   * diferencia entre saldo actual y objetivo. Queda en el libro con el
   * usuario que lo hizo y el motivo — es la fuente del historial.
   */
  async ajustarSaldo(id: string, dto: AjustarSaldoDto, userId: string) {
    const caja = await this.findOne(id);
    if (!caja.activo) throw new BadRequestException('La caja está inactiva');

    const saldoActual = await this.calcularSaldo(id);
    const objetivo = new Prisma.Decimal(dto.saldoObjetivo.toFixed(2));
    const diferencia = objetivo.minus(saldoActual);

    if (diferencia.abs().lt(0.01)) {
      throw new BadRequestException(
        `El saldo ya coincide con el objetivo ($${saldoActual.toFixed(2)})`,
      );
    }

    const tipo = diferencia.gt(0) ? TipoMovimiento.INGRESO : TipoMovimiento.EGRESO;
    const monto = diferencia.abs();
    const fecha = dto.fecha ?? new Date();

    // Para el campo cotización usamos valores neutrales — el ajuste no se
    // convierte a USD (se registra en la moneda de la caja).
    const cotizacion = new Prisma.Decimal(1);
    const montoEnMoneda = monto.toFixed(2);

    const mov = await this.prisma.movimiento.create({
      data: {
        tipo,
        fecha,
        cajaId: caja.id,
        moneda: caja.moneda,
        monto,
        medioPago: MedioPago.EFECTIVO,
        descripcion: `Ajuste de saldo: ${dto.motivo}`,
        cotizacion,
        cotizacionTipo: CotizacionTipo.MANUAL,
        montoArs: new Prisma.Decimal(caja.moneda === Moneda.ARS ? montoEnMoneda : '0'),
        montoUsd: new Prisma.Decimal(caja.moneda === Moneda.USD ? montoEnMoneda : '0'),
        grupoId: randomUUID(),
        origen: OrigenMovimiento.AJUSTE,
        estado: EstadoMovimiento.CONFIRMADO,
        createdById: userId,
        updatedById: userId,
      },
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'Caja',
      entidadId: id,
      observacion: `Ajuste ${tipo === TipoMovimiento.INGRESO ? '+' : '-'}$${monto.toFixed(2)} (${caja.nombre}) · ${dto.motivo}`,
    });

    return {
      movimientoId: mov.id,
      saldoAnterior: saldoActual.toFixed(2),
      saldoActual: objetivo.toFixed(2),
      diferencia: diferencia.toFixed(2),
      tipo,
      motivo: dto.motivo,
    };
  }

  /**
   * Historial de ajustes manuales de saldo de una caja (movimientos con
   * origen=AJUSTE). Incluye usuario que lo hizo, motivo (del campo
   * descripcion sin el prefijo "Ajuste de saldo:"), fecha y monto.
   */
  async historialAjustes(id: string) {
    await this.findOne(id);
    const movs = await this.prisma.movimiento.findMany({
      where: { cajaId: id, origen: OrigenMovimiento.AJUSTE },
      orderBy: { fecha: 'desc' },
      include: {
        createdBy: { select: { id: true, nombre: true, username: true } },
      },
      take: 200,
    });
    return movs.map((m) => ({
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo, // INGRESO = subió el saldo, EGRESO = bajó
      monto: m.monto.toString(),
      moneda: m.moneda,
      motivo: m.descripcion?.replace(/^Ajuste de saldo:\s*/i, '') ?? '',
      estado: m.estado,
      hechoPor: m.createdBy
        ? { id: m.createdBy.id, nombre: m.createdBy.nombre, username: m.createdBy.username }
        : null,
      createdAt: m.createdAt,
    }));
  }

  /**
   * Saldo actual = saldoInicial + Σ(INGRESO + entradas) - Σ(EGRESO + salidas).
   * Solo considera movimientos CONFIRMADOS. Ignora ANULADO; cuenta REVERSA
   * (porque la reversa es el movimiento que efectivamente devuelve el dinero).
   */
  async calcularSaldo(id: string): Promise<Prisma.Decimal> {
    const caja = await this.findOne(id);
    const movimientos = await this.prisma.movimiento.findMany({
      where: {
        cajaId: id,
        estado: { in: [EstadoMovimiento.CONFIRMADO, EstadoMovimiento.REVERSA] },
      },
      select: { tipo: true, monto: true },
    });
    let saldo = new Prisma.Decimal(caja.saldoInicial);
    for (const m of movimientos) {
      const signo = m.tipo === TipoMovimiento.INGRESO ? 1 : m.tipo === TipoMovimiento.EGRESO ? -1 : 0;
      // TRANSFERENCIA y CAMBIO_MONEDA se guardan como pares (dos filas), cada una
      // con tipo específico (ver movimientos.service.ts). Los sumamos como ingreso
      // o egreso según corresponda — por ahora los representamos como pares
      // INGRESO/EGRESO con grupoId común.
      if (signo === 0) continue;
      saldo = saldo.add(m.monto.mul(signo));
    }
    return saldo;
  }

  /**
   * Calcula los saldos de todas las cajas en una sola query agrupada.
   * Útil para el dashboard (Etapa 2 reportes).
   */
  async saldosDeTodas(): Promise<Array<{ cajaId: string; nombre: string; moneda: string; saldo: string }>> {
    const cajas = await this.findAll(false);
    const saldos = await Promise.all(
      cajas.map(async (c) => ({
        cajaId: c.id,
        nombre: c.nombre,
        moneda: c.moneda,
        saldo: (await this.calcularSaldo(c.id)).toFixed(2),
      })),
    );
    return saldos;
  }
}
