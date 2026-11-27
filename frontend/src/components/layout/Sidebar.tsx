import { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Wallet,
  FileBarChart2,
  FileCheck2,
  HardHat,
  Settings2,
  Truck,
  Car,
  UsersRound,
  LogOut,
  Moon,
  Sun,
  Monitor,
  X,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { useTheme, type Tema } from '@/stores/themeStore';
import { Logo } from './Logo';

const NAV = [
  { to: '/', label: 'Billetera', icon: Wallet, end: true },
  { to: '/empleados', label: 'Empleados', icon: HardHat },
  { to: '/certificaciones', label: 'Certificaciones', icon: FileCheck2 },
  { to: '/proveedores', label: 'Proveedores', icon: Truck },
  { to: '/vehiculos', label: 'Vehículos', icon: Car },
  { to: '/reportes', label: 'Reportes', icon: FileBarChart2 },
];

const ADMIN_NAV = [
  { to: '/configuracion', label: 'Configuración', icon: Settings2 },
  { to: '/usuarios', label: 'Usuarios', icon: UsersRound },
];

type Props = {
  /** Controla la apertura del drawer en pantallas < md. En desktop se ignora (siempre visible). */
  open: boolean;
  onClose: () => void;
  /** En desktop: colapsa el sidebar a solo íconos. Persistido por AppLayout. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function Sidebar({ open, onClose, collapsed, onToggleCollapsed }: Props) {
  const { usuario, refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { tema, setTema } = useTheme();
  const esAdmin = usuario?.rol === 'ADMIN';

  const inicial = (usuario?.nombre ?? usuario?.username ?? '?').trim().charAt(0).toUpperCase();

  // Cerrar el drawer al navegar
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Esc cierra el drawer y bloqueamos el scroll del body cuando está abierto en mobile
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

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
    <>
      {/* Backdrop en mobile */}
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          'md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />

      <aside
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 h-full flex flex-col shrink-0',
          'border-r border-border bg-card',
          'transform transition-[transform,width] duration-200 ease-out',
          // Mobile: ancho fijo 64; desktop: 56 si colapsado, 52 si no.
          // Reunión Dani 26/11: sidebar más angosto que antes (w-60 → w-52).
          'w-64',
          collapsed ? 'md:w-16' : 'md:w-52',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div
          className={cn(
            'h-24 flex items-center px-4 border-b border-border relative',
            collapsed ? 'md:justify-center md:px-2' : 'justify-center',
          )}
        >
          {collapsed ? (
            // Logo reducido: solo la "C" grande centrada
            <div className="hidden md:flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-lg">
              C
            </div>
          ) : (
            <Logo />
          )}
          {/* En mobile el logo completo se muestra siempre (ignora collapsed) */}
          {collapsed && <div className="md:hidden"><Logo /></div>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="md:hidden absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-foreground rounded-md hover:bg-muted/10"
          >
            <X className="h-5 w-5" />
          </button>
          {/* Botón colapsar/expandir — solo desktop */}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted hover:text-foreground shadow-sm z-10"
          >
            {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {NAV.map((item) => (
            <SidebarItem key={item.to} {...item} collapsed={collapsed} />
          ))}

          {esAdmin && (
            <>
              {!collapsed && (
                <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Administración
                </div>
              )}
              {collapsed && <div className="pt-4 border-t border-border/50 mx-2" />}
              {ADMIN_NAV.map((item) => (
                <SidebarItem key={item.to} {...item} collapsed={collapsed} />
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-border p-3 space-y-2">
          {/* Toggle de tema — oculto cuando está colapsado (ocupa mucho) */}
          {!collapsed && (
            <div className="flex items-center gap-1 bg-muted/10 rounded-md p-0.5">
              {([
                { v: 'light', icon: Sun, label: 'Claro' },
                { v: 'system', icon: Monitor, label: 'Sistema' },
                { v: 'dark', icon: Moon, label: 'Oscuro' },
              ] as Array<{ v: Tema; icon: typeof Sun; label: string }>).map((opt) => {
                const Icon = opt.icon;
                const activo = tema === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setTema(opt.v)}
                    title={opt.label}
                    aria-label={`Tema ${opt.label.toLowerCase()}`}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1 py-1 rounded transition-colors text-[11px]',
                      activo
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          )}

          <div className={cn('flex items-center gap-2', collapsed && 'md:justify-center')}>
            <div
              className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold text-sm shrink-0"
              title={collapsed ? (usuario?.nombre ?? usuario?.username ?? 'Usuario') : undefined}
            >
              {inicial}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {usuario?.nombre ?? usuario?.username ?? 'Usuario'}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted">
                  {usuario?.rol ?? '—'}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Cerrar sesión' : undefined}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted hover:text-foreground hover:bg-muted/10 rounded-md transition-colors',
              collapsed && 'md:justify-center',
            )}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && 'Cerrar sesión'}
          </button>
        </div>
      </aside>
    </>
  );
}

function SidebarItem({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  collapsed?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
          collapsed && 'md:justify-center md:px-2',
          isActive
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-foreground hover:bg-muted/10',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn(collapsed && 'md:hidden')}>{label}</span>
    </NavLink>
  );
}
