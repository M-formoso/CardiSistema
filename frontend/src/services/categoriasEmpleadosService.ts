import { apiClient } from '@/lib/apiClient';

export type CategoriaEmpleado = {
  id: string;
  codigo: string;
  nombre: string;
  jornal?: string | null;
  valorHoraExtra?: string | null;
  orden: number;
  activo: boolean;
  _count?: { empleados: number };
};

export type CategoriaEmpleadoHistoricoEntry = {
  id: string;
  jornal: string;
  valorHoraExtra?: string | null;
  vigenteDesde: string;
  motivo?: string | null;
  empleadosAfectados: number;
  createdAt: string;
};

export type CategoriaEmpleadoDetalle = CategoriaEmpleado & {
  historial: CategoriaEmpleadoHistoricoEntry[];
};

export const categoriasEmpleadosService = {
  list: async (params?: { activo?: boolean }) =>
    (await apiClient.get<CategoriaEmpleado[]>('/categorias-empleados', { params })).data,
  get: async (id: string) =>
    (await apiClient.get<CategoriaEmpleadoDetalle>(`/categorias-empleados/${id}`)).data,
  create: async (input: {
    codigo: string;
    nombre: string;
    jornal?: number;
    valorHoraExtra?: number;
    orden?: number;
  }) => (await apiClient.post<CategoriaEmpleado>('/categorias-empleados', input)).data,
  update: async (
    id: string,
    input: Partial<{ codigo: string; nombre: string; orden: number; activo: boolean }>,
  ) => (await apiClient.patch<CategoriaEmpleado>(`/categorias-empleados/${id}`, input)).data,
  actualizarJornal: async (
    id: string,
    input: { jornal: number; valorHoraExtra?: number; motivo?: string; propagarATodos?: boolean },
  ) =>
    (
      await apiClient.put<{ empleadosAfectados: number; total: number }>(
        `/categorias-empleados/${id}/jornal`,
        input,
      )
    ).data,
  desactivar: async (id: string) =>
    (await apiClient.delete<CategoriaEmpleado>(`/categorias-empleados/${id}`)).data,
};
