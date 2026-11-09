import { Injectable, Logger } from '@nestjs/common';
import { AuditAccion, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type RegistrarArgs = {
  usuarioId?: string | null;
  accion: AuditAccion;
  entidad: string;
  entidadId?: string | null;
  antes?: unknown;
  despues?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  observacion?: string | null;
};

/**
 * Registro de auditoría fire-and-forget: nunca lanza al caller.
 * Si falla el insert, se loguea y se sigue — un fallo de auditoría
 * no debe tirar abajo una operación de negocio.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(args: RegistrarArgs): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          usuarioId: args.usuarioId ?? null,
          accion: args.accion,
          entidad: args.entidad,
          entidadId: args.entidadId ?? null,
          antes: (args.antes as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          despues: (args.despues as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          ip: args.ip ?? null,
          userAgent: args.userAgent ?? null,
          observacion: args.observacion ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Fallo al registrar auditoría de ${args.entidad}/${args.entidadId ?? '-'}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
