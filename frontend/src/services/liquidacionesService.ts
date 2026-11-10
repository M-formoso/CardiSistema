import { apiClient } from '@/lib/apiClient';
import type { MedioPago } from './movimientosService';

export type EstadoLiquidacion = 'BORRADOR' | 'APROBADA' | 'PAGADA' | 'CERRADA';

export type LiquidacionResumen = {
  id: string;
  semanaInicio: string;
  semanaFin: string;
  estado: EstadoLiquidacion;
  totalBruto: string;
  totalDescuentos: string;
  totalPagado: string;
  observaciones?: string | null;
  _count?: { items: number };
};

export type LiquidacionDia = {
  id: string;
  fecha: string;
  dias: string;
  obraId: string;
  etiqueta?: string | null;
  obra: { id: string; nombre: string };
};

export type LiquidacionItem = {
  id: string;
  beneficiarioId?: string | null;
  nombreLibre: string;
  diasTrabajados: string;
  valorDia: string;
  subtotal: string;
  descuentos: string;
  aPagar: string;
  pagado: boolean;
  fechaPago?: string | null;
  observaciones?: string | null;
  beneficiario?: { id: string; nombre: string; tipo: string } | null;
  dias: LiquidacionDia[];
};

export type LiquidacionDetalle = LiquidacionResumen & {
  items: LiquidacionItem[];
};

export type UpsertItemInput = {
  id?: string;
  beneficiarioId?: string;
  nombreLibre: string;
  valorDia: number;
  descuentos?: number;
  observaciones?: string;
  dias: Array<{ fecha: string; dias: number; obraId: string; etiqueta?: string }>;
};

export type PagarLiquidacionInput = {
  cajaId: string;
  medioPago?: MedioPago;
  fechaPago?: string;
  categoriaId?: string;
  itemIds?: string[];
};

export const liquidacionesService = {
  list: async (params: { estado?: EstadoLiquidacion; desde?: string; hasta?: string } = {}) =>
    (await apiClient.get<LiquidacionResumen[]>('/liquidaciones', { params })).data,
  get: async (id: string) =>
    (await apiClient.get<LiquidacionDetalle>(`/liquidaciones/${id}`)).data,
  create: async (input: { semanaInicio: string; semanaFin: string; observaciones?: string }) =>
    (await apiClient.post<LiquidacionResumen>('/liquidaciones', input)).data,
  upsertItem: async (liquidacionId: string, input: UpsertItemInput) =>
    (await apiClient.put<LiquidacionItem>(`/liquidaciones/${liquidacionId}/items`, input)).data,
  eliminarItem: async (itemId: string) =>
    (await apiClient.delete(`/liquidaciones/items/${itemId}`)).data,
  cambiarEstado: async (id: string, estado: EstadoLiquidacion) =>
    (await apiClient.patch<LiquidacionResumen>(`/liquidaciones/${id}/estado`, { estado })).data,
  pagar: async (id: string, input: PagarLiquidacionInput) =>
    (await apiClient.post(`/liquidaciones/${id}/pagar`, input)).data,
};
