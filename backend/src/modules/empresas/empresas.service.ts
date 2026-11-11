import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type {
  CreateEmpresaDto,
  FiltrosEmpresaDto,
  UpdateEmpresaDto,
} from './dto/empresas.dto';

@Injectable()
export class EmpresasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
  ) {}

  findAll(filtros: FiltrosEmpresaDto) {
    const where: Prisma.EmpresaWhereInput = {};
    if (filtros.activo !== undefined) where.activo = filtros.activo;
    if (filtros.q) where.nombre = { contains: filtros.q, mode: 'insensitive' };
    return this.prisma.empresa.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: { _count: { select: { empleados: true } } },
    });
  }

  async findOne(id: string) {
    const emp = await this.prisma.empresa.findUnique({
      where: { id },
      include: { _count: { select: { empleados: true } } },
    });
    if (!emp) throw new NotFoundException('Empresa no encontrada');
    return emp;
  }

  async create(dto: CreateEmpresaDto, userId: string) {
    try {
      const creada = await this.prisma.empresa.create({
        data: {
          nombre: dto.nombre.trim(),
          cuit: dto.cuit?.trim() || null,
          activo: dto.activo ?? true,
          createdById: userId,
          updatedById: userId,
        },
      });
      void this.audit.registrar({
        usuarioId: userId,
        accion: 'CREAR',
        entidad: 'Empresa',
        entidadId: creada.id,
        despues: creada as unknown,
      });
      return creada;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Ya existe una empresa con el nombre "${dto.nombre}"`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateEmpresaDto, userId: string) {
    const antes = await this.prisma.empresa.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Empresa no encontrada');
    try {
      const despues = await this.prisma.empresa.update({
        where: { id },
        data: {
          nombre: dto.nombre?.trim(),
          cuit: dto.cuit !== undefined ? dto.cuit?.trim() || null : undefined,
          activo: dto.activo,
          updatedById: userId,
        },
      });
      void this.audit.registrar({
        usuarioId: userId,
        accion: 'ACTUALIZAR',
        entidad: 'Empresa',
        entidadId: id,
        antes: antes as unknown,
        despues: despues as unknown,
      });
      return despues;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Ya existe una empresa con el nombre "${dto.nombre}"`);
      }
      throw err;
    }
  }

  async desactivar(id: string, userId: string) {
    const emp = await this.prisma.empresa.findUnique({ where: { id } });
    if (!emp) throw new NotFoundException('Empresa no encontrada');
    if (!emp.activo) return emp;
    return this.prisma.empresa.update({
      where: { id },
      data: { activo: false, updatedById: userId },
    });
  }
}
