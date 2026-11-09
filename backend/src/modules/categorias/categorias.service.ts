import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { CreateAliasDto, CreateCategoriaDto, UpdateCategoriaDto } from './dto/categorias.dto';

@Injectable()
export class CategoriasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
  ) {}

  findAll(soloActivas = false) {
    return this.prisma.categoriaGasto.findMany({
      where: soloActivas ? { activo: true } : undefined,
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: { subcategorias: { orderBy: { orden: 'asc' } }, aliases: true },
    });
  }

  async findOne(id: string) {
    const cat = await this.prisma.categoriaGasto.findUnique({
      where: { id },
      include: { subcategorias: true, aliases: true, parent: true },
    });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    return cat;
  }

  async create(dto: CreateCategoriaDto, userId: string) {
    const creada = await this.prisma.categoriaGasto.create({
      data: { ...dto, createdById: userId, updatedById: userId },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'CategoriaGasto',
      entidadId: creada.id,
      despues: creada as unknown,
    });
    return creada;
  }

  async update(id: string, dto: UpdateCategoriaDto, userId: string) {
    const antes = await this.findOne(id);
    const despues = await this.prisma.categoriaGasto.update({
      where: { id },
      data: { ...dto, updatedById: userId },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'CategoriaGasto',
      entidadId: id,
      antes: antes as unknown,
      despues: despues as unknown,
    });
    return despues;
  }

  async desactivar(id: string, userId: string) {
    const actual = await this.findOne(id);
    if (!actual.activo) return actual;
    return this.prisma.categoriaGasto.update({
      where: { id },
      data: { activo: false, updatedById: userId },
    });
  }

  // --- ConceptoAlias ---

  async createAlias(dto: CreateAliasDto) {
    // valida que exista la categoría
    await this.findOne(dto.categoriaId);
    return this.prisma.conceptoAlias.create({ data: dto });
  }

  async deleteAlias(id: string) {
    await this.prisma.conceptoAlias.delete({ where: { id } });
    return { ok: true };
  }

  /** Busca una categoría por alias exacto (case-insensitive). Usa la migración. */
  async resolverPorAlias(texto: string) {
    const alias = await this.prisma.conceptoAlias.findFirst({
      where: { texto: { equals: texto.trim(), mode: 'insensitive' } },
      include: { categoria: true },
    });
    return alias?.categoria ?? null;
  }
}
