import { apiClient } from '@/lib/apiClient';

export type EstadoMovimiento = 'CONFIRMADO' | 'ANULADO' | 'REVERSA';
export type TipoMovimiento = 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA' | 'CAMBIO_MONEDA' | 'AJUSTE';
export type MedioPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE_PROPIO' | 'CHEQUE_TERCERO';

export type ImputacionInput = {
  obraId: string;
  monto?: number;
  porcentaje?: number;
};

export type Movimiento = {
  id: string;
  tipo: TipoMovimiento;
  fecha: string;
  cajaId: string;
  moneda: 'ARS' | 'USD';
  monto: string;
  medioPago: MedioPago;
  descripcion?: string | null;
  cotizacion: string;
  montoArs: string;
  montoUsd: string;
  beneficiarioId?: string | null;
  categoriaId?: string | null;
  estado: EstadoMovimiento;
  grupoId?: string | null;
  motivoAnulacion?: string | null;
  createdAt: string;
  caja?: { nombre: string; moneda: string };
  beneficiario?: { nombre: string } | null;
  categoria?: { nombre: string } | null;
  imputaciones?: Array<{ obraId: string; monto: string; porcentaje: string; obra: { nombre: string } }>;
};

export type ListadoMovimientos = {
  total: number;
  page: number;
  pageSize: number;
  data: Movimiento[];
};

export type FiltrosMovimientos = {
  cajaId?: string;
  tipo?: TipoMovimiento;
  beneficiarioId?: string;
  categoriaId?: string;
  obraId?: string;
  estado?: EstadoMovimiento;
  desde?: string;
  hasta?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type CrearEgresoInput = {
  fecha: string;
  cajaId: string;
  monto: number;
  medioPago: MedioPago;
  beneficiarioId?: string;
  categoriaId?: string;
  descripcion?: string;
  chequeId?: string;
  cotizacion?: number;
  imputaciones: ImputacionInput[];
};

export type CrearIngresoInput = {
  fecha: string;
  cajaId: string;
  monto: number;
  medioPago: MedioPago;
  beneficiarioId?: string;
  categoriaId?: string;
  descripcion?: string;
  obraIngresoId?: string;
  cotizacion?: number;
};

export type TransferirInput = {
  fecha: string;
  cajaOrigenId: string;
  cajaDestinoId: string;
  monto: number;
  descripcion?: string;
};

export type CambioMonedaInput = {
  fecha: string;
  cajaOrigenId: string;
  cajaDestinoId: string;
  montoOrigen: number;
  montoDestino: number;
  cotizacion: number;
  descripcion?: string;
};

export const movimientosService = {
  list: async (filtros: FiltrosMovimientos = {}) => {
    const { data } = await apiClient.get<ListadoMovimientos>('/movimientos', { params: filtros });
    return data;
  },
  get: async (id: string) => {
    const { data } = await apiClient.get<Movimiento>(`/movimientos/${id}`);
    return data;
  },
  crearEgreso: async (input: CrearEgresoInput) => {
    const { data } = await apiClient.post<Movimiento>('/movimientos/egresos', input);
    return data;
  },
  crearIngreso: async (input: CrearIngresoInput) => {
    const { data } = await apiClient.post<Movimiento>('/movimientos/ingresos', input);
    return data;
  },
  transferir: async (input: TransferirInput) => {
    const { data } = await apiClient.post('/movimientos/transferencias', input);
    return data as { salida: Movimiento; entrada: Movimiento };
  },
  cambioMoneda: async (input: CambioMonedaInput) => {
    const { data } = await apiClient.post('/movimientos/cambio-moneda', input);
    return data as { salida: Movimiento; entrada: Movimiento };
  },
  anular: async (id: string, motivo: string) => {
    const { data } = await apiClient.post(`/movimientos/${id}/anular`, { motivo });
    return data;
  },
};
