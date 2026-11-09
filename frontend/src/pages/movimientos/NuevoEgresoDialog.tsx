import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { movimientosService, type MedioPago } from '@/services/movimientosService';
import { cajasService } from '@/services/cajasService';
import { obrasService } from '@/services/obrasService';
import { beneficiariosService } from '@/services/beneficiariosService';
import { categoriasService } from '@/services/categoriasService';
import { formatearMonto } from '@/lib/formatters';

type Linea = { obraId: string; monto: string };

/**
 * Formulario de egreso con imputación a 1..N obras.
 * Si hay una sola línea, el monto se autocompleta con el total.
 * Si hay más, la suma tiene que coincidir con el total (validado al enviar).
 */
export function NuevoEgresoDialog({
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
  const [categoriaId, setCategoriaId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([{ obraId: '', monto: '' }]);

  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas', 'activas'],
    queryFn: () => cajasService.list(true),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras', { activo: true }],
    queryFn: () => obrasService.list({ activo: true }),
  });
  const { data: benes = [] } = useQuery({
    queryKey: ['beneficiarios', { activo: true }],
    queryFn: () => beneficiariosService.list({ activo: true }),
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias', 'activas'],
    queryFn: () => categoriasService.list(true),
  });

  const cajaSel = cajas.find((c) => c.id === cajaId);
  const moneda = cajaSel?.moneda ?? 'ARS';
  const totalNum = Number(monto) || 0;
  const sumaLineas = lineas.reduce((acc, l) => acc + (Number(l.monto) || 0), 0);
  const diferencia = totalNum - sumaLineas;

  const puedeEnviar = useMemo(() => {
    if (!cajaId || totalNum <= 0) return false;
    if (lineas.length === 1) return !!lineas[0].obraId;
    if (lineas.some((l) => !l.obraId || !l.monto)) return false;
    return Math.abs(diferencia) < 0.01;
  }, [cajaId, totalNum, lineas, diferencia]);

  const m = useMutation({
    mutationFn: () =>
      movimientosService.crearEgreso({
        fecha,
        cajaId,
        monto: totalNum,
        medioPago,
        beneficiarioId: beneficiarioId || undefined,
        categoriaId: categoriaId || undefined,
        descripcion: descripcion.trim() || undefined,
        imputaciones:
          lineas.length === 1
            ? [{ obraId: lineas[0].obraId, monto: totalNum }]
            : lineas.map((l) => ({ obraId: l.obraId, monto: Number(l.monto) })),
      }),
    onSuccess: () => {
      toast.success('Egreso registrado');
      resetForm();
      onCreated();
    },
    onError: (err) => {
      toast.error(
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo registrar',
      );
    },
  });

  function resetForm() {
    setMonto('');
    setBeneficiarioId('');
    setCategoriaId('');
    setDescripcion('');
    setLineas([{ obraId: '', monto: '' }]);
  }

  function addLinea() {
    setLineas((prev) => [...prev, { obraId: '', monto: '' }]);
  }

  function updateLinea(idx: number, patch: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLinea(idx: number) {
    setLineas((prev) => prev.filter((_, i) => i !== idx));
  }

  function autoDistribuir() {
    if (lineas.length === 0 || totalNum <= 0) return;
    const partes = totalNum / lineas.length;
    const redondeadas = lineas.map(() => Math.round(partes * 100) / 100);
    // Ajuste redondeo en la última línea
    const suma = redondeadas.reduce((a, b) => a + b, 0);
    redondeadas[redondeadas.length - 1] += Math.round((totalNum - suma) * 100) / 100;
    setLineas(lineas.map((l, i) => ({ ...l, monto: redondeadas[i].toFixed(2) })));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nuevo egreso</DialogTitle>
          <DialogDescription>
            Una sola carga: monto, caja, beneficiario e imputación a obra(s).
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!puedeEnviar) {
              toast.error('Revisá los datos: caja, monto y que las imputaciones cierren exacto');
              return;
            }
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Fecha *</Label>
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
              <Select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value as MedioPago)}
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="CHEQUE_PROPIO">Cheque propio</option>
                <option value="CHEQUE_TERCERO">Cheque de tercero</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Monto total ({moneda}) *</Label>
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
              <Label>Beneficiario</Label>
              <Select value={beneficiarioId} onChange={(e) => setBeneficiarioId(e.target.value)}>
                <option value="">Sin beneficiario</option>
                {benes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre} · {b.tipo}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} · {c.nombre}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalle del gasto…"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Imputación a obra(s) *</Label>
              <div className="flex gap-2">
                {lineas.length > 1 && (
                  <Button type="button" variant="outline" size="sm" onClick={autoDistribuir}>
                    Dividir en partes iguales
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={addLinea}>
                  <Plus className="h-3 w-3 mr-1" />
                  Agregar obra
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {lineas.map((l, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                  <Select
                    value={l.obraId}
                    onChange={(e) => updateLinea(idx, { obraId: e.target.value })}
                  >
                    <option value="">Elegí obra…</option>
                    {obras.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </Select>
                  {lineas.length === 1 ? (
                    <div className="text-sm text-muted italic text-right pr-2 num">
                      {totalNum ? formatearMonto(totalNum, moneda) : '—'}
                    </div>
                  ) : (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Monto"
                      value={l.monto}
                      onChange={(e) => updateLinea(idx, { monto: e.target.value })}
                      className="num text-right"
                    />
                  )}
                  {lineas.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLinea(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {lineas.length > 1 && totalNum > 0 && (
              <div className="text-xs text-right">
                {Math.abs(diferencia) < 0.01 ? (
                  <span className="text-success">
                    Suma: {formatearMonto(sumaLineas, moneda)} = total exacto
                  </span>
                ) : (
                  <span className="text-danger">
                    Suma: {formatearMonto(sumaLineas, moneda)} · Diferencia:{' '}
                    {formatearMonto(diferencia, moneda)}
                  </span>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!puedeEnviar || m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar egreso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
