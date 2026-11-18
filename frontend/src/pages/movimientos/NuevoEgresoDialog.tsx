import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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
import { movimientosService, type MedioPago } from '@/services/movimientosService';
import { cajasService } from '@/services/cajasService';
import { obrasService } from '@/services/obrasService';
import { beneficiariosService } from '@/services/beneficiariosService';
import { categoriasService, type Categoria } from '@/services/categoriasService';
import { chequesService } from '@/services/chequesService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

type Linea = { obraId: string; monto: string };

export type ImputacionSugerida = {
  obraId: string;
  nombre?: string;
  saldoPendiente: number;
};

/**
 * Formulario de egreso con imputación a 1..N obras.
 * Si hay una sola línea, el monto se autocompleta con el total.
 * Si hay más, la suma tiene que coincidir con el total (validado al enviar).
 *
 * Usado también desde "Pago a proveedor" en el detalle de un proveedor. En
 * ese flujo se oculta la categoría y se pre-llenan las imputaciones con las
 * obras que tienen saldo pendiente según el último resumen cargado.
 */
export function NuevoEgresoDialog({
  open,
  onOpenChange,
  onCreated,
  beneficiarioInicialId,
  ocultarCategoria,
  imputacionesSugeridas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  /** Si viene, el beneficiario arranca pre-seleccionado (útil para pagar
   * desde la pantalla de un proveedor). El usuario puede cambiarlo igual. */
  beneficiarioInicialId?: string;
  /** Para pago a proveedor: la categoría no aplica (ya se sabe a quién se
   * paga), se oculta la sección entera. */
  ocultarCategoria?: boolean;
  /** Para pago a proveedor: arrancar con las obras que tienen saldo
   * pendiente, con montos en 0 editables. El usuario ingresa cuánto le
   * paga a cada una (puede dejar menos, igual o más que el saldo). */
  imputacionesSugeridas?: ImputacionSugerida[];
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
  const [lineas, setLineas] = useState<Linea[]>(
    imputacionesSugeridas && imputacionesSugeridas.length > 0
      ? imputacionesSugeridas.map((s) => ({ obraId: s.obraId, monto: '' }))
      : [{ obraId: '', monto: '' }],
  );
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

  // En modo "pago a proveedor" (hay imputaciones sugeridas) el total del
  // egreso se calcula automáticamente como la suma de las líneas con monto >0,
  // excepto que haya un cheque (el cheque fija el total). En modo normal, el
  // usuario pone el total y después reparte.
  const esPagoProveedor = !!imputacionesSugeridas && imputacionesSugeridas.length > 0;
  useEffect(() => {
    if (!esPagoProveedor || modoCheque) return;
    const sum = lineas.reduce((acc, l) => acc + (Number(l.monto) || 0), 0);
    setMonto(sum > 0 ? sum.toFixed(2) : '');
  }, [lineas, esPagoProveedor, modoCheque]);

  const puedeEnviar = useMemo(() => {
    if (!cajaId || totalNum <= 0) return false;
    if (prestamoRequiereEmpleado) return false;
    if (modoCheque && !chequeId) return false;

    // En modo proveedor, se aceptan líneas con monto 0 (= obras que no se
    // pagan esta vez). Al menos una línea con monto > 0 y obra, y la suma
    // tiene que cerrar con el total.
    if (esPagoProveedor) {
      const conMonto = lineas.filter((l) => l.obraId && Number(l.monto) > 0);
      if (conMonto.length === 0) return false;
      return Math.abs(diferencia) < 0.01;
    }

    if (lineas.length === 1) return !!lineas[0].obraId;
    if (lineas.some((l) => !l.obraId || !l.monto)) return false;
    return Math.abs(diferencia) < 0.01;
  }, [
    cajaId,
    totalNum,
    lineas,
    diferencia,
    prestamoRequiereEmpleado,
    modoCheque,
    chequeId,
    esPagoProveedor,
  ]);

  const m = useMutation({
    mutationFn: () => {
      // Para enviar: en modo proveedor se filtran las líneas con monto 0
      // (obras que no se pagan ahora). En modo normal, se mandan todas.
      let imputaciones: Array<{ obraId: string; monto: number }>;
      if (esPagoProveedor) {
        imputaciones = lineas
          .filter((l) => l.obraId && Number(l.monto) > 0)
          .map((l) => ({ obraId: l.obraId, monto: Number(l.monto) }));
      } else if (lineas.length === 1) {
        imputaciones = [{ obraId: lineas[0].obraId, monto: totalNum }];
      } else {
        imputaciones = lineas.map((l) => ({
          obraId: l.obraId,
          monto: Number(l.monto),
        }));
      }
      return movimientosService.crearEgreso({
        fecha,
        cajaId,
        monto: totalNum,
        medioPago,
        beneficiarioId: beneficiarioId || undefined,
        categoriaId: categoriaId || undefined,
        descripcion: descripcion.trim() || undefined,
        chequeId: chequeId || undefined,
        imputaciones,
      });
    },
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
    // Si viene de un proveedor, no limpiamos beneficiario ni líneas (esa UX
    // implica que el user quiere cargar varios pagos seguidos al mismo).
    if (!beneficiarioInicialId) setBeneficiarioId('');
    setCategoriaId('');
    setDescripcion('');
    setLineas(
      imputacionesSugeridas && imputacionesSugeridas.length > 0
        ? imputacionesSugeridas.map((s) => ({ obraId: s.obraId, monto: '' }))
        : [{ obraId: '', monto: '' }],
    );
    setChequeId('');
  }

  // Si cambia la caja, limpiar el cheque elegido. Si la caja nueva es de
  // cheques y el medio no coincide, setearlo. Si deja de ser caja de cheques,
  // volver a EFECTIVO.
  function onCajaChange(nuevoId: string) {
    setCajaId(nuevoId);
    setChequeId('');
    const nuevaCaja = cajas.find((c) => c.id === nuevoId);
    // Autocompletar medio de pago según tipo de caja (Dani pidió no repetir la carga)
    if (nuevaCaja?.tipo === 'CHEQUES_TERCEROS') setMedioPago('CHEQUE_TERCERO');
    else if (nuevaCaja?.tipo === 'EFECTIVO') setMedioPago('EFECTIVO');
    else if (nuevaCaja?.tipo === 'BANCO') setMedioPago('TRANSFERENCIA');
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

  // Modo proveedor: lookup rápido obraId → saldoPendiente (del último resumen)
  const saldosPorObraMap = useMemo(() => {
    const map = new Map<string, number>();
    (imputacionesSugeridas ?? []).forEach((s) => map.set(s.obraId, s.saldoPendiente));
    return map;
  }, [imputacionesSugeridas]);

  // Opciones para los combobox buscables (reemplazan a los <Select> nativos)
  const cajasOpts = useMemo<ComboboxOption[]>(
    () => cajas.map((c) => ({ value: c.id, label: c.nombre, hint: `${c.moneda} · ${c.tipo}` })),
    [cajas],
  );
  const chequesOpts = useMemo<ComboboxOption[]>(
    () =>
      chequesDisponibles.map((c) => ({
        value: c.id,
        label: `N° ${c.numero} · ${c.banco ?? 's/banco'} · ${formatearMonto(c.monto, c.moneda)}`,
        hint: `pago ${formatearFecha(c.fechaPago)}${c.librador ? ' · ' + c.librador : c.titular ? ' · ' + c.titular : ''}`,
      })),
    [chequesDisponibles],
  );
  const benesOpts = useMemo<ComboboxOption[]>(
    () => benesFiltrados.map((b) => ({ value: b.id, label: b.nombre, hint: b.tipo })),
    [benesFiltrados],
  );
  const categoriasOpts = useMemo<ComboboxOption[]>(
    () => categorias.map((c) => ({ value: c.id, label: c.nombre, hint: c.codigo })),
    [categorias],
  );
  const obrasOpts = useMemo<ComboboxOption[]>(
    () => obras.map((o) => ({ value: o.id, label: o.nombre })),
    [obras],
  );

  // "Saldar todo": llena cada línea con el saldo pendiente de la obra. Si
  // hay cheque, respeta el total del cheque proporcionalmente (atípico).
  function saldarTodo() {
    if (!esPagoProveedor || !imputacionesSugeridas) return;
    setLineas(
      imputacionesSugeridas.map((s) => ({
        obraId: s.obraId,
        monto: s.saldoPendiente > 0 ? s.saldoPendiente.toFixed(2) : '',
      })),
    );
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
              <Combobox
                options={cajasOpts}
                value={cajaId}
                onChange={onCajaChange}
                placeholder="Elegí caja…"
                searchPlaceholder="Buscar caja…"
              />
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
                  <Combobox
                    options={chequesOpts}
                    value={chequeId}
                    onChange={onChequeChange}
                    placeholder="Elegí cheque…"
                    searchPlaceholder="Buscar por N°, banco o librador…"
                  />
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
              <MoneyInput
                value={monto}
                onChange={setMonto}
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
              <Combobox
                options={benesOpts}
                value={beneficiarioId}
                onChange={setBeneficiarioId}
                placeholder="Sin beneficiario"
                searchPlaceholder="Buscar beneficiario…"
                allLabel="Sin beneficiario"
              />
            </div>
          </div>

          {/* Imputación — va arriba de categoría porque es más importante
              (define a qué obra se imputa el gasto). En modo "pago a
              proveedor" las obras del último resumen vienen pre-llenas con
              el saldo pendiente visible al lado; el usuario ingresa cuánto
              paga a cada una (puede dejar menos, igual o más que el saldo). */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label>Imputación a obra(s) *</Label>
              <div className="flex gap-2 flex-wrap">
                {esPagoProveedor && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={saldarTodo}
                    title="Rellena cada línea con el saldo pendiente de la obra"
                  >
                    Saldar todo
                  </Button>
                )}
                {!esPagoProveedor && (
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
                )}
                {!esPagoProveedor && lineas.length > 1 && (
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
              {lineas.map((l, idx) => {
                const saldoObra = l.obraId ? saldosPorObraMap.get(l.obraId) : undefined;
                const inputEditableSiempre = esPagoProveedor || lineas.length > 1;
                return (
                  <div key={idx} className="space-y-0.5">
                    <div className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                      <Combobox
                        options={obrasOpts}
                        value={l.obraId}
                        onChange={(v) => updateLinea(idx, { obraId: v })}
                        placeholder="Elegí obra…"
                        searchPlaceholder="Buscar obra…"
                      />
                      {inputEditableSiempre ? (
                        <MoneyInput
                          placeholder="Monto"
                          value={l.monto}
                          onChange={(v) => updateLinea(idx, { monto: v })}
                        />
                      ) : (
                        <div className="text-sm text-muted italic text-right pr-2 num">
                          {totalNum ? formatearMonto(totalNum, moneda) : '—'}
                        </div>
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
                    {saldoObra !== undefined && (
                      <div className="text-[11px] text-muted pl-1">
                        Saldo pendiente:{' '}
                        <span className={saldoObra > 0 ? 'text-danger font-medium' : 'text-success'}>
                          {formatearMonto(saldoObra, moneda)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
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

          {!ocultarCategoria && (
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
              <Combobox
                options={categoriasOpts}
                value={categoriaId}
                onChange={(v) => {
                  setCategoriaId(v);
                  const nueva = categorias.find((c) => c.id === v);
                  if (nueva?.codigo === 'PREST_EMP' && beneficiarioSel?.tipo !== 'EMPLEADO') {
                    setBeneficiarioId('');
                  }
                }}
                placeholder="Sin categoría"
                searchPlaceholder="Buscar categoría…"
                allLabel="Sin categoría"
              />
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
          )}

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalle del gasto…"
              rows={2}
            />
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
