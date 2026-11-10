import { RolUsuario } from '@prisma/client';

/**
 * Set de permisos por defecto de cada rol. Formato: "recurso:accion".
 * ADMIN bypassa toda verificación (ver PermissionsGuard).
 *
 * Estos defaults son conservadores — se amplían con la tabla UsuarioPermiso
 * para dar excepciones por usuario (ej. un CARGA que puede ver datos sensibles
 * de empleados, o un CONSULTA al que se le permite anular).
 */
export const PERMISOS_POR_ROL: Record<RolUsuario, Set<string>> = {
  ADMIN: new Set(), // bypass total

  CARGA: new Set([
    // Maestros
    'obras:ver', 'obras:crear', 'obras:editar',
    'beneficiarios:ver', 'beneficiarios:crear', 'beneficiarios:editar',
    'categorias:ver', 'categorias:crear', 'categorias:editar',
    'cajas:ver',

    // Billetera
    'cotizaciones:ver',
    'movimientos:ver', 'movimientos:crear',
    'cheques:ver', 'cheques:crear', 'cheques:cambiar_estado',

    // Personas y compromisos
    'liquidaciones:ver', 'liquidaciones:crear', 'liquidaciones:editar',
    'certificaciones:ver', 'certificaciones:crear',
    'contratos_cuotas:ver', 'contratos_cuotas:crear',
    'compromisos:ver', 'compromisos:crear',
    'recibos:ver', 'recibos:generar',

    // Reportes
    'reportes:ver',
  ]),

  CONSULTA: new Set([
    'obras:ver',
    'beneficiarios:ver',
    'categorias:ver',
    'cajas:ver',
    'cotizaciones:ver',
    'movimientos:ver',
    'cheques:ver',
    'liquidaciones:ver',
    'certificaciones:ver',
    'contratos_cuotas:ver',
    'compromisos:ver',
    'recibos:ver',
    'reportes:ver',
  ]),
};

export function keyPermiso(recurso: string, accion: string): string {
  return `${recurso}:${accion}`;
}
