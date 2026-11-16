import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import {
  movimientosService,
  type EditarMovimientoInput,
  type Movimiento,
} from '@/services/movimientosService';
import { beneficiariosService } from '@/services/beneficiariosService';
import { categoriasService } from '@/services/categoriasService';
import { obrasService } from '@/services/obrasService';
import { formatearMonto } from '@/lib/formatters';

type Linea = { obraId: string; monto: string };

/**
 * Edición de un movimiento CONFIRMADO. Permite cambiar los campos "seguros"
 * (fecha, descripción, beneficiario, categoría, obra/imputaciones) pero no
 * los que afectan saldos (monto, caja, moneda, cotización, tipo, cheque).
 * Para corregir esos, se anula y se vuelve a cargar.
 *
 * Backend valida que:
 *   - El movimiento esté CONFIRMADO.
 *   - Las imputaciones (si cambian) sumen exacto el monto.
 *   - Requiere permiso `movimientos:editar` (por defecto solo ADMIN).
 */
export function MovimientoEditarDialog({
  movimiento,
  onClose,
  onSaved,
}: {
  movimiento: Movimiento | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = movimiento !== null;
  const qc = useQueryClient();

  // Estado — se inicializa desde el movimiento. useMemo garantiza que solo
  // se calcule cuando cambia el id.
  const initial = useMemo(() => buildInitial(movimiento), [movimiento?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [fecha, setFecha] = useState(initial.fecha);
  const [descripcion, setDescripcion] = useState(initial.descripcion);
  const [beneficiarioId, setBeneficiarioId] = useState(initial.beneficiarioId);
  const [categoriaId, setCategoriaId] = useState(initial.categoriaId);
  const [obraIngresoId, setObraIngresoId] = useState(initial.obraIngresoId);
  const [lineas, setLineas] = useState<Linea[]>(initial.lineas);

  // Resetear cuando se abre un movimiento nuevo
  useMemo(() => {
    if (!movimiento) return;
    const i = buildInitial(movimiento);
    setFecha(i.fecha);
    setDescripcion(i.descripcion);
    setBeneficiarioId(i.beneficiarioId);
    setCategoriaId(i.categoriaId);
    setObraIngresoId(i.obraIngresoId);
    setLineas(i.lineas);
  }, [movimiento?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: benes = [] } = useQuery({
    queryKey: ['beneficiarios', { activo: true }],
    queryFn: () => beneficiariosService.list({ activo: true }),
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias', 'activas'],
    queryFn: () => categoriasService.list(true),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras', { activo: true }],
    queryFn: () => obrasService.list({ activo: true }),
  });

  const esEgresoConImputaciones = movimiento?.tipo === 'EGRESO';
  const esIngreso = movimiento?.tipo === 'INGRESO';
  const montoNum = movimiento ? Number(movimiento.monto) : 0;
  const sumaLineas = lineas.reduce((acc, l) => acc + (Number(l.monto) || 0), 0);
  const diferencia = montoNum - sumaLineas;
  const imputacionesValidas = !esEgresoConImputaciones || Math.abs(diferencia) < 0.01;

  const m = useMutation({
    mutationFn: () => {
      if (!movimiento) throw new Error('Sin movimiento');
      const patch: EditarMovimientoInput = {};
      if (fecha !== initial.fecha) patch.fecha = fecha;
      if (descripcion !== initial.descripcion) patch.descripcion = descripcion || null;
      if (beneficiarioId !== initial.beneficiarioId) patch.beneficiarioId = beneficiarioId || null;
      if (categoriaId !== initial.categoriaId) patch.categoriaId = categoriaId || null;
      if (esIngreso && obraIngresoId !== initial.obraIngresoId) {
        patch.obraIngresoId = obraIngresoId || null;
      }
      if (esEgresoConImputaciones) {
        const cambiaron = JSON.stringify(lineas) !== JSON.stringify(initial.lineas);
        if (cambiaron) {
          patch.imputaciones = lineas.map((l) => ({
            obraId: l.obraId,
            monto: Number(l.monto),
          }));
        }
      }
      if (Object.keys(patch).length === 0) {
        throw new Error('No hay cambios para guardar');
      }
      return movimientosService.editar(movimiento.id, patch);
    },
    onSuccess: () => {
      toast.success('Movimiento actualizado');
      qc.invalidateQueries({ queryKey: ['movimientos'] });
      qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
      qc.invalidateQueries({ queryKey: ['movimiento', movimiento?.id] });
      onSaved();
      onClose();
    },
    onError: (e) => {
      toast.error(
        (e as { response?: { data?: { message?: string } }; message?: string }).response?.data
          ?.message ??
          (e as { message?: string }).message ??
          'No se pudo guardar',
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar movimiento</DialogTitle>
          <DialogDescription>
            Solo se pueden cambiar fecha, descripción, beneficiario, categoría y obra. Para
            corregir monto, caja o medio hay que anular y volver a cargar.
          </DialogDescription>
        </DialogHeader>

        {movimiento && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!imputacionesValidas) {
                toast.error('La suma de las imputaciones no cierra con el monto');
                return;
              }
              m.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {esIngreso ? 'Origen (quién envía)' : 'Beneficiario'}
                </Label>
                <Select
                  value={beneficiarioId}
                  onChange={(e) => setBeneficiarioId(e.target.value)}
                >
                  <option value="">Sin asignar</option>
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

            {esIngreso && (
              <div className="space-y-2">
                <Label>Obra (opcional)</Label>
                <Select
                  value={obraIngresoId}
                  onChange={(e) => setObraIngresoId(e.target.value)}
                >
                  <option value="">Sin imputar a obra</option>
                  {obras.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
              />
            </div>

            {esEgresoConImputaciones && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Imputación a obra(s)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLineas((prev) => [...prev, { obraId: '', monto: '' }])}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Agregar obra
                  </Button>
                </div>
                <div className="space-y-2">
                  {lineas.map((l, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                      <Select
                        value={l.obraId}
                        onChange={(e) =>
                          setLineas((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, obraId: e.target.value } : x)),
                          )
                        }
                      >
                        <option value="">Elegí obra…</option>
                        {obras.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.nombre}
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.monto}
                        onChange={(e) =>
                          setLineas((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, monto: e.target.value } : x)),
                          )
                        }
                        className="num text-right"
                      />
                      {lineas.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setLineas((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-right">
                  {imputacionesValidas ? (
                    <span className="text-success">
                      Suma {formatearMonto(sumaLineas, movimiento.moneda)} = monto exacto
                    </span>
                  ) : (
                    <span className="text-danger">
                      Suma {formatearMonto(sumaLineas, movimiento.moneda)} · Diferencia{' '}
                      {formatearMonto(diferencia, movimiento.moneda)}
                    </span>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={m.isPending || !imputacionesValidas}>
                {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function buildInitial(mov: Movimiento | null): {
  fecha: string;
  descripcion: string;
  beneficiarioId: string;
  categoriaId: string;
  obraIngresoId: string;
  lineas: Linea[];
} {
  if (!mov) {
    return {
      fecha: '',
      descripcion: '',
      beneficiarioId: '',
      categoriaId: '',
      obraIngresoId: '',
      lineas: [{ obraId: '', monto: '' }],
    };
  }
  return {
    fecha: mov.fecha.slice(0, 10),
    descripcion: mov.descripcion ?? '',
    beneficiarioId: mov.beneficiarioId ?? '',
    categoriaId: mov.categoriaId ?? '',
    obraIngresoId: mov.obraIngresoId ?? '',
    lineas:
      mov.imputaciones && mov.imputaciones.length > 0
        ? mov.imputaciones.map((i) => ({ obraId: i.obraId, monto: String(i.monto) }))
        : [{ obraId: '', monto: '' }],
  };
}
