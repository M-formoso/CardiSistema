import { NavLink } from 'react-router-dom';
import { Wallet, HardHat, FileCheck2, FileBarChart2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Barra de navegación inferior para mobile — solo se muestra en < md.
 * 4 destinos principales + botón "Más" que abre el drawer del sidebar.
 * Inspirada en el patrón del sistema DevelopNet.
 */
export function BottomNav({ onMenu }: { onMenu: () => void }) {
  return (
    <nav
      className={cn(
        'md:hidden shrink-0 bg-card border-t border-border',
        'flex items-stretch justify-around',
        // Safe-area para dispositivos con home indicator (iPhone)
        'pb-[env(safe-area-inset-bottom,0)]',
      )}
    >
      <BottomItem to="/" icon={Wallet} label="Billetera" end />
      <BottomItem to="/empleados" icon={HardHat} label="Empleados" />
      <BottomItem to="/certificaciones" icon={FileCheck2} label="Certifs." />
      <BottomItem to="/reportes" icon={FileBarChart2} label="Reportes" />
      <button
        type="button"
        onClick={onMenu}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-muted hover:text-foreground transition-colors"
        aria-label="Más opciones"
      >
        <MoreHorizontal className="h-5 w-5" />
        <span className="text-[10px] leading-none">Más</span>
      </button>
    </nav>
  );
}

function BottomItem({
  to,
  icon: Icon,
  label,
  end,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors relative',
          isActive ? 'text-primary' : 'text-muted hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-5 w-5" />
          <span className="text-[10px] leading-none">{label}</span>
          {isActive && (
            <span className="absolute top-0 inset-x-6 h-0.5 bg-primary rounded-b" />
          )}
        </>
      )}
    </NavLink>
  );
}
