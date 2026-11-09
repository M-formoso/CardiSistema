import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UsuarioSesion = {
  id: string;
  nombre: string;
  email: string;
  rol: 'ADMIN' | 'CARGA' | 'CONSULTA';
  permisos?: string[];
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  usuario: UsuarioSesion | null;
  setSession: (p: { accessToken: string; refreshToken: string; usuario: UsuarioSesion }) => void;
  setTokens: (p: { accessToken: string; refreshToken: string }) => void;
  setUsuario: (u: UsuarioSesion) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      setSession: ({ accessToken, refreshToken, usuario }) =>
        set({ accessToken, refreshToken, usuario }),
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      setUsuario: (usuario) => set({ usuario }),
      logout: () => set({ accessToken: null, refreshToken: null, usuario: null }),
    }),
    { name: 'cardi-auth' },
  ),
);
