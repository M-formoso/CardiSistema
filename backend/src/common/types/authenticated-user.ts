import type { RolUsuario } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  /** Set de "recurso:accion" concedidos explícitamente a este usuario. */
  permisos: Set<string>;
};
