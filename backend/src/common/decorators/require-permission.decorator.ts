import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

export type PermissionRequirement = {
  recurso: string;
  accion: string;
};

/**
 * Exige un permiso granular para el handler.
 * ADMIN siempre pasa; otros roles deben tener la entrada en UsuarioPermiso
 * (o pertenecer al set por defecto del rol — ver roles.ts).
 */
export const RequirePermission = (recurso: string, accion: string) =>
  SetMetadata(PERMISSION_KEY, { recurso, accion } as PermissionRequirement);
