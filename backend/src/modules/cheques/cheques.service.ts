import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCheque, Prisma, TipoCheque } from '@prisma/client';
import { assertTransition } from '../../common/state-machines';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
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
    const creado = await this.prisma.cheque.create({
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
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Cheque',
      entidadId: creado.id,
      despues: creado as unknown,
    });
    return creado;
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

    const despues = await this.prisma.cheque.update({
      where: { id },
      data: { estado: dto.estado, observaciones: nuevaObs, updatedById: userId },
      include: { beneficiario: true },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'Cheque',
      entidadId: id,
      antes: actual as unknown,
      despues: despues as unknown,
      observacion: `Cambio estado → ${dto.estado}`,
    });
    return despues;
  }
}
