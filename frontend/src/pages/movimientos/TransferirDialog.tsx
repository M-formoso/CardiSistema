import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { movimientosService } from '@/services/movimientosService';
import { cajasService } from '@/services/cajasService';

export function TransferirDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [origenId, setOrigenId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas', 'activas'],
    queryFn: () => cajasService.list(true),
  });

  // Solo permitimos origen y destino de la MISMA moneda
  const origen = cajas.find((c) => c.id === origenId);
  const destinosPosibles = cajas.filter((c) => c.id !== origenId && c.moneda === origen?.moneda);

  const origenOpts = useMemo<ComboboxOption[]>(
    () => cajas.map((c) => ({ value: c.id, label: c.nombre, hint: `${c.moneda} · ${c.tipo}` })),
    [cajas],
  );
  const destinoOpts = useMemo<ComboboxOption[]>(
    () => destinosPosibles.map((c) => ({ value: c.id, label: c.nombre, hint: `${c.moneda} · ${c.tipo}` })),
    [destinosPosibles],
  );

  const m = useMutation({
    mutationFn: () =>
      movimientosService.transferir({
        fecha,
        cajaOrigenId: origenId,
        cajaDestinoId: destinoId,
        monto: Number(monto),
        descripcion: descripcion.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Transferencia registrada');
      setMonto('');
      setDescripcion('');
      onCreated();
    },
    onError: (err) => {
      toast.error(
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'No se pudo',
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir entre cajas</DialogTitle>
          <DialogDescription>
            Solo entre cajas de la misma moneda. Para cambio USD↔ARS usá "Cambio".
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!origenId || !destinoId || !monto) return toast.error('Completá todos los campos');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Caja origen *</Label>
              <Combobox
                options={origenOpts}
                value={origenId}
                onChange={(v) => {
                  setOrigenId(v);
                  setDestinoId('');
                }}
                placeholder="Elegí caja…"
                searchPlaceholder="Buscar caja…"
              />
            </div>
            <div className="space-y-2">
              <Label>Caja destino *</Label>
              {origenId ? (
                <Combobox
                  options={destinoOpts}
                  value={destinoId}
                  onChange={setDestinoId}
                  placeholder="Elegí caja…"
                  searchPlaceholder="Buscar caja…"
                />
              ) : (
                <div className="h-10 flex items-center px-3 rounded-md border border-border bg-muted/5 text-sm text-muted">
                  Elegí la caja origen primero
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Monto ({origen?.moneda ?? '—'}) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Transferir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
