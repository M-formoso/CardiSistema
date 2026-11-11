import { useEffect, useState } from 'react';
import { Download, Share, Plus, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  esSafariIos,
  esStandalone,
  fueDismissedRecientemente,
  marcarDismissed,
} from '@/utils/pwa';

/** Evento beforeinstallprompt — Chrome/Edge (Android y desktop). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Invita a instalar Cardi como app.
 * - Android/desktop Chrome: captura `beforeinstallprompt` y muestra un banner
 *   con botón "Instalar" que dispara el prompt nativo del browser.
 * - iOS Safari: no hay prompt programático, mostramos un mini tutorial visual
 *   (Compartir → Agregar a inicio).
 * - Si ya está instalada (display-mode: standalone), no muestra nada.
 * - Si se cierra con la X, no vuelve a aparecer por 7 días.
 *
 * Aparece inmediato al cargar (ideal mostrarlo apenas vean el login).
 */
export function InstallPrompt() {
  const [androidEvent, setAndroidEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [androidVisible, setAndroidVisible] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);
  const [iosTutorial, setIosTutorial] = useState(false);

  useEffect(() => {
    if (esStandalone()) return;
    if (fueDismissedRecientemente()) return;

    // Android / desktop Chrome
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setAndroidEvent(e as BeforeInstallPromptEvent);
      setTimeout(() => setAndroidVisible(true), 1200);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS Safari — no hay evento, mostramos banner un poco después
    if (esSafariIos()) {
      setTimeout(() => setIosOpen(true), 1500);
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const cerrarAndroid = () => {
    marcarDismissed();
    setAndroidVisible(false);
  };

  const cerrarIos = () => {
    marcarDismissed();
    setIosOpen(false);
    setIosTutorial(false);
  };

  const instalarAndroid = async () => {
    if (!androidEvent) return;
    await androidEvent.prompt();
    const choice = await androidEvent.userChoice;
    setAndroidEvent(null);
    setAndroidVisible(false);
    if (choice.outcome === 'dismissed') marcarDismissed();
  };

  return (
    <>
      {/* ANDROID / DESKTOP CHROME — banner inferior */}
      {androidVisible && androidEvent && (
        <div className="fixed bottom-4 left-4 right-4 z-50 lg:left-auto lg:right-4 lg:max-w-sm animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="rounded-xl border border-border bg-card shadow-xl p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <img src="/pwa-192x192.png" alt="Cardi" className="h-10 w-10 object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">Instalar Cardi</p>
              <p className="text-xs text-muted">Acceso directo desde tu escritorio o home.</p>
            </div>
            <Button size="sm" onClick={instalarAndroid}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Instalar
            </Button>
            <button
              onClick={cerrarAndroid}
              aria-label="Cerrar"
              className="h-8 w-8 rounded-md hover:bg-muted/10 flex items-center justify-center text-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* iOS — banner inferior que abre un overlay con instrucciones */}
      {iosOpen && !iosTutorial && (
        <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="rounded-xl border border-border bg-card shadow-xl p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <img src="/pwa-192x192.png" alt="Cardi" className="h-10 w-10 object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">Instalar Cardi</p>
              <p className="text-xs text-muted">Como app en tu iPhone — 2 toques.</p>
            </div>
            <Button size="sm" onClick={() => setIosTutorial(true)}>
              Cómo
            </Button>
            <button
              onClick={cerrarIos}
              aria-label="Cerrar"
              className="h-8 w-8 rounded-md hover:bg-muted/10 flex items-center justify-center text-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* iOS — overlay con las instrucciones */}
      {iosTutorial && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={cerrarIos}
          />
          <div className="relative bg-card w-full rounded-t-2xl shadow-xl max-w-md mx-4 mb-0 p-6 animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <Smartphone className="h-6 w-6 text-primary" />
                <h2 className="text-lg font-bold">Instalar Cardi</h2>
              </div>
              <button
                onClick={cerrarIos}
                aria-label="Cerrar"
                className="h-8 w-8 rounded-md hover:bg-muted/10 flex items-center justify-center text-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted mb-5">
              Asegurate de estar en <strong>Safari</strong> (no funciona en Chrome para iOS).
            </p>

            <ol className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="h-7 w-7 shrink-0 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
                  1
                </span>
                <p className="text-sm">
                  Tocá el botón{' '}
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-muted/10 mx-1">
                    <Share className="h-3.5 w-3.5 text-primary" />
                  </span>{' '}
                  <strong>Compartir</strong> en la barra inferior.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-7 w-7 shrink-0 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
                  2
                </span>
                <p className="text-sm">
                  Bajá y elegí{' '}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/10 mx-0.5 text-xs font-medium">
                    <Plus className="h-3 w-3" />
                    Agregar a inicio
                  </span>
                  .
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-7 w-7 shrink-0 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
                  3
                </span>
                <p className="text-sm">
                  Confirmá <strong>Agregar</strong>. Vas a ver el ícono de Cardi en tu home como
                  cualquier otra app.
                </p>
              </li>
            </ol>

            <Button onClick={cerrarIos} variant="outline" className="w-full mt-6">
              Entendido
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
