import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight, Loader2, Receipt, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select } from '@/components/ui/select';
import {
  chequesService,
  type Cheque,
  type EstadoCheque,
} from '@/services/chequesService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

const SIGUIENTES_ESTADOS: Record<EstadoCheque, EstadoCheque[]> = {
  EN_CARTERA: ['ENTREGADO', 'DEPOSITADO', 'ANULADO'],
  ENTREGADO: ['COBRADO', 'RECHAZADO', 'ANULADO'],
  DEPOSITADO: ['COBRADO', 'RECHAZADO', 'ANULADO'],
  EMITIDO: ['DEBITADO', 'RECHAZADO', 'ANULADO'],
  COBRADO: [],
  DEBITADO: [],
  RECHAZADO: [],
  ANULADO: [],
};

/**
 * Cartera de cheques: agrupada por vencimiento (al día, 0-15, 15-30, etc.)
 * Patrón tomado de Cocoguana.
 */
export function CarteraChequesDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [expandido, setExpandido] = useState<string | null>('EN_CARTERA');

  const { data: cheques = [], isLoading } = useQuery({
    queryKey: ['cheques', 'cartera'],
    queryFn: () => chequesService.list({}),
  });

  const grupos = useMemo(() => agruparPorVencimiento(cheques), [cheques]);

  const cambiarEstadoMut = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoCheque }) =>
      chequesService.cambiarEstado(id, estado),
    onSuccess: () => {
      toast.success('Estado actualizado');
      qc.invalidateQueries({ queryKey: ['cheques'] });
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo cambiar el estado',
      ),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl mt-8 mb-8 rounded-xl bg-card shadow-xl overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-accent text-white px-5 py-3 flex items-center justify-between">
          <div className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Cartera de cheques
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          {isLoading && (
            <div className="text-center py-10 text-muted">
              <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
              Cargando cheques…
            </div>
          )}
          {!isLoading && cheques.length === 0 && (
            <div className="text-center py-10 text-muted text-sm">
              No hay cheques cargados.
            </div>
          )}
          {!isLoading &&
            grupos.map((g) => (
              <GrupoCartera
                key={g.label}
                label={g.label}
                variant={g.variant}
                count={g.count}
                total={g.total}
                moneda={g.moneda}
                cheques={g.cheques}
                abierto={expandido === g.label}
                onToggle={() => setExpandido(expandido === g.label ? null : g.label)}
                onCambiar={(id, estado) => cambiarEstadoMut.mutate({ id, estado })}
              />
            ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3 flex items-center justify-between text-xs text-muted">
          <span>
            Total en cartera: <strong className="text-foreground">{cheques.length}</strong>{' '}
            cheques
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

function GrupoCartera({
  label,
  variant,
  count,
  total,
  moneda,
  cheques,
  abierto,
  onToggle,
  onCambiar,
}: {
  label: string;
  variant: 'default' | 'warning' | 'danger' | 'success' | 'muted';
  count: number;
  total: number;
  moneda: 'ARS' | 'USD';
  cheques: Cheque[];
  abierto: boolean;
  onToggle: () => void;
  onCambiar: (id: string, estado: EstadoCheque) => void;
}) {
  const clickable = count > 0;
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={clickable ? onToggle : undefined}
        disabled={!clickable}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
          clickable ? 'bg-card hover:bg-muted/5' : 'bg-muted/5 opacity-60'
        }`}
      >
        <div className="flex items-center gap-3">
          <Badge variant={variant}>{label}</Badge>
          <span className="text-sm text-muted">
            {count} cheque{count === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono font-semibold num">{formatearMonto(total, moneda)}</span>
          {clickable && (
            <ChevronRight
              className={`h-4 w-4 text-muted transition-transform ${abierto ? 'rotate-90' : ''}`}
            />
          )}
        </div>
      </button>
      {abierto && clickable && (
        <div className="border-t border-border bg-muted/5 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Librador / Titular</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cheques.map((c) => {
                const siguientes = SIGUIENTES_ESTADOS[c.estado];
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                    <TableCell className="text-xs">{c.banco ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {c.titular ?? c.librador ?? '—'}
                    </TableCell>
                    <TableCell className="num font-medium">
                      {formatearMonto(c.monto, c.moneda)}
                    </TableCell>
                    <TableCell className="num text-xs">{formatearFecha(c.fechaPago)}</TableCell>
                    <TableCell>
                      <Badge variant="muted">{c.estado}</Badge>
                    </TableCell>
                    <TableCell>
                      {siguientes.length > 0 && (
                        <Select
                          value=""
                          onChange={(e) =>
                            e.target.value &&
                            onCambiar(c.id, e.target.value as EstadoCheque)
                          }
                          className="w-32 text-xs"
                        >
                          <option value="">Cambiar…</option>
                          {siguientes.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ---------- helpers ----------

type Grupo = {
  label: string;
  variant: 'default' | 'warning' | 'danger' | 'success' | 'muted';
  count: number;
  total: number;
  moneda: 'ARS' | 'USD';
  cheques: Cheque[];
};

function agruparPorVencimiento(cheques: Cheque[]): Grupo[] {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diasHasta = (iso: string) => {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return (d.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
  };

  const pendientes = cheques.filter(
    (c) => c.estado === 'EN_CARTERA' || c.estado === 'EMITIDO' || c.estado === 'ENTREGADO',
  );

  const buckets: Array<{
    label: string;
    variant: Grupo['variant'];
    min: number;
    max: number;
  }> = [
    { label: 'VENCIDOS', variant: 'danger', min: -Infinity, max: -1 },
    { label: 'AL DÍA', variant: 'warning', min: 0, max: 0 },
    { label: '1 A 15 DÍAS', variant: 'default', min: 1, max: 15 },
    { label: '16 A 30 DÍAS', variant: 'default', min: 16, max: 30 },
    { label: '31 A 60 DÍAS', variant: 'default', min: 31, max: 60 },
    { label: '60+ DÍAS', variant: 'default', min: 61, max: Infinity },
  ];

  const porBucket = buckets.map((b) => {
    const lista = pendientes.filter((c) => {
      const d = diasHasta(c.fechaPago);
      return d >= b.min && d <= b.max;
    });
    const moneda = (lista[0]?.moneda ?? 'ARS') as 'ARS' | 'USD';
    return {
      label: b.label,
      variant: b.variant,
      count: lista.length,
      total: lista.reduce((acc, c) => acc + Number(c.monto), 0),
      moneda,
      cheques: lista,
    };
  });

  const cobrados = cheques.filter((c) => c.estado === 'COBRADO' || c.estado === 'DEBITADO');
  const rechazados = cheques.filter((c) => c.estado === 'RECHAZADO');

  return [
    ...porBucket,
    {
      label: 'COBRADOS / DEBITADOS',
      variant: 'success',
      count: cobrados.length,
      total: cobrados.reduce((acc, c) => acc + Number(c.monto), 0),
      moneda: (cobrados[0]?.moneda ?? 'ARS') as 'ARS' | 'USD',
      cheques: cobrados,
    },
    {
      label: 'RECHAZADOS',
      variant: 'danger',
      count: rechazados.length,
      total: rechazados.reduce((acc, c) => acc + Number(c.monto), 0),
      moneda: (rechazados[0]?.moneda ?? 'ARS') as 'ARS' | 'USD',
      cheques: rechazados,
    },
  ];
}
