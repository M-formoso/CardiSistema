import { apiClient } from '@/lib/apiClient';

export type EstadoPrestamoEmpleado = 'VIGENTE' | 'SALDADO' | 'ANULADO';

export type PrestamoEmpleado = {
  id: string;
  beneficiarioId: string;
  fecha: string;
  monto: string;
  moneda: 'ARS' | 'USD';
  saldoPendiente: string;
  estado: EstadoPrestamoEmpleado;
  movimientoId?: string | null;
  observaciones?: string | null;
  beneficiario?: { id: string; nombre: string };
  _count?: { aplicaciones: number };
};

export const prestamosEmpleadosService = {
  list: async (params?: {
    beneficiarioId?: string;
    estado?: EstadoPrestamoEmpleado;
    desde?: string;
    hasta?: string;
  }) => (await apiClient.get<PrestamoEmpleado[]>('/prestamos-empleados', { params })).data,
  get: async (id: string) =>
    (await apiClient.get<PrestamoEmpleado>(`/prestamos-empleados/${id}`)).data,
  vigentesDe: async (beneficiarioId: string) =>
    (
      await apiClient.get<PrestamoEmpleado[]>(
        `/prestamos-empleados/vigentes/${beneficiarioId}`,
      )
    ).data,
  create: async (input: {
    beneficiarioId: string;
    fecha: string;
    monto: number;
    observaciones?: string;
    movimientoId?: string;
  }) => (await apiClient.post<PrestamoEmpleado>('/prestamos-empleados', input)).data,
  anular: async (id: string, motivo: string) =>
    (await apiClient.patch<PrestamoEmpleado>(`/prestamos-empleados/${id}/anular`, { motivo })).data,
};
