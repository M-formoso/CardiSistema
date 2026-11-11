import { NavLink } from 'react-router-dom';
import {
  Wallet,
  CreditCard,
  FileBarChart2,
  Settings2,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
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
  const { usuario } = useAuthStore();
  const esAdmin = usuario?.rol === 'ADMIN';

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col border-r border-border bg-card">
      <div className="h-16 flex items-center px-4 border-b border-border">
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
      <div className="p-3 text-xs text-muted border-t border-border">
        Sistema Cardi · v0.1
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
