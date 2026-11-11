import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header mobile — solo < md */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-card border-b border-border">
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
      </div>
    </div>
  );
}
