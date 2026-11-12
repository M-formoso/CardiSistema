import { apiClient } from '@/lib/apiClient';
import type { MedioPago } from './movimientosService';

export type EstadoLiquidacion = 'BORRADOR' | 'APROBADA' | 'PAGADA_PARCIAL' | 'PAGADA' | 'CERRADA';

export type TipoConcepto =
  | 'JORNAL'
  | 'JORNAL_ESPECIAL'
  | 'HORAS_EXTRA'
  | 'VIATICO'
  | 'VACACIONES'
  | 'CERTIFICACION'
  | 'SUELDO'
  | 'PRESTAMO_ENTREGADO'
  | 'PRESTAMO_APLICACION'
  | 'DEDUCCION'
  | 'VALE'
  | 'NOTA_SALDO';

export type LiquidacionResumen = {
  id: string;
  semanaInicio: string;
  semanaFin: string;
  obraId: string;
  estado: EstadoLiquidacion;
  totalBruto: string;
  totalDescuentos: string;
  totalAPagar: string;
  totalPagado: string;
  observaciones?: string | null;
  obra?: { id: string; nombre: string };
  _count?: { items: number; pagos: number };
};

export type LiquidacionItemConcepto = {
  id: string;
  tipo: TipoConcepto;
  descripcion: string;
  cantidad?: string | null;
  valorUnitario?: string | null;
  monto: string; // signado
  obraId?: string | null;
  prestamoId?: string | null;
  orden: number;
  obra?: { id: string; nombre: string } | null;
  prestamo?: { id: string; fecha: string; monto: string; saldoPendiente: string } | null;
};

export type LiquidacionItem = {
  id: string;
  beneficiarioId?: string | null;
  nombreLibre: string;
  subtotal: string;
  aPagar: string;
  pagado: boolean;
  fechaPago?: string | null;
  observaciones?: string | null;
  beneficiario?: { id: string; nombre: string; tipo: string } | null;
  conceptos: LiquidacionItemConcepto[];
};

export type LiquidacionPago = {
  id: string;
  movimientoId?: string | null;
  monto: string;
  fecha: string;
  medioPago: MedioPago;
  cajaId: string;
  observaciones?: string | null;
  createdAt: string;
  caja?: { id: string; nombre: string; moneda: 'ARS' | 'USD' };
  movimiento?: { id: string; estado: string };
};

export type LiquidacionDetalle = LiquidacionResumen & {
  obra: { id: string; nombre: string; tipo: string };
  items: LiquidacionItem[];
  pagos: LiquidacionPago[];
};

export type ConceptoInput = {
  tipo: TipoConcepto;
  descripcion: string;
  cantidad?: number;
  valorUnitario?: number;
  monto: number; // siempre positivo; el backend aplica el signo según el tipo
  obraId?: string;
  prestamoId?: string;
  orden?: number;
};

export type UpsertItemInput = {
  id?: string;
  beneficiarioId?: string;
  nombreLibre: string;
  observaciones?: string;
  conceptos: ConceptoInput[];
};

export type PagarLiquidacionInput = {
  cajaId: string;
  medioPago?: MedioPago;
  fechaPago?: string;
  categoriaId?: string;
  monto?: number; // default: saldo pendiente
  observaciones?: string;
};

export type PagarResult = {
  movimientoId: string;
  montoPagado: string;
  saldoPendiente: string;
  estado: EstadoLiquidacion;
  recibosCreados: string[];
};

export const liquidacionesService = {
  list: async (
    params: { estado?: EstadoLiquidacion; obraId?: string; desde?: string; hasta?: string } = {},
  ) => (await apiClient.get<LiquidacionResumen[]>('/liquidaciones', { params })).data,
  get: async (id: string) =>
    (await apiClient.get<LiquidacionDetalle>(`/liquidaciones/${id}`)).data,
  create: async (input: {
    semanaInicio: string;
    semanaFin: string;
    obraId: string;
    observaciones?: string;
  }) => (await apiClient.post<LiquidacionResumen>('/liquidaciones', input)).data,
  upsertItem: async (liquidacionId: string, input: UpsertItemInput) =>
    (await apiClient.put<LiquidacionItem>(`/liquidaciones/${liquidacionId}/items`, input)).data,
  eliminarItem: async (itemId: string) =>
    (await apiClient.delete(`/liquidaciones/items/${itemId}`)).data,
  cambiarEstado: async (id: string, estado: EstadoLiquidacion) =>
    (await apiClient.patch<LiquidacionResumen>(`/liquidaciones/${id}/estado`, { estado })).data,
  pagar: async (id: string, input: PagarLiquidacionInput) =>
    (await apiClient.post<PagarResult>(`/liquidaciones/${id}/pagar`, input)).data,
};

/** Mapea cada tipo de concepto al signo lógico que aplicará el backend. */
export const SIGNO_CONCEPTO: Record<TipoConcepto, 1 | -1 | 0> = {
  JORNAL: 1,
  JORNAL_ESPECIAL: 1,
  HORAS_EXTRA: 1,
  VIATICO: 1,
  VACACIONES: 1,
  CERTIFICACION: 1,
  SUELDO: 1,
  PRESTAMO_ENTREGADO: 1,
  PRESTAMO_APLICACION: -1,
  DEDUCCION: -1,
  VALE: -1,
  NOTA_SALDO: 0,
};

export const ETIQUETA_CONCEPTO: Record<TipoConcepto, string> = {
  JORNAL: 'Jornal',
  JORNAL_ESPECIAL: 'Jornal especial',
  HORAS_EXTRA: 'Horas extra',
  VIATICO: 'Viático',
  VACACIONES: 'Vacaciones',
  CERTIFICACION: 'Certificación',
  SUELDO: 'Sueldo',
  PRESTAMO_ENTREGADO: 'Préstamo entregado',
  PRESTAMO_APLICACION: 'Descuento préstamo',
  DEDUCCION: 'Deducción',
  VALE: 'Vale',
  NOTA_SALDO: 'Nota (saldo)',
};
