import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header mobile — solo < md */}
        <header className="md:hidden flex items-center justify-between h-14 px-4 bg-card border-b border-border shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
            className="p-2 -ml-2 rounded-md hover:bg-muted/10 text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img src="/logo.png" alt="Cardi" className="h-8 w-auto" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>

        {/* Barra de navegación inferior — solo mobile */}
        <BottomNav onMenu={() => setSidebarOpen(true)} />
      </div>
    </div>
  );
}
