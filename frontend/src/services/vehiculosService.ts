import { apiClient } from '@/lib/apiClient';

export type Vehiculo = {
  id: string;
  nombre: string;
  modelo: string | null;
  patente: string;
  observaciones: string | null;
  activo: boolean;
  gastoTotal?: string;
};

export type PagoVehiculo = {
  id: string;
  fecha: string;
  montoImputado: string;
  montoTotalMovimiento: string;
  moneda: 'ARS' | 'USD';
  medioPago: string;
  descripcion: string | null;
  caja: { nombre: string; moneda: 'ARS' | 'USD' };
  categoria: { nombre: string; codigo: string } | null;
  beneficiario: { nombre: string } | null;
};

export type VehiculoDetalle = {
  vehiculo: Vehiculo;
  gastoTotal: string;
  pagos: PagoVehiculo[];
};

export type CrearVehiculoInput = {
  nombre: string;
  modelo?: string;
  patente: string;
  observaciones?: string;
};

export const vehiculosService = {
  list: async (params: { q?: string; activo?: boolean } = {}) =>
    (await apiClient.get<Vehiculo[]>('/vehiculos', { params })).data,
  get: async (id: string) =>
    (await apiClient.get<VehiculoDetalle>(`/vehiculos/${id}`)).data,
  create: async (input: CrearVehiculoInput) =>
    (await apiClient.post<Vehiculo>('/vehiculos', input)).data,
  update: async (id: string, input: Partial<CrearVehiculoInput & { activo: boolean }>) =>
    (await apiClient.patch<Vehiculo>(`/vehiculos/${id}`, input)).data,
  desactivar: async (id: string) =>
    (await apiClient.delete<{ eliminado: boolean; desactivado?: boolean }>(`/vehiculos/${id}`)).data,
};
