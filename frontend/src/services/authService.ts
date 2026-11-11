import { apiClient } from '@/lib/apiClient';
import type { UsuarioSesion } from '@/stores/authStore';

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioSesion;
};

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', { username, password });
    return data;
  },
  async logout(refreshToken: string): Promise<void> {
    await apiClient.post('/auth/logout', { refreshToken });
  },
  async me(): Promise<UsuarioSesion> {
    const { data } = await apiClient.get<UsuarioSesion>('/auth/me');
    return data;
  },
};
