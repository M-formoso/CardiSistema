import { apiClient } from '@/lib/apiClient';

export type TipoCategoria = 'INGRESO' | 'SERVICIO' | 'PROVEEDOR' | 'EMPLEADO' | 'GENERAL';

export type Categoria = {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
  parentId?: string | null;
  tipo: TipoCategoria;
  vinculadaVehiculo: boolean;
  aliases?: Array<{ id: string; texto: string }>;
};

export type CategoriasFiltros = {
  tipo?: TipoCategoria;
  soloActivas?: boolean;
  vinculadaVehiculo?: boolean;
};

export type CategoriaCreateInput = {
  codigo: string;
  nombre: string;
  orden?: number;
  tipo?: TipoCategoria;
  vinculadaVehiculo?: boolean;
};

export const categoriasService = {
  list: async (filtros: CategoriasFiltros | boolean = {}) => {
    // Retrocompat: `list(true)` = `list({ soloActivas: true })`
    const params: Record<string, string> =
      typeof filtros === 'boolean'
        ? filtros
          ? { soloActivas: 'true' }
          : {}
        : {
            ...(filtros.soloActivas ? { soloActivas: 'true' } : {}),
            ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
            ...(filtros.vinculadaVehiculo !== undefined
              ? { vinculadaVehiculo: String(filtros.vinculadaVehiculo) }
              : {}),
          };
    const { data } = await apiClient.get<Categoria[]>('/categorias', { params });
    return data;
  },
  create: async (input: CategoriaCreateInput) => {
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
