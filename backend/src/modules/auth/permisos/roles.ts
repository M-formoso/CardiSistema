import { RolUsuario } from '@prisma/client';

/**
 * Set de permisos por defecto de cada rol.
 * Formato: "recurso:accion".
 *
 * ADMIN no aparece acá porque bypassa toda verificación (ver PermissionsGuard).
 *
 * Estos defaults son conservadores — se amplían con la tabla UsuarioPermiso
 * para dar excepciones por usuario (ej. un CARGA que puede ver datos sensibles
 * de empleados).
 */
export const PERMISOS_POR_ROL: Record<RolUsuario, Set<string>> = {
  ADMIN: new Set(), // bypass total
  CARGA: new Set([
    'movimientos:crear',
    'movimientos:ver',
    'cajas:ver',
    'cheques:crear',
    'cheques:ver',
    'cheques:cambiar_estado',
    'obras:ver',
    'beneficiarios:ver',
    'beneficiarios:crear',
    'categorias:ver',
    'liquidaciones:crear',
    'liquidaciones:ver',
    'liquidaciones:editar',
    'certificaciones:crear',
    'certificaciones:ver',
    'compromisos:ver',
    'compromisos:crear',
    'recibos:generar',
    'reportes:ver',
  ]),
  CONSULTA: new Set([
    'movimientos:ver',
    'cajas:ver',
    'cheques:ver',
    'obras:ver',
    'beneficiarios:ver',
    'categorias:ver',
    'liquidaciones:ver',
    'certificaciones:ver',
    'compromisos:ver',
    'reportes:ver',
  ]),
};

export function keyPermiso(recurso: string, accion: string): string {
  return `${recurso}:${accion}`;
}
