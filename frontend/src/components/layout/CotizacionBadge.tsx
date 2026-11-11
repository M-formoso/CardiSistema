import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingDown, TrendingUp, RefreshCw } from 'lucide-react';
import { cotizacionesService } from '@/services/cotizacionesService';
import { formatearFechaHora, formatearMonto } from '@/lib/formatters';

/**
 * Widget compacto del Topbar que muestra el dólar blue del día.
 * Click → popover con compra/venta/fuente/última actualización.
 */
export function CotizacionBadge() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cotizacion', 'hoy'],
    queryFn: cotizacionesService.hoy,
    staleTime: 15 * 60 * 1000,
    retry: false,
  });

  // Cerrar popover al click afuera
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const cot = data?.cotizaciones[0];

  if (isLoading) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted animate-pulse">
        <DollarSign className="h-3 w-3" />
        Cargando blue…
      </div>
    );
  }

  if (!cot) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted" title="Sin cotización">
        <DollarSign className="h-3 w-3" />
        s/d
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted/10 transition-colors"
        title="Dólar blue del día"
      >
        <span className="text-[10px] uppercase tracking-wider text-muted font-semibold">
          Blue
        </span>
        <span className="text-sm font-bold text-primary num">
          {formatearMonto(cot.venta, 'ARS')}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-lg shadow-xl z-30 overflow-hidden">
          <div className="bg-primary/5 px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                  Dólar Blue
                </div>
                <div className="text-xl font-bold text-primary num">
                  {formatearMonto(cot.venta, 'ARS')}
                </div>
              </div>
              <button
                onClick={() => refetch()}
                className="text-muted hover:text-primary transition-colors p-1"
                title="Actualizar"
                disabled={isFetching}
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  Compra
                </div>
                <div className="text-sm font-bold num mt-0.5">
                  {formatearMonto(cot.compra, 'ARS')}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Venta
                </div>
                <div className="text-sm font-bold num mt-0.5">
                  {formatearMonto(cot.venta, 'ARS')}
                </div>
              </div>
            </div>
            <div className="border-t border-border pt-2">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Fuente</span>
                <span className="font-mono text-foreground">{data.fuentePrimaria}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted mt-1">
                <span>Actualizado</span>
                <span className="text-foreground">{formatearFechaHora(data.actualizadoAt)}</span>
              </div>
            </div>
            <div className="text-[10px] text-muted leading-relaxed">
              Esta cotización se congela en cada movimiento al momento de registrarlo.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
