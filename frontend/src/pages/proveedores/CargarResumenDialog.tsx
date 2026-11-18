import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { proveedoresService } from '@/services/proveedoresService';
import { obrasService } from '@/services/obrasService';
import { formatearMonto } from '@/lib/formatters';

type Linea = { obraId: string; monto: string };

/**
 * Dialog para cargar un nuevo resumen de cuenta corriente de un proveedor.
 * Fecha + N líneas (obra + monto). El total se calcula en vivo.
 * Unique por (proveedorId, fecha) — el backend valida.
 */
export function CargarResumenDialog({
  proveedorId,
  onClose,
}: {
  proveedorId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([{ obraId: '', monto: '' }]);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras', { activo: true }],
    queryFn: () => obrasService.list({ activo: true }),
  });

  const obrasOpts = useMemo<ComboboxOption[]>(
    () => obras.map((o) => ({ value: o.id, label: o.nombre })),
    [obras],
  );

  const totalNum = useMemo(
    () => lineas.reduce((acc, l) => acc + (Number(l.monto) || 0), 0),
    [lineas],
  );

  const errorValidacion = useMemo<string | null>(() => {
    if (lineas.length === 0) return 'Agregá al menos una obra';
    if (lineas.some((l) => !l.obraId)) return 'Falta elegir obra en alguna línea';
    const obraIds = lineas.map((l) => l.obraId);
    const unicos = new Set(obraIds);
    if (unicos.size !== obraIds.length) {
      return 'No se puede repetir la misma obra en el resumen';
    }
    if (lineas.some((l) => !l.monto || Number(l.monto) <= 0)) {
      return 'Cada obra tiene que tener un monto mayor a 0';
    }
    return null;
  }, [lineas]);
  const puedeEnviar = errorValidacion === null;

  const m = useMutation({
    mutationFn: () =>
      proveedoresService.crearResumen(proveedorId, {
        fecha,
        observaciones: observaciones.trim() || undefined,
        items: lineas.map((l) => ({ obraId: l.obraId, monto: Number(l.monto) })),
      }),
    onSuccess: () => {
      toast.success('Resumen cargado');
      qc.invalidateQueries({ queryKey: ['proveedor', proveedorId] });
      qc.invalidateQueries({ queryKey: ['proveedores'] });
      onClose();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo cargar',
      ),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cargar resumen de cuenta corriente</DialogTitle>
          <DialogDescription>
            La "foto" del estado de cuenta a una fecha, desglosado por obra. El saldo actual se
            calcula como este resumen menos los pagos que hagas después.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!puedeEnviar) {
              toast.error('Revisá los datos: fecha, obras únicas y montos');
              return;
            }
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha del resumen *</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Desglose por obra *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setLineas((prev) => [...prev, { obraId: '', monto: '' }])
                }
              >
                <Plus className="h-3 w-3 mr-1" />
                Agregar obra
              </Button>
            </div>
            <div className="space-y-2">
              {lineas.map((l, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_160px_auto] gap-2 items-center">
                  <Combobox
                    options={obrasOpts}
                    value={l.obraId}
                    onChange={(v) =>
                      setLineas((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, obraId: v } : x)),
                      )
                    }
                    placeholder="Elegí obra…"
                    searchPlaceholder="Buscar obra…"
                  />
                  <MoneyInput
                    placeholder="Monto"
                    value={l.monto}
                    onChange={(v) =>
                      setLineas((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, monto: v } : x)),
                      )
                    }
                  />
                  {lineas.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setLineas((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
              {errorValidacion ? (
                <span className="text-danger">{errorValidacion}</span>
              ) : (
                <span />
              )}
              <span className="text-muted">
                Total:{' '}
                <span className="font-semibold num text-foreground">
                  {formatearMonto(totalNum, 'ARS')}
                </span>
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observaciones (opcional)</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Notas, aclaraciones, nro. de resumen que te mandó el proveedor…"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!puedeEnviar || m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cargar resumen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
