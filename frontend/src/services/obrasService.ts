import { apiClient } from '@/lib/apiClient';

export type Obra = {
  id: string;
  nombre: string;
  tipo: 'OBRA' | 'UNIDAD_NEGOCIO' | 'GENERAL';
  comitente?: string | null;
  constructora?: string | null;
  ubicacion?: string | null;
  fechaInicio?: string | null;
  estado: 'EN_LICITACION' | 'ACTIVA' | 'PAUSADA' | 'TERMINADA';
  montoContratado?: string | null;
  monedaContrato?: 'ARS' | 'USD' | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateObraInput = {
  nombre: string;
  tipo: Obra['tipo'];
  comitente?: string;
  constructora?: string;
  ubicacion?: string;
  fechaInicio?: string;
  estado?: Obra['estado'];
  montoContratado?: number;
  monedaContrato?: 'ARS' | 'USD';
};

export const obrasService = {
  list: async (params?: { q?: string; estado?: string; activo?: boolean }) => {
    const { data } = await apiClient.get<Obra[]>('/obras', { params });
    return data;
  },
  get: async (id: string) => {
    const { data } = await apiClient.get<Obra>(`/obras/${id}`);
    return data;
  },
  create: async (input: Partial<CreateObraInput>) => {
    const { data } = await apiClient.post<Obra>('/obras', input);
    return data;
  },
  update: async (id: string, input: Partial<CreateObraInput>) => {
    const { data } = await apiClient.patch<Obra>(`/obras/${id}`, input);
    return data;
  },
  desactivar: async (id: string) => {
    const { data } = await apiClient.delete<Obra>(`/obras/${id}`);
    return data;
  },
};
