import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { Button } from '@/components/ui/button';

/**
 * Muestra un toast cuando hay una versión nueva de la PWA.
 * El SW lo registramos con `registerType: 'prompt'` en vite.config.ts
 * así el usuario decide cuándo recargar (en vez de un auto-update silencioso
 * que podría cortar un formulario que está completando).
 */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [actualizar, setActualizar] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const update = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegistered(reg: ServiceWorkerRegistration | undefined) {
        // Chequear actualizaciones cada hora mientras la app está abierta
        if (reg) {
          setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
        }
      },
    });
    setActualizar(() => () => update(true));
  }, []);

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-10 fade-in duration-300">
      <div className="rounded-xl border border-border bg-card shadow-xl p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <RefreshCw className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Hay una versión nueva</p>
          <p className="text-xs text-muted">Recargá para actualizar.</p>
        </div>
        <Button size="sm" onClick={() => actualizar?.()}>
          Recargar
        </Button>
      </div>
    </div>
  );
}
