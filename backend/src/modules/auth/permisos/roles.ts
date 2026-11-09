import { RolUsuario } from '@prisma/client';

/**
 * Set de permisos por defecto de cada rol.
 * Formato: "recurso:accion".
 *
 * ADMIN no aparece acá porque bypassa toda verificación (ver PermissionsGuard).
 *
 * Estos defaults son conservadores — se amplían con la tabla UsuarioPermiso
 * para dar excepciones por usuario (ej. un CARGA que puede ver datos sensibles
 * de empleados, o un CONSULTA al que se le permite anular en un ambiente
 * puntual).
 */
export const PERMISOS_POR_ROL: Record<RolUsuario, Set<string>> = {
  ADMIN: new Set(), // bypass total

  CARGA: new Set([
    // Obras y maestros — ver + crear + editar (desactivar solo admin)
    'obras:ver',
    'obras:crear',
    'obras:editar',
    'beneficiarios:ver',
    'beneficiarios:crear',
    'beneficiarios:editar',
    'categorias:ver',
    'categorias:crear',
    'categorias:editar',
    'cajas:ver',

    // Cotizaciones — ver (editar solo admin)
    'cotizaciones:ver',

    // Billetera
    'movimientos:ver',
    'movimientos:crear',
    'cheques:ver',
    'cheques:crear',
    'cheques:cambiar_estado',

    // Personas y compromisos (etapa 3)
    'liquidaciones:ver',
    'liquidaciones:crear',
    'liquidaciones:editar',
    'certificaciones:ver',
    'certificaciones:crear',
    'compromisos:ver',
    'compromisos:crear',

    // Salidas
    'recibos:generar',
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
    'compromisos:ver',
    'reportes:ver',
  ]),
};

export function keyPermiso(recurso: string, accion: string): string {
  return `${recurso}:${accion}`;
}
