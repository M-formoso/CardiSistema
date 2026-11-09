import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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
              <Select
                value={origenId}
                onChange={(e) => {
                  setOrigenId(e.target.value);
                  setDestinoId('');
                }}
                required
              >
                <option value="">Elegí…</option>
                {cajas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Caja destino *</Label>
              <Select
                value={destinoId}
                onChange={(e) => setDestinoId(e.target.value)}
                disabled={!origenId}
                required
              >
                <option value="">Elegí…</option>
                {destinosPosibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda})
                  </option>
                ))}
              </Select>
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
