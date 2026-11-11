import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { toast } from 'sonner';
import { CotizacionBadge } from './CotizacionBadge';

export function Topbar() {
  const { usuario, refreshToken, logout } = useAuthStore();

  const onLogout = async () => {
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch {
      // seguimos con el logout local aunque el backend falle
    }
    logout();
    toast.success('Sesión cerrada');
  };

  return (
    <header className="h-16 border-b border-border bg-card px-4 flex items-center justify-between">
      <div className="text-sm text-muted hidden md:block">Gestión de gastos por obra</div>
      <div className="flex items-center gap-3 ml-auto">
        <CotizacionBadge />
        {usuario && (
          <div className="text-sm">
            <div className="font-medium">{usuario.nombre}</div>
            <div className="text-xs text-muted">{usuario.rol}</div>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Cerrar sesión">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
