import { NavLink } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  CreditCard,
  FileBarChart2,
  Settings2,
  UsersRound,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { Logo } from './Logo';

const NAV = [
  { to: '/', label: 'Billetera', icon: Wallet, end: true },
  { to: '/pagos', label: 'Pagos', icon: CreditCard },
  { to: '/reportes', label: 'Reportes', icon: FileBarChart2 },
];

const ADMIN_NAV = [
  { to: '/configuracion', label: 'Configuración', icon: Settings2 },
  { to: '/usuarios', label: 'Usuarios', icon: UsersRound },
];

export function Sidebar() {
  const { usuario, refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();
  const esAdmin = usuario?.rol === 'ADMIN';

  const inicial = (usuario?.nombre ?? usuario?.username ?? '?').trim().charAt(0).toUpperCase();

  const handleLogout = async () => {
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch {
      /* ignoramos: igual limpiamos sesión local */
    } finally {
      logout();
      toast.success('Sesión cerrada');
      navigate('/login', { replace: true });
    }
  };

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col border-r border-border bg-card">
      <div className="h-24 flex items-center justify-center px-4 border-b border-border">
        <Logo />
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {NAV.map((item) => (
          <SidebarItem key={item.to} {...item} />
        ))}

        {esAdmin && (
          <>
            <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
              Administración
            </div>
            {ADMIN_NAV.map((item) => (
              <SidebarItem key={item.to} {...item} />
            ))}
          </>
        )}
      </nav>
      <div className="border-t border-border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
            {inicial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">
              {usuario?.nombre ?? usuario?.username ?? 'Usuario'}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted">
              {usuario?.rol ?? '—'}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted hover:text-foreground hover:bg-muted/10 rounded-md transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
          isActive
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-foreground hover:bg-muted/10',
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}
