import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { movimientosService, type MedioPago } from '@/services/movimientosService';
import { cajasService } from '@/services/cajasService';
import { beneficiariosService } from '@/services/beneficiariosService';

export function NuevoIngresoDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [cajaId, setCajaId] = useState('');
  const [monto, setMonto] = useState('');
  const [medioPago, setMedioPago] = useState<MedioPago>('EFECTIVO');
  const [beneficiarioId, setBeneficiarioId] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const { data: cajas = [] } = useQuery({ queryKey: ['cajas', 'activas'], queryFn: () => cajasService.list(true) });
  const { data: benes = [] } = useQuery({
    queryKey: ['beneficiarios', { activo: true }],
    queryFn: () => beneficiariosService.list({ activo: true }),
  });

  const cajaSel = cajas.find((c) => c.id === cajaId);
  const moneda = cajaSel?.moneda ?? 'ARS';

  const m = useMutation({
    mutationFn: () =>
      movimientosService.crearIngreso({
        fecha,
        cajaId,
        monto: Number(monto),
        medioPago,
        beneficiarioId: beneficiarioId || undefined,
        descripcion: descripcion.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Ingreso registrado');
      setMonto('');
      setDescripcion('');
      setBeneficiarioId('');
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
          <DialogTitle>Nuevo ingreso</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!cajaId || !monto) return toast.error('Caja y monto son obligatorios');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Caja *</Label>
              <Select value={cajaId} onChange={(e) => setCajaId(e.target.value)} required>
                <option value="">Elegí…</option>
                {cajas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Medio *</Label>
              <Select value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago)}>
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="CHEQUE_TERCERO">Cheque recibido</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Monto ({moneda}) *</Label>
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
              <Label>Origen (opcional)</Label>
              <Select value={beneficiarioId} onChange={(e) => setBeneficiarioId(e.target.value)}>
                <option value="">Sin origen</option>
                {benes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar ingreso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
