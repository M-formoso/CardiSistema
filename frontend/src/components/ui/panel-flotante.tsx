import { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Panel flotante que el usuario puede arrastrar con el cursor.
 * Pensado para el modo "selección múltiple" de la tabla de movimientos:
 * aparece abajo-derecha cuando hay items seleccionados y queda visible
 * hasta que se cierran o se deseleccionan todos.
 *
 * - Arranca en la esquina inferior derecha (ajustable con `initial`).
 * - Se arrastra desde el handle del header (ícono grip + título).
 * - Queda dentro del viewport (clamp).
 * - Estado de posición vive en el componente (no persiste entre recargas).
 */
export function PanelFlotante({
  title,
  onClose,
  children,
  className,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const draggingRef = useRef<{ dx: number; dy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Inicializa posición al montar en esquina inferior derecha.
  useEffect(() => {
    if (pos) return;
    const w = panelRef.current?.offsetWidth ?? 300;
    const h = panelRef.current?.offsetHeight ?? 160;
    setPos({
      x: window.innerWidth - w - 20,
      y: window.innerHeight - h - 20,
    });
  }, [pos]);

  // Reclampa si cambia el tamaño de la ventana (ej. rotar mobile)
  useEffect(() => {
    const onResize = () => {
      setPos((p) => {
        if (!p) return p;
        const w = panelRef.current?.offsetWidth ?? 300;
        const h = panelRef.current?.offsetHeight ?? 160;
        return {
          x: Math.min(Math.max(0, p.x), window.innerWidth - w),
          y: Math.min(Math.max(0, p.y), window.innerHeight - h),
        };
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onMouseDownHandle = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    draggingRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = draggingRef.current;
      if (!d || !panelRef.current) return;
      const w = panelRef.current.offsetWidth;
      const h = panelRef.current.offsetHeight;
      const nx = Math.min(Math.max(0, e.clientX - d.dx), window.innerWidth - w);
      const ny = Math.min(Math.max(0, e.clientY - d.dy), window.innerHeight - h);
      setPos({ x: nx, y: ny });
    };
    const onUp = () => {
      draggingRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed z-50 min-w-[260px] max-w-[360px] rounded-lg border border-border bg-card shadow-2xl',
        className,
      )}
      style={{
        left: pos?.x ?? -9999,
        top: pos?.y ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border cursor-move select-none bg-muted/5 rounded-t-lg"
        onMouseDown={onMouseDownHandle}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="h-3.5 w-3.5 text-muted shrink-0" />
          <span className="text-xs font-semibold text-foreground truncate">{title}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="p-1 -mr-1 text-muted hover:text-foreground rounded hover:bg-muted/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-3 py-2.5">{children}</div>
    </div>
  );
}
