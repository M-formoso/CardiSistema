import type { RolUsuario } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  username: string;
  nombre: string;
  email: string | null;
  rol: RolUsuario;
  /** Set de "recurso:accion" concedidos explícitamente a este usuario. */
  permisos: Set<string>;
};
