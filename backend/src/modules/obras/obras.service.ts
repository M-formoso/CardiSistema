import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { CreateObraDto, FiltrosObraDto, UpdateObraDto } from './dto/obras.dto';

@Injectable()
export class ObrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
  ) {}

  findAll(filtros: FiltrosObraDto) {
    const where: Prisma.ObraWhereInput = {};
    if (filtros.tipo) where.tipo = filtros.tipo;
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.activo !== undefined) where.activo = filtros.activo;
    if (filtros.q) where.nombre = { contains: filtros.q, mode: 'insensitive' };
    return this.prisma.obra.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });
  }

  async findOne(id: string) {
    const obra = await this.prisma.obra.findUnique({ where: { id } });
    if (!obra) throw new NotFoundException('Obra no encontrada');
    return obra;
  }

  async create(dto: CreateObraDto, userId: string) {
    const monedaRequerida = dto.montoContratado != null;
    if (monedaRequerida && !dto.monedaContrato) {
      throw new BadRequestException('Si hay montoContratado, hay que indicar monedaContrato');
    }
    const creada = await this.prisma.obra.create({
      data: {
        nombre: dto.nombre,
        tipo: dto.tipo,
        comitente: dto.comitente,
        constructora: dto.constructora,
        ubicacion: dto.ubicacion,
        fechaInicio: dto.fechaInicio,
        estado: dto.estado,
        montoContratado: dto.montoContratado != null ? new Prisma.Decimal(dto.montoContratado) : null,
        monedaContrato: dto.monedaContrato,
        createdById: userId,
        updatedById: userId,
      },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Obra',
      entidadId: creada.id,
      despues: creada as unknown,
    });
    return creada;
  }

  async update(id: string, dto: UpdateObraDto, userId: string) {
    const antes = await this.findOne(id);
    const despues = await this.prisma.obra.update({
      where: { id },
      data: {
        ...dto,
        montoContratado:
          dto.montoContratado != null ? new Prisma.Decimal(dto.montoContratado) : undefined,
        updatedById: userId,
      },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'Obra',
      entidadId: id,
      antes: antes as unknown,
      despues: despues as unknown,
    });
    return despues;
  }

  async desactivar(id: string, userId: string) {
    const antes = await this.findOne(id);
    if (!antes.activo) return antes;
    const despues = await this.prisma.obra.update({
      where: { id },
      data: { activo: false, updatedById: userId },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'Obra',
      entidadId: id,
      antes: antes as unknown,
      despues: despues as unknown,
      observacion: 'Desactivación',
    });
    return despues;
  }
}
