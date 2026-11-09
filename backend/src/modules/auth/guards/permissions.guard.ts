import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import {
  PERMISSION_KEY,
  PermissionRequirement,
} from '../../../common/decorators/require-permission.decorator';
import { keyPermiso, PERMISOS_POR_ROL } from '../permisos/roles';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requisito = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requisito) return true;

    const req = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = req.user;
    if (!user) throw new ForbiddenException('Sesión inválida');

    if (user.rol === RolUsuario.ADMIN) return true;

    const key = keyPermiso(requisito.recurso, requisito.accion);

    const permisosRol = PERMISOS_POR_ROL[user.rol] ?? new Set<string>();
    if (permisosRol.has(key)) return true;
    if (user.permisos.has(key)) return true;

    throw new ForbiddenException(`Falta permiso: ${key}`);
  }
}
