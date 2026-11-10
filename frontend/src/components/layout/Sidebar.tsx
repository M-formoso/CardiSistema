import { NavLink } from 'react-router-dom';
import {
  Home,
  Wallet,
  Building2,
  Users,
  CalendarClock,
  FileBarChart2,
  Receipt,
  Tag,
  Banknote,
  FileCheck2,
  FileText,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';

const NAV = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/movimientos', label: 'Movimientos', icon: Wallet },
  { to: '/cheques', label: 'Cheques', icon: ScrollText },
  { to: '/cajas', label: 'Cajas', icon: Banknote },
  { to: '/obras', label: 'Obras', icon: Building2 },
  { to: '/beneficiarios', label: 'Beneficiarios', icon: Users },
  { to: '/categorias', label: 'Categorías', icon: Tag },
  { to: '/liquidaciones', label: 'Liquidaciones', icon: Receipt },
  { to: '/certificaciones', label: 'Certificaciones', icon: FileCheck2 },
  { to: '/contratos', label: 'Contratos cuotas', icon: FileText },
  { to: '/compromisos', label: 'Compromisos', icon: CalendarClock },
  { to: '/reportes', label: 'Reportes', icon: FileBarChart2 },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col border-r border-border bg-card">
      <div className="h-16 flex items-center px-4 border-b border-border">
        <Logo />
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
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
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="p-3 text-xs text-muted border-t border-border">
        Sistema Cardi · v0.1
      </div>
    </aside>
  );
}
