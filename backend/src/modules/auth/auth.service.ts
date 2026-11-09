import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 48;

type RequestMeta = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string, meta: RequestMeta) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await bcrypt.compare(password, usuario.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    const accessToken = this.signAccessToken(usuario.id, usuario.email, usuario.rol);
    const refresh = await this.issueRefreshToken(usuario.id, meta);

    return {
      accessToken,
      refreshToken: refresh.plain,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
      },
    };
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const hash = this.hashRefresh(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { usuario: true },
    });
    if (!stored || stored.revocado || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    if (!stored.usuario.activo) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    // Rotación: revoco el viejo y emito uno nuevo en una misma transacción.
    const { usuario } = stored;
    const nuevo = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revocado: true },
      });
      const plain = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
      const created = await tx.refreshToken.create({
        data: {
          usuarioId: usuario.id,
          tokenHash: this.hashRefresh(plain),
          expiresAt: this.refreshExpiryDate(),
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      });
      return { plain, record: created };
    });

    const accessToken = this.signAccessToken(usuario.id, usuario.email, usuario.rol);

    return {
      accessToken,
      refreshToken: nuevo.plain,
    };
  }

  async logout(refreshToken: string) {
    const hash = this.hashRefresh(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revocado: false },
      data: { revocado: true },
    });
    return { ok: true };
  }

  async changePassword(usuarioId: string, actual: string, nuevo: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new UnauthorizedException();
    const ok = await bcrypt.compare(actual, usuario.passwordHash);
    if (!ok) throw new BadRequestException('Contraseña actual incorrecta');

    const nuevoHash = await bcrypt.hash(nuevo, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: usuarioId },
        data: { passwordHash: nuevoHash },
      }),
      // Invalida todas las sesiones activas al cambiar la contraseña
      this.prisma.refreshToken.updateMany({
        where: { usuarioId, revocado: false },
        data: { revocado: true },
      }),
    ]);
    return { ok: true };
  }

  // --------- helpers privados ---------

  private signAccessToken(sub: string, email: string, rol: string) {
    return this.jwt.sign(
      { sub, email, rol },
      {
        secret: this.getSecret(),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '30m',
      },
    );
  }

  private async issueRefreshToken(usuarioId: string, meta: RequestMeta) {
    const plain = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const record = await this.prisma.refreshToken.create({
      data: {
        usuarioId,
        tokenHash: this.hashRefresh(plain),
        expiresAt: this.refreshExpiryDate(),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    return { plain, record };
  }

  private hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshExpiryDate(): Date {
    const raw = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const match = raw.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`JWT_REFRESH_EXPIRES_IN inválido: ${raw}`);
    const n = Number(match[1]);
    const unit = match[2];
    const mult = unit === 's' ? 1_000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return new Date(Date.now() + n * mult);
  }

  private getSecret(): string {
    const s = this.config.get<string>('JWT_SECRET');
    if (!s) throw new Error('JWT_SECRET no configurado');
    return s;
  }
}
