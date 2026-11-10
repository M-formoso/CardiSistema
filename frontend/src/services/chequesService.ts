import { apiClient } from '@/lib/apiClient';

export type TipoCheque = 'PROPIO' | 'TERCERO';
export type EstadoCheque =
  | 'EN_CARTERA'
  | 'ENTREGADO'
  | 'DEPOSITADO'
  | 'COBRADO'
  | 'EMITIDO'
  | 'DEBITADO'
  | 'RECHAZADO'
  | 'ANULADO';

export type Cheque = {
  id: string;
  tipo: TipoCheque;
  numero: string;
  banco?: string | null;
  sucursal?: string | null;
  librador?: string | null;
  titular?: string | null;
  cuit?: string | null;
  monto: string;
  moneda: 'ARS' | 'USD';
  fechaEmision: string;
  fechaPago: string;
  estado: EstadoCheque;
  beneficiarioId?: string | null;
  observaciones?: string | null;
  beneficiario?: { id: string; nombre: string; tipo: string } | null;
};

export type CreateChequeInput = {
  tipo: TipoCheque;
  numero: string;
  banco?: string;
  sucursal?: string;
  librador?: string;
  titular?: string;
  cuit?: string;
  monto: number;
  moneda?: 'ARS' | 'USD';
  fechaEmision: string;
  fechaPago: string;
  beneficiarioId?: string;
  observaciones?: string;
};

export const chequesService = {
  list: async (params: { tipo?: TipoCheque; estado?: EstadoCheque; q?: string } = {}) => {
    const { data } = await apiClient.get<Cheque[]>('/cheques', { params });
    return data;
  },
  get: async (id: string) => (await apiClient.get<Cheque>(`/cheques/${id}`)).data,
  create: async (input: CreateChequeInput) =>
    (await apiClient.post<Cheque>('/cheques', input)).data,
  cambiarEstado: async (id: string, estado: EstadoCheque, observacion?: string) =>
    (await apiClient.post<Cheque>(`/cheques/${id}/estado`, { estado, observacion })).data,
};
