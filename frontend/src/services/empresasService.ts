import { apiClient } from '@/lib/apiClient';

export type Empresa = {
  id: string;
  nombre: string;
  cuit?: string | null;
  activo: boolean;
  createdAt: string;
  _count?: { empleados: number };
};

export const empresasService = {
  list: async (params?: { activo?: boolean; q?: string }) =>
    (await apiClient.get<Empresa[]>('/empresas', { params })).data,
  get: async (id: string) => (await apiClient.get<Empresa>(`/empresas/${id}`)).data,
  create: async (input: { nombre: string; cuit?: string; activo?: boolean }) =>
    (await apiClient.post<Empresa>('/empresas', input)).data,
  update: async (id: string, input: Partial<{ nombre: string; cuit: string | null; activo: boolean }>) =>
    (await apiClient.patch<Empresa>(`/empresas/${id}`, input)).data,
  desactivar: async (id: string) => (await apiClient.delete<Empresa>(`/empresas/${id}`)).data,
};
