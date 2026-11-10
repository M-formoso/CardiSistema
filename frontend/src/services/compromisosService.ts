import { apiClient } from '@/lib/apiClient';
import type { MedioPago } from './movimientosService';

export type EstadoCompromiso = 'PENDIENTE' | 'PAGADO' | 'OMITIDO';

export type VencimientoRecurrente = {
  id: string;
  concepto: string;
  obraId?: string | null;
  categoriaId?: string | null;
  beneficiarioId?: string | null;
  diaDelMes: number;
  montoEstimado: string;
  moneda: 'ARS' | 'USD';
  cajaHabitualId?: string | null;
  activo: boolean;
  obra?: { id: string; nombre: string } | null;
  beneficiario?: { id: string; nombre: string } | null;
  categoria?: { id: string; nombre: string } | null;
};

export type CompromisoPago = {
  id: string;
  vencimientoId?: string | null;
  fecha: string;
  concepto: string;
  obraId?: string | null;
  beneficiarioId?: string | null;
  montoEstimado: string;
  moneda: 'ARS' | 'USD';
  estado: EstadoCompromiso;
  movimientoId?: string | null;
  vencimiento?: { id: string; concepto: string } | null;
  obra?: { id: string; nombre: string } | null;
  beneficiario?: { id: string; nombre: string } | null;
};

export type CreateVencimientoInput = {
  concepto: string;
  obraId?: string;
  categoriaId?: string;
  beneficiarioId?: string;
  diaDelMes: number;
  montoEstimado: number;
  moneda?: 'ARS' | 'USD';
  cajaHabitualId?: string;
};

export type PagarCompromisoInput = {
  cajaId: string;
  medioPago?: MedioPago;
  monto: number;
  fecha?: string;
  descripcion?: string;
};

export const compromisosService = {
  // Vencimientos (plantillas)
  listVencimientos: async (soloActivos = false) =>
    (await apiClient.get<VencimientoRecurrente[]>('/vencimientos', {
      params: soloActivos ? { soloActivos: 'true' } : undefined,
    })).data,
  crearVencimiento: async (input: CreateVencimientoInput) =>
    (await apiClient.post<VencimientoRecurrente>('/vencimientos', input)).data,
  desactivarVencimiento: async (id: string) =>
    (await apiClient.delete(`/vencimientos/${id}`)).data,

  // Compromisos (instancias)
  list: async (params: { estado?: EstadoCompromiso; desde?: string; hasta?: string } = {}) =>
    (await apiClient.get<CompromisoPago[]>('/compromisos', { params })).data,
  proyeccion: async (dias = 30) =>
    (await apiClient.get<{
      diasAdelante: number;
      cantidad: number;
      totales: { ars: number; usd: number };
      items: CompromisoPago[];
    }>('/compromisos/proyeccion', { params: { dias } })).data,
  generar: async (mes?: number, anio?: number) =>
    (await apiClient.post<{ mes: number; anio: number; creados: number }>('/compromisos/generar', {
      mes,
      anio,
    })).data,
  pagar: async (id: string, input: PagarCompromisoInput) =>
    (await apiClient.post(`/compromisos/${id}/pagar`, input)).data,
  omitir: async (id: string, motivo: string) =>
    (await apiClient.post(`/compromisos/${id}/omitir`, { motivo })).data,
};
