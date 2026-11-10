import { apiClient } from '@/lib/apiClient';
import type { MedioPago } from './movimientosService';

export type EstadoCertificacion = 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'ANULADA';

export type Certificacion = {
  id: string;
  beneficiarioId: string;
  obraId: string;
  numero?: string | null;
  fecha: string;
  descripcion?: string | null;
  monto: string;
  moneda: 'ARS' | 'USD';
  porcentajeAvance?: string | null;
  estado: EstadoCertificacion;
  saldoPendiente: string;
  adjuntoPath?: string | null;
  obra?: { id: string; nombre: string };
  beneficiario?: { id: string; nombre: string; tipo: string };
};

export type CreateCertificacionInput = {
  beneficiarioId: string;
  obraId: string;
  numero?: string;
  fecha: string;
  descripcion?: string;
  monto: number;
  moneda: 'ARS' | 'USD';
  porcentajeAvance?: number;
};

export type PagarCertificacionInput = {
  cajaId: string;
  medioPago?: MedioPago;
  monto: number;
  fecha?: string;
  categoriaId?: string;
  descripcion?: string;
};

export const certificacionesService = {
  list: async (params: { obraId?: string; estado?: EstadoCertificacion } = {}) =>
    (await apiClient.get<Certificacion[]>('/certificaciones', { params })).data,
  get: async (id: string) =>
    (await apiClient.get<Certificacion>(`/certificaciones/${id}`)).data,
  create: async (input: CreateCertificacionInput) =>
    (await apiClient.post<Certificacion>('/certificaciones', input)).data,
  pagar: async (id: string, input: PagarCertificacionInput) =>
    (await apiClient.post(`/certificaciones/${id}/pagar`, input)).data,
  anular: async (id: string, motivo: string) =>
    (await apiClient.post(`/certificaciones/${id}/anular`, { motivo })).data,
};
