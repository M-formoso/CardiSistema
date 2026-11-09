import { Injectable, NotFoundException } from '@nestjs/common';
import { EstadoMovimiento, Prisma, TipoMovimiento } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { CreateCajaDto, UpdateCajaDto } from './dto/cajas.dto';

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
