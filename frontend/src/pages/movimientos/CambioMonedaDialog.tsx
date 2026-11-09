import { useEffect, useState } from 'react';
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
import { cotizacionesService } from '@/services/cotizacionesService';

export function CambioMonedaDialog({
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
  const [montoOrigen, setMontoOrigen] = useState('');
  const [cotizacion, setCotizacion] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas', 'activas'],
    queryFn: () => cajasService.list(true),
  });
  const { data: cotHoy } = useQuery({
    queryKey: ['cotizacion', 'hoy'],
    queryFn: cotizacionesService.hoy,
    retry: false,
  });

  useEffect(() => {
    if (open && cotHoy?.cotizaciones[0]?.venta && !cotizacion) {
      setCotizacion(String(cotHoy.cotizaciones[0].venta));
    }
  }, [open, cotHoy, cotizacion]);

  const origen = cajas.find((c) => c.id === origenId);
  const destino = cajas.find((c) => c.id === destinoId);
  const destinosPosibles = cajas.filter(
    (c) => c.id !== origenId && origen && c.moneda !== origen.moneda,
  );

  // Cálculo del monto destino según dirección
  const mOrig = Number(montoOrigen) || 0;
  const mCot = Number(cotizacion) || 0;
  let montoDestino = 0;
  if (origen && destino && mOrig > 0 && mCot > 0) {
    if (origen.moneda === 'USD' && destino.moneda === 'ARS') {
      montoDestino = Math.round(mOrig * mCot * 100) / 100;
    } else if (origen.moneda === 'ARS' && destino.moneda === 'USD') {
      montoDestino = Math.round((mOrig / mCot) * 100) / 100;
    }
  }

  const m = useMutation({
    mutationFn: () =>
      movimientosService.cambioMoneda({
        fecha,
        cajaOrigenId: origenId,
        cajaDestinoId: destinoId,
        montoOrigen: mOrig,
        montoDestino,
        cotizacion: mCot,
        descripcion: descripcion.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Cambio registrado');
      setMontoOrigen('');
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
          <DialogTitle>Cambio USD ↔ ARS</DialogTitle>
          <DialogDescription>
            Sale de una caja y entra a otra con la cotización pactada en el momento.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!origenId || !destinoId || !mOrig || !mCot || montoDestino <= 0) {
              return toast.error('Completá todos los campos y verificá los montos');
            }
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
              <Select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} disabled={!origenId}>
                <option value="">Elegí…</option>
                {destinosPosibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda})
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Monto origen ({origen?.moneda ?? '—'}) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={montoOrigen}
                onChange={(e) => setMontoOrigen(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Cotización (ARS por 1 USD) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={cotizacion}
                onChange={(e) => setCotizacion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Monto destino ({destino?.moneda ?? '—'})</Label>
              <Input
                type="text"
                value={montoDestino > 0 ? montoDestino.toFixed(2) : ''}
                readOnly
                className="bg-muted/10 num"
              />
            </div>
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
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar cambio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
