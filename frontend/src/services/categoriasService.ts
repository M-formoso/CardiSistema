import { apiClient } from '@/lib/apiClient';

export type Categoria = {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
  parentId?: string | null;
  aliases?: Array<{ id: string; texto: string }>;
};

export const categoriasService = {
  list: async (soloActivas = false) => {
    const { data } = await apiClient.get<Categoria[]>('/categorias', {
      params: soloActivas ? { soloActivas: 'true' } : undefined,
    });
    return data;
  },
  create: async (input: { codigo: string; nombre: string; orden?: number }) => {
    const { data } = await apiClient.post<Categoria>('/categorias', input);
    return data;
  },
  update: async (id: string, input: Partial<Categoria>) => {
    const { data } = await apiClient.patch<Categoria>(`/categorias/${id}`, input);
    return data;
  },
  desactivar: async (id: string) => {
    const { data } = await apiClient.delete<Categoria>(`/categorias/${id}`);
    return data;
  },
};
