import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type {
  CreateUsuarioDto,
  ResetPasswordDto,
  SetPermisosDto,
  UpdateUsuarioDto,
} from './dto/usuarios.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
  ) {}

  findAll(soloActivos = false) {
    return this.prisma.usuario.findMany({
      where: soloActivos ? { activo: true } : undefined,
      orderBy: [{ activo: 'desc' }, { username: 'asc' }],
      select: {
        id: true,
        username: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { permisos: true } },
      },
    });
  }

  async findOne(id: string) {
    const u = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
        permisos: {
          select: { id: true, recurso: true, accion: true, concedido: true },
          orderBy: [{ recurso: 'asc' }, { accion: 'asc' }],
        },
      },
    });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }

  async create(dto: CreateUsuarioDto, actorId: string) {
    const username = dto.username.trim().toLowerCase();
    const existe = await this.prisma.usuario.findUnique({ where: { username } });
    if (existe) throw new BadRequestException(`Ya existe un usuario con username "${username}"`);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const creado = await this.prisma.usuario.create({
      data: {
        username,
        nombre: dto.nombre.trim(),
        email: dto.email?.trim() ?? null,
        rol: dto.rol,
        passwordHash,
        activo: true,
      },
      select: { id: true, username: true, nombre: true, email: true, rol: true, activo: true },
    });

    void this.audit.registrar({
      usuarioId: actorId,
      accion: 'CREAR',
      entidad: 'Usuario',
      entidadId: creado.id,
      despues: creado as unknown,
      observacion: `Alta usuario ${creado.username} rol ${creado.rol}`,
    });
    return creado;
  }

  async update(id: string, dto: UpdateUsuarioDto, actorId: string) {
    const antes = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, username: true, nombre: true, email: true, rol: true, activo: true },
    });
    if (!antes) throw new NotFoundException('Usuario no encontrado');

    const despues = await this.prisma.usuario.update({
      where: { id },
      data: {
        nombre: dto.nombre?.trim(),
        email: dto.email === undefined ? undefined : dto.email?.trim() || null,
        rol: dto.rol,
      },
      select: { id: true, username: true, nombre: true, email: true, rol: true, activo: true },
    });

    void this.audit.registrar({
      usuarioId: actorId,
      accion: 'ACTUALIZAR',
      entidad: 'Usuario',
      entidadId: id,
      antes: antes as unknown,
      despues: despues as unknown,
    });
    return despues;
  }

  async desactivar(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('No podés desactivar tu propio usuario');
    }
    const u = await this.prisma.usuario.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    if (!u.activo) return u;

    const despues = await this.prisma.$transaction(async (tx) => {
      // Revoco también las sesiones activas al desactivar
      await tx.refreshToken.updateMany({
        where: { usuarioId: id, revocado: false },
        data: { revocado: true },
      });
      return tx.usuario.update({
        where: { id },
        data: { activo: false },
        select: { id: true, username: true, nombre: true, rol: true, activo: true },
      });
    });

    void this.audit.registrar({
      usuarioId: actorId,
      accion: 'ACTUALIZAR',
      entidad: 'Usuario',
      entidadId: id,
      observacion: `Desactivación de ${u.username}`,
    });
    return despues;
  }

  async activar(id: string, actorId: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    if (u.activo) return u;

    const despues = await this.prisma.usuario.update({
      where: { id },
      data: { activo: true },
      select: { id: true, username: true, nombre: true, rol: true, activo: true },
    });

    void this.audit.registrar({
      usuarioId: actorId,
      accion: 'ACTUALIZAR',
      entidad: 'Usuario',
      entidadId: id,
      observacion: `Reactivación de ${u.username}`,
    });
    return despues;
  }

  async resetPassword(id: string, dto: ResetPasswordDto, actorId: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id }, data: { passwordHash } });
      // Revoco las sesiones por seguridad
      await tx.refreshToken.updateMany({
        where: { usuarioId: id, revocado: false },
        data: { revocado: true },
      });
    });

    void this.audit.registrar({
      usuarioId: actorId,
      accion: 'ACTUALIZAR',
      entidad: 'Usuario',
      entidadId: id,
      observacion: `Reset de contraseña de ${u.username} por admin`,
    });
    return { ok: true, sesiones_revocadas: true };
  }

  /**
   * Reemplaza COMPLETO el set de permisos granulares del usuario.
   * El rol base siempre vale; esto son excepciones (ver PERMISOS_POR_ROL).
   */
  async setPermisos(id: string, dto: SetPermisosDto, actorId: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');

    await this.prisma.$transaction(async (tx) => {
      await tx.usuarioPermiso.deleteMany({ where: { usuarioId: id } });
      if (dto.permisos.length > 0) {
        await tx.usuarioPermiso.createMany({
          data: dto.permisos.map((p) => ({
            usuarioId: id,
            recurso: p.recurso,
            accion: p.accion,
            concedido: p.concedido,
          })),
          skipDuplicates: true,
        });
      }
    });

    void this.audit.registrar({
      usuarioId: actorId,
      accion: 'ACTUALIZAR',
      entidad: 'Usuario',
      entidadId: id,
      observacion: `Permisos granulares actualizados (${dto.permisos.length} entradas)`,
    });

    return this.prisma.usuarioPermiso.findMany({
      where: { usuarioId: id },
      select: { id: true, recurso: true, accion: true, concedido: true },
      orderBy: [{ recurso: 'asc' }, { accion: 'asc' }],
    });
  }
}

// Ayuda al compilador cuando Prisma cambia tipos
export type _UsuarioOut = Prisma.UsuarioGetPayload<{
  select: { id: true; username: true; nombre: true; rol: true; activo: true };
}>;
