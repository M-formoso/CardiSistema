import { apiClient } from '@/lib/apiClient';
import type { MedioPago } from './movimientosService';

export type EstadoCuota = 'PENDIENTE' | 'PAGADA' | 'ANULADA';

export type Cuota = {
  id: string;
  numero: number;
  monto: string;
  vencimiento: string;
  estado: EstadoCuota;
  movimientoId?: string | null;
};

export type ContratoCuota = {
  id: string;
  beneficiarioId: string;
  obraId?: string | null;
  concepto: string;
  montoTotal: string;
  moneda: 'ARS' | 'USD';
  cantidadCuotas: number;
  activo: boolean;
  observaciones?: string | null;
  beneficiario?: { id: string; nombre: string; tipo: string };
  obra?: { id: string; nombre: string } | null;
  cuotas?: Cuota[];
  _count?: { cuotas: number };
};

export type CreateContratoInput = {
  beneficiarioId: string;
  obraId?: string;
  concepto: string;
  montoTotal: number;
  moneda: 'ARS' | 'USD';
  cantidadCuotas: number;
  observaciones?: string;
  cuotas?: Array<{ numero: number; monto: number; vencimiento: string }>;
};

export type PagarCuotaInput = {
  cajaId: string;
  medioPago?: MedioPago;
  fecha?: string;
  categoriaId?: string;
};

export const contratosCuotasService = {
  list: async (params: { beneficiarioId?: string; activo?: boolean } = {}) =>
    (await apiClient.get<ContratoCuota[]>('/contratos-cuotas', { params })).data,
  get: async (id: string) =>
    (await apiClient.get<ContratoCuota>(`/contratos-cuotas/${id}`)).data,
  create: async (input: CreateContratoInput) =>
    (await apiClient.post<ContratoCuota>('/contratos-cuotas', input)).data,
  pagarCuota: async (cuotaId: string, input: PagarCuotaInput) =>
    (await apiClient.post(`/contratos-cuotas/cuotas/${cuotaId}/pagar`, input)).data,
};
