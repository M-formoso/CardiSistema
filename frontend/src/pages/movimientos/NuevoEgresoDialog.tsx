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
import { movimientosService, type MedioPago } from '@/services/movimientosService';
import { cajasService } from '@/services/cajasService';
import { obrasService } from '@/services/obrasService';
import { beneficiariosService } from '@/services/beneficiariosService';
import { categoriasService, type Categoria } from '@/services/categoriasService';
import { chequesService } from '@/services/chequesService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

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
  beneficiarioInicialId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  /** Si viene, el beneficiario arranca pre-seleccionado (útil para pagar
   * desde la pantalla de un proveedor). El usuario puede cambiarlo igual. */
  beneficiarioInicialId?: string;
}) {
  const qc = useQueryClient();
  const [nuevaCatOpen, setNuevaCatOpen] = useState(false);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [cajaId, setCajaId] = useState('');
  const [monto, setMonto] = useState('');
  const [medioPago, setMedioPago] = useState<MedioPago>('EFECTIVO');
  const [beneficiarioId, setBeneficiarioId] = useState(beneficiarioInicialId ?? '');
  const [categoriaId, setCategoriaId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([{ obraId: '', monto: '' }]);
  const [chequeId, setChequeId] = useState('');

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
  const { data: chequesCartera = [] } = useQuery({
    queryKey: ['cheques', 'cartera'],
    queryFn: () => chequesService.list({ estado: 'EN_CARTERA' }),
  });

  const cajaSel = cajas.find((c) => c.id === cajaId);
  const moneda = cajaSel?.moneda ?? 'ARS';
  const modoCheque = cajaSel?.tipo === 'CHEQUES_TERCEROS';
  const chequesDisponibles = useMemo(
    () => chequesCartera.filter((c) => c.moneda === moneda),
    [chequesCartera, moneda],
  );
  const chequeSel = chequesDisponibles.find((c) => c.id === chequeId);
  const totalNum = Number(monto) || 0;
  const sumaLineas = lineas.reduce((acc, l) => acc + (Number(l.monto) || 0), 0);
  const diferencia = totalNum - sumaLineas;
  const disponibleCheque = chequeSel ? Number(chequeSel.monto) - sumaLineas : 0;

  const categoriaSel = categorias.find((c) => c.id === categoriaId);
  const esPrestamoEmpleado = categoriaSel?.codigo === 'PREST_EMP';
  const beneficiarioSel = benes.find((b) => b.id === beneficiarioId);
  const prestamoRequiereEmpleado =
    esPrestamoEmpleado && (!beneficiarioSel || beneficiarioSel.tipo !== 'EMPLEADO');

  // Opciones de beneficiario: si es préstamo, solo empleados; si no, todos
  const benesFiltrados = esPrestamoEmpleado
    ? benes.filter((b) => b.tipo === 'EMPLEADO')
    : benes;

  const puedeEnviar = useMemo(() => {
    if (!cajaId || totalNum <= 0) return false;
    if (prestamoRequiereEmpleado) return false;
    if (modoCheque && !chequeId) return false;
    if (lineas.length === 1) return !!lineas[0].obraId;
    if (lineas.some((l) => !l.obraId || !l.monto)) return false;
    return Math.abs(diferencia) < 0.01;
  }, [cajaId, totalNum, lineas, diferencia, prestamoRequiereEmpleado, modoCheque, chequeId]);

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
        chequeId: chequeId || undefined,
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
    setChequeId('');
  }

  // Si cambia la caja, limpiar el cheque elegido. Si la caja nueva es de
  // cheques y el medio no coincide, setearlo. Si deja de ser caja de cheques,
  // volver a EFECTIVO.
  function onCajaChange(nuevoId: string) {
    setCajaId(nuevoId);
    setChequeId('');
    const nuevaCaja = cajas.find((c) => c.id === nuevoId);
    if (nuevaCaja?.tipo === 'CHEQUES_TERCEROS') {
      setMedioPago('CHEQUE_TERCERO');
    } else if (medioPago === 'CHEQUE_TERCERO') {
      setMedioPago('EFECTIVO');
    }
  }

  // Al elegir un cheque: setear monto del egreso = monto del cheque, y auto-
  // completar beneficiario si el cheque ya tenía uno.
  function onChequeChange(id: string) {
    setChequeId(id);
    const ch = chequesDisponibles.find((c) => c.id === id);
    if (ch) {
      setMonto(String(ch.monto));
      if (ch.beneficiarioId && !beneficiarioId) setBeneficiarioId(ch.beneficiarioId);
    }
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

  // "Gasto general": reemplaza las líneas por una por cada obra activa, con
  // el monto total repartido en partes iguales. Útil para gastos como IPF
  // que afectan a toda la empresa, no a una obra en particular.
  function repartirEnTodasLasObras() {
    if (obras.length === 0 || totalNum <= 0) return;
    const partes = totalNum / obras.length;
    const redondeadas = obras.map(() => Math.round(partes * 100) / 100);
    const suma = redondeadas.reduce((a, b) => a + b, 0);
    redondeadas[redondeadas.length - 1] += Math.round((totalNum - suma) * 100) / 100;
    setLineas(obras.map((o, i) => ({ obraId: o.id, monto: redondeadas[i].toFixed(2) })));
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
              <Select value={cajaId} onChange={(e) => onCajaChange(e.target.value)} required>
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

          {modoCheque && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-primary">
                Cheque a entregar *
              </Label>
              {chequesDisponibles.length === 0 ? (
                <p className="text-xs text-danger">
                  No hay cheques EN_CARTERA en {moneda}. Cargá uno primero desde "Nuevo cheque".
                </p>
              ) : (
                <>
                  <Select value={chequeId} onChange={(e) => onChequeChange(e.target.value)} required>
                    <option value="">Elegí cheque…</option>
                    {chequesDisponibles.map((c) => (
                      <option key={c.id} value={c.id}>
                        N° {c.numero} · {c.banco ?? 's/banco'} · {formatearMonto(c.monto, c.moneda)}
                        {' · pago '}
                        {formatearFecha(c.fechaPago)}
                      </option>
                    ))}
                  </Select>
                  {chequeSel && (
                    <div className="text-[11px] text-muted">
                      Librador: {chequeSel.librador ?? chequeSel.titular ?? '—'} · Monto:{' '}
                      <span className="font-semibold text-foreground num">
                        {formatearMonto(chequeSel.monto, chequeSel.moneda)}
                      </span>{' '}
                      · Vencimiento: {formatearFecha(chequeSel.fechaPago)}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

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
                readOnly={modoCheque && !!chequeId}
                title={
                  modoCheque && chequeId
                    ? 'El monto es el del cheque elegido — el reparto es por obra'
                    : undefined
                }
              />
            </div>
            <div className="space-y-2">
              <Label>
                Beneficiario {esPrestamoEmpleado && <span className="text-warning">(solo empleados)</span>}
              </Label>
              <Select value={beneficiarioId} onChange={(e) => setBeneficiarioId(e.target.value)}>
                <option value="">Sin beneficiario</option>
                {benesFiltrados.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre} · {b.tipo}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Categoría</Label>
              <button
                type="button"
                onClick={() => setNuevaCatOpen(true)}
                className="text-xs text-primary hover:underline"
              >
                + Nueva categoría
              </button>
            </div>
            <Select
              value={categoriaId}
              onChange={(e) => {
                setCategoriaId(e.target.value);
                const nueva = categorias.find((c) => c.id === e.target.value);
                if (nueva?.codigo === 'PREST_EMP' && beneficiarioSel?.tipo !== 'EMPLEADO') {
                  setBeneficiarioId('');
                }
              }}
            >
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} · {c.nombre}
                </option>
              ))}
            </Select>
            {esPrestamoEmpleado && (
              <p className="text-xs text-warning">
                Se va a crear un préstamo al empleado con saldo = monto. Se descontará en
                liquidaciones futuras. Imputar a "Gastos generales" o "Varios".
              </p>
            )}
            {prestamoRequiereEmpleado && (
              <p className="text-xs text-danger">
                Elegí un empleado (categoría "Préstamos a empleados" requiere beneficiario tipo EMPLEADO).
              </p>
            )}
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label>Imputación a obra(s) *</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={repartirEnTodasLasObras}
                  disabled={obras.length === 0 || totalNum <= 0}
                  title="Reparte el monto en partes iguales entre todas las obras activas (ej: IPF, gasto general)"
                >
                  Gasto general
                </Button>
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
            {modoCheque && chequeSel && (
              <div
                className={`text-xs text-right font-medium ${
                  disponibleCheque < 0
                    ? 'text-danger'
                    : disponibleCheque > 0
                      ? 'text-warning'
                      : 'text-success'
                }`}
              >
                Disponible del cheque: {formatearMonto(disponibleCheque, moneda)}
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
      {nuevaCatOpen && (
        <NuevaCategoriaGastoDialog
          onClose={() => setNuevaCatOpen(false)}
          onCreada={(cat) => {
            setCategoriaId(cat.id);
            qc.invalidateQueries({ queryKey: ['categorias', 'activas'] });
            setNuevaCatOpen(false);
          }}
        />
      )}
    </Dialog>
  );
}

function NuevaCategoriaGastoDialog({
  onClose,
  onCreada,
}: {
  onClose: () => void;
  onCreada: (cat: Categoria) => void;
}) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');

  const m = useMutation({
    mutationFn: () =>
      categoriasService.create({ codigo: codigo.trim().toUpperCase(), nombre: nombre.trim() }),
    onSuccess: (cat) => {
      toast.success('Categoría creada');
      onCreada(cat);
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo crear',
      ),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva categoría de gasto</DialogTitle>
          <DialogDescription>
            Al crear, queda seleccionada en el egreso automáticamente.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!codigo.trim() || !nombre.trim())
              return toast.error('Código y nombre son obligatorios');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="FLETE, COMB, IMP…"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Fletes, Combustible…"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
