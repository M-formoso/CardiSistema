import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CotizacionTipo,
  EstadoCertificacion,
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
  AnularCertificacionDto,
  CreateCertificacionDto,
  FiltrosCertificacionDto,
  PagarCertificacionDto,
  UpdateCertificacionDto,
} from './dto/certificaciones.dto';

@Injectable()
export class CertificacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
    private readonly cotizaciones: CotizacionesService,
  ) {}

  findAll(filtros: FiltrosCertificacionDto) {
    const where: Prisma.CertificacionWhereInput = {};
    if (filtros.obraId) where.obraId = filtros.obraId;
    if (filtros.beneficiarioId) where.beneficiarioId = filtros.beneficiarioId;
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.desde || filtros.hasta) {
      where.fecha = { gte: filtros.desde, lte: filtros.hasta };
    }
    return this.prisma.certificacion.findMany({
      where,
      orderBy: [{ fecha: 'desc' }],
      include: {
        obra: { select: { id: true, nombre: true } },
        beneficiario: { select: { id: true, nombre: true, tipo: true } },
      },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.certificacion.findUnique({
      where: { id },
      include: {
        obra: true,
        beneficiario: true,
      },
    });
    if (!c) throw new NotFoundException('Certificación no encontrada');
    return c;
  }

  async create(dto: CreateCertificacionDto, userId: string) {
    const beneficiario = await this.prisma.beneficiario.findUnique({
      where: { id: dto.beneficiarioId },
    });
    if (!beneficiario) throw new NotFoundException('Beneficiario no encontrado');
    if (!beneficiario.activo) throw new BadRequestException('Beneficiario inactivo');

    const obra = await this.prisma.obra.findUnique({ where: { id: dto.obraId } });
    if (!obra || !obra.activo) throw new BadRequestException('Obra inválida o inactiva');

    const creada = await this.prisma.certificacion.create({
      data: {
        beneficiarioId: dto.beneficiarioId,
        obraId: dto.obraId,
        numero: dto.numero,
        fecha: dto.fecha,
        descripcion: dto.descripcion,
        monto: new Prisma.Decimal(dto.monto),
        moneda: dto.moneda,
        porcentajeAvance:
          dto.porcentajeAvance != null ? new Prisma.Decimal(dto.porcentajeAvance) : null,
        adjuntoPath: dto.adjuntoPath,
        estado: EstadoCertificacion.PENDIENTE,
        saldoPendiente: new Prisma.Decimal(dto.monto),
        createdById: userId,
        updatedById: userId,
      },
      include: { obra: true, beneficiario: true },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Certificacion',
      entidadId: creada.id,
      despues: creada as unknown,
    });
    return creada;
  }

  async update(id: string, dto: UpdateCertificacionDto, userId: string) {
    const antes = await this.findOne(id);
    if (antes.estado !== EstadoCertificacion.PENDIENTE) {
      throw new BadRequestException(
        'Solo se pueden editar certificaciones PENDIENTES (sin pagos aplicados)',
      );
    }
    const despues = await this.prisma.certificacion.update({
      where: { id },
      data: {
        ...dto,
        porcentajeAvance:
          dto.porcentajeAvance != null ? new Prisma.Decimal(dto.porcentajeAvance) : undefined,
        updatedById: userId,
      },
      include: { obra: true, beneficiario: true },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'Certificacion',
      entidadId: id,
      antes: antes as unknown,
      despues: despues as unknown,
    });
    return despues;
  }

  /**
   * Paga (parcial o total) la certificación generando un egreso imputado 100%
   * a la obra de la certificación. Actualiza saldoPendiente y estado.
   */
  async pagar(id: string, dto: PagarCertificacionDto, userId: string) {
    const cert = await this.findOne(id);
    const estadosPagables: EstadoCertificacion[] = [
      EstadoCertificacion.PENDIENTE,
      EstadoCertificacion.PARCIAL,
    ];
    if (!estadosPagables.includes(cert.estado)) {
      throw new BadRequestException(
        `No se puede pagar una certificación en estado ${cert.estado}`,
      );
    }
    const saldoActual = Number(cert.saldoPendiente);
    if (dto.monto > saldoActual + 0.001) {
      throw new BadRequestException(
        `El monto (${dto.monto}) supera el saldo pendiente (${saldoActual.toFixed(2)})`,
      );
    }

    const caja = await this.prisma.caja.findUnique({ where: { id: dto.cajaId } });
    if (!caja || !caja.activo) throw new BadRequestException('Caja inválida');
    if (caja.moneda !== cert.moneda) {
      throw new BadRequestException(
        `La caja (${caja.moneda}) y la certificación (${cert.moneda}) deben tener la misma moneda`,
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
      const mov = await tx.movimiento.create({
        data: {
          tipo: TipoMovimiento.EGRESO,
          fecha,
          cajaId: caja.id,
          moneda: caja.moneda,
          monto: new Prisma.Decimal(dto.monto),
          medioPago: dto.medioPago,
          descripcion:
            dto.descripcion ??
            `Certificación ${cert.numero ?? ''} · ${cert.obraId}`.trim(),
          cotizacion: new Prisma.Decimal(cotizacionNum),
          cotizacionTipo,
          montoArs: new Prisma.Decimal(montoArs),
          montoUsd: new Prisma.Decimal(montoUsd),
          beneficiarioId: cert.beneficiarioId,
          categoriaId: dto.categoriaId ?? null,
          grupoId,
          origen: OrigenMovimiento.CERTIFICACION,
          origenId: cert.id,
          estado: EstadoMovimiento.CONFIRMADO,
          createdById: userId,
          updatedById: userId,
          imputaciones: {
            create: [
              {
                obraId: cert.obraId,
                monto: new Prisma.Decimal(dto.monto),
                porcentaje: new Prisma.Decimal(100),
              },
            ],
          },
        },
      });

      const nuevoSaldo = Math.round((saldoActual - dto.monto) * 100) / 100;
      const nuevoEstado: EstadoCertificacion =
        nuevoSaldo <= 0.001 ? EstadoCertificacion.PAGADA : EstadoCertificacion.PARCIAL;

      await tx.certificacion.update({
        where: { id: cert.id },
        data: {
          saldoPendiente: new Prisma.Decimal(Math.max(0, nuevoSaldo)),
          estado: nuevoEstado,
          updatedById: userId,
        },
      });

      void this.audit.registrar({
        usuarioId: userId,
        accion: 'ACTUALIZAR',
        entidad: 'Certificacion',
        entidadId: cert.id,
        observacion: `Pago · ${dto.monto} ${cert.moneda} → saldo ${nuevoSaldo.toFixed(2)}`,
      });

      return { movimiento: mov, saldoPendiente: nuevoSaldo, estado: nuevoEstado };
    });
  }

  async anular(id: string, dto: AnularCertificacionDto, userId: string) {
    const cert = await this.findOne(id);
    assertTransition('Certificacion', cert.estado, EstadoCertificacion.ANULADA);

    const anulada = await this.prisma.certificacion.update({
      where: { id },
      data: { estado: EstadoCertificacion.ANULADA, updatedById: userId },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ANULAR',
      entidad: 'Certificacion',
      entidadId: id,
      antes: cert as unknown,
      despues: anulada as unknown,
      observacion: dto.motivo,
    });
    return anulada;
  }
}
