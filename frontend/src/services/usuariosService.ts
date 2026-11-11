import { apiClient } from '@/lib/apiClient';

export type Rol = 'ADMIN' | 'CARGA' | 'CONSULTA';

export type Usuario = {
  id: string;
  username: string;
  nombre: string;
  email: string | null;
  rol: Rol;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { permisos: number };
};

export type UsuarioDetalle = Usuario & {
  permisos: Array<{ id: string; recurso: string; accion: string; concedido: boolean }>;
};

export type CreateUsuarioInput = {
  username: string;
  nombre: string;
  email?: string;
  rol: Rol;
  password: string;
};

export type UpdateUsuarioInput = {
  nombre?: string;
  email?: string | null;
  rol?: Rol;
};

export type PermisoInput = {
  recurso: string;
  accion: string;
  concedido?: boolean;
};

export const usuariosService = {
  list: async (soloActivos = false) => {
    const { data } = await apiClient.get<Usuario[]>('/usuarios', {
      params: soloActivos ? { soloActivos: 'true' } : undefined,
    });
    return data;
  },
  get: async (id: string) => {
    const { data } = await apiClient.get<UsuarioDetalle>(`/usuarios/${id}`);
    return data;
  },
  create: async (input: CreateUsuarioInput) => {
    const { data } = await apiClient.post<Usuario>('/usuarios', input);
    return data;
  },
  update: async (id: string, input: UpdateUsuarioInput) => {
    const { data } = await apiClient.patch<Usuario>(`/usuarios/${id}`, input);
    return data;
  },
  desactivar: async (id: string) => {
    const { data } = await apiClient.delete<Usuario>(`/usuarios/${id}`);
    return data;
  },
  activar: async (id: string) => {
    const { data } = await apiClient.post<Usuario>(`/usuarios/${id}/activar`);
    return data;
  },
  resetPassword: async (id: string, password: string) => {
    const { data } = await apiClient.post<{ ok: true }>(`/usuarios/${id}/reset-password`, {
      password,
    });
    return data;
  },
  setPermisos: async (id: string, permisos: PermisoInput[]) => {
    const { data } = await apiClient.put(`/usuarios/${id}/permisos`, { permisos });
    return data;
  },
};
