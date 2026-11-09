import { apiClient } from '@/lib/apiClient';

export type Caja = {
  id: string;
  nombre: string;
  tipo: 'EFECTIVO' | 'BANCO' | 'CHEQUES_TERCEROS' | 'OTRO';
  moneda: 'ARS' | 'USD';
  saldoInicial: string;
  fechaSaldoInicial: string;
  activo: boolean;
};

export type SaldoCaja = {
  cajaId: string;
  nombre: string;
  moneda: 'ARS' | 'USD';
  saldo: string;
};

export const cajasService = {
  list: async (soloActivas = false) => {
    const { data } = await apiClient.get<Caja[]>('/cajas', {
      params: soloActivas ? { soloActivas: 'true' } : undefined,
    });
    return data;
  },
  saldos: async () => {
    const { data } = await apiClient.get<SaldoCaja[]>('/cajas/saldos');
    return data;
  },
  create: async (input: Omit<Caja, 'id' | 'activo'>) => {
    const { data } = await apiClient.post<Caja>('/cajas', input);
    return data;
  },
  update: async (id: string, input: Partial<Caja>) => {
    const { data } = await apiClient.patch<Caja>(`/cajas/${id}`, input);
    return data;
  },
  desactivar: async (id: string) => {
    const { data } = await apiClient.delete<Caja>(`/cajas/${id}`);
    return data;
  },
};
