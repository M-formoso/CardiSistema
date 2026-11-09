import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function RutaProtegida() {
  const { accessToken, usuario } = useAuthStore();
  const location = useLocation();

  if (!accessToken || !usuario) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
