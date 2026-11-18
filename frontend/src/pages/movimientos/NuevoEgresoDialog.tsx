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
import { vehiculosService } from '@/services/vehiculosService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

type Linea = { obraId: string; monto: string };
type LineaVehiculo = { vehiculoId: string; monto: string };

/** Tipos de egreso (reunión Dani 18/11): primero se elige el tipo, después
 *  se filtran las categorías y se decide cómo imputar (obras o vehículos). */
type TipoEgreso = 'SERVICIO' | 'PROVEEDOR' | 'GENERAL';

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
  imputacionesSugeridas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  /** Si viene, el beneficiario arranca pre-seleccionado (útil para pagar
   * desde la pantalla de un proveedor). El usuario puede cambiarlo igual. */
  beneficiarioInicialId?: string;
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
  // Reunión Dani 18/11: tipo primero, después se filtran las categorías y la
  // UI del reparto (obras vs vehículos). Si viene imputacionesSugeridas (pago
  // a proveedor desde el detalle del proveedor), arrancamos en PROVEEDOR.
  const [tipoEgreso, setTipoEgreso] = useState<TipoEgreso | ''>(
    imputacionesSugeridas && imputacionesSugeridas.length > 0 ? 'PROVEEDOR' : '',
  );
  const [lineasVeh, setLineasVeh] = useState<LineaVehiculo[]>([]);

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
  // Las categorías se filtran según el tipo de egreso elegido (reunión 18/11).
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias', { tipo: tipoEgreso, soloActivas: true }],
    queryFn: () =>
      categoriasService.list({
        soloActivas: true,
        tipo: tipoEgreso || undefined,
      }),
  });
  const { data: vehiculos = [] } = useQuery({
    queryKey: ['vehiculos', { activo: true }],
    queryFn: () => vehiculosService.list({ activo: true }),
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
  const categoriaSel = categorias.find((c) => c.id === categoriaId);
  // Si la categoría elegida tiene flag vinculadaVehiculo (ej: Seguro, Rentas
  // Automotor, Mecánica), el egreso se imputa a vehículos en vez de obras.
  const modoVehiculos = categoriaSel?.vinculadaVehiculo === true;
  const totalNum = Number(monto) || 0;
  const sumaLineas = lineas.reduce((acc, l) => acc + (Number(l.monto) || 0), 0);
  const sumaLineasVeh = lineasVeh.reduce((acc, l) => acc + (Number(l.monto) || 0), 0);
  const diferenciaVeh = totalNum - sumaLineasVeh;
  const diferencia = totalNum - sumaLineas;
  const disponibleCheque = chequeSel ? Number(chequeSel.monto) - sumaLineas : 0;

  const esPrestamoEmpleado = categoriaSel?.codigo === 'PREST_EMP';
  const beneficiarioSel = benes.find((b) => b.id === beneficiarioId);
  const prestamoRequiereEmpleado =
    esPrestamoEmpleado && (!beneficiarioSel || beneficiarioSel.tipo !== 'EMPLEADO');

  // Opciones de beneficiario según tipo elegido (reunión 18/11):
  //  - PROVEEDOR: solo tipo=PROVEEDOR
  //  - SERVICIO/GENERAL: cualquiera (opcional)
  //  - Préstamo a empleado: solo tipo=EMPLEADO
  const benesFiltrados = useMemo(() => {
    if (esPrestamoEmpleado) return benes.filter((b) => b.tipo === 'EMPLEADO');
    if (tipoEgreso === 'PROVEEDOR') return benes.filter((b) => b.tipo === 'PROVEEDOR');
    // Excluimos EMPRESA_PAGADORA y EMPLEADOS del general (son "origen" o
    // tienen su propio flujo de liquidación)
    return benes.filter((b) => b.tipo !== 'EMPRESA_PAGADORA' && b.tipo !== 'EMPLEADO');
  }, [benes, esPrestamoEmpleado, tipoEgreso]);

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
    // Tipo de egreso obligatorio (reunión 18/11), salvo cuando ya viene
    // forzado por el flujo de pago a proveedor.
    if (!tipoEgreso) return false;
    // Según el tipo se requiere categoría o proveedor
    if (tipoEgreso === 'SERVICIO' && !categoriaId) return false;
    if (tipoEgreso === 'GENERAL' && !categoriaId) return false;
    if (tipoEgreso === 'PROVEEDOR' && !beneficiarioId) return false;
    if (prestamoRequiereEmpleado) return false;
    if (modoCheque && !chequeId) return false;

    // Modo vehículos: al menos una línea con vehículo+monto, suma = total
    if (modoVehiculos) {
      const conMonto = lineasVeh.filter((l) => l.vehiculoId && Number(l.monto) > 0);
      if (conMonto.length === 0) return false;
      const ids = conMonto.map((l) => l.vehiculoId);
      if (new Set(ids).size !== ids.length) return false; // repetidos
      return Math.abs(diferenciaVeh) < 0.01;
    }

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
    tipoEgreso,
    categoriaId,
    beneficiarioId,
    lineas,
    lineasVeh,
    diferencia,
    diferenciaVeh,
    modoVehiculos,
    prestamoRequiereEmpleado,
    modoCheque,
    chequeId,
    esPagoProveedor,
  ]);

  const m = useMutation({
    mutationFn: () => {
      if (modoVehiculos) {
        // Modo vehículos: enviar `vehiculos` sin `imputaciones`
        const vehiculosPayload = lineasVeh
          .filter((l) => l.vehiculoId && Number(l.monto) > 0)
          .map((l) => ({ vehiculoId: l.vehiculoId, monto: Number(l.monto) }));
        return movimientosService.crearEgreso({
          fecha,
          cajaId,
          monto: totalNum,
          medioPago,
          beneficiarioId: beneficiarioId || undefined,
          categoriaId: categoriaId || undefined,
          descripcion: descripcion.trim() || undefined,
          chequeId: chequeId || undefined,
          vehiculos: vehiculosPayload,
        });
      }
      // Modo normal: imputación a obras
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

  // "Gasto general": reemplaza las líneas por una por cada obra ACTIVA (estado
  // = ACTIVA, no las pausadas/terminadas/en licitación — reunión 18/11), con
  // el monto total repartido en partes iguales. Útil para gastos como IPF
  // que afectan a toda la empresa, no a una obra en particular.
  function repartirEnTodasLasObras() {
    const obrasActivas = obras.filter((o) => o.estado === 'ACTIVA');
    if (obrasActivas.length === 0 || totalNum <= 0) return;
    const partes = totalNum / obrasActivas.length;
    const redondeadas = obrasActivas.map(() => Math.round(partes * 100) / 100);
    const suma = redondeadas.reduce((a, b) => a + b, 0);
    redondeadas[redondeadas.length - 1] += Math.round((totalNum - suma) * 100) / 100;
    setLineas(obrasActivas.map((o, i) => ({ obraId: o.id, monto: redondeadas[i].toFixed(2) })));
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
            Elegí tipo (Servicio / Proveedor / General), monto y caja. Según el tipo se abre el
            selector correspondiente abajo.
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
              <Label>Tipo *</Label>
              {esPagoProveedor ? (
                <div className="h-10 flex items-center px-3 rounded-md border border-border bg-muted/5 text-sm text-muted">
                  Proveedor (desde el detalle)
                </div>
              ) : (
                <Combobox
                  options={[
                    { value: 'SERVICIO', label: 'Servicio', hint: 'EPEC, Rentas, Seguros, etc.' },
                    { value: 'PROVEEDOR', label: 'Proveedor', hint: 'Casa Santos, Prolectric…' },
                    { value: 'GENERAL', label: 'General', hint: 'Sin categoría específica' },
                  ]}
                  value={tipoEgreso}
                  onChange={(v) => {
                    setTipoEgreso(v as TipoEgreso | '');
                    setCategoriaId('');
                    setBeneficiarioId('');
                  }}
                  placeholder="Elegí tipo…"
                  searchPlaceholder="Buscar tipo…"
                />
              )}
            </div>
          </div>

          {/* Combo dependiente del tipo: categorías (Servicio/General) o
              proveedores. Reemplaza al bloque de "Categoría" standalone. */}
          {tipoEgreso === 'SERVICIO' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Servicio (categoría) *</Label>
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
                onChange={setCategoriaId}
                placeholder="Elegí servicio…"
                searchPlaceholder="Buscar (EPEC, Rentas, Seguros…)"
                emptyText="Sin categorías de servicio. Creá una con + Nueva categoría."
              />
              <p className="text-[11px] text-muted">
                Si la categoría está vinculada a vehículos, el gasto se imputa a uno o varios
                vehículos en vez de obras.
              </p>
            </div>
          )}
          {tipoEgreso === 'PROVEEDOR' && !esPagoProveedor && (
            <div className="space-y-2">
              <Label>Proveedor *</Label>
              <Combobox
                options={benesOpts}
                value={beneficiarioId}
                onChange={setBeneficiarioId}
                placeholder="Elegí proveedor…"
                searchPlaceholder="Buscar proveedor…"
                emptyText="No hay proveedores. Creá uno desde Proveedores."
              />
            </div>
          )}
          {tipoEgreso === 'GENERAL' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Categoría general *</Label>
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
                onChange={setCategoriaId}
                placeholder="Elegí categoría…"
                searchPlaceholder="Buscar categoría…"
                emptyText="Sin categorías generales. Creá una con + Nueva categoría."
              />
            </div>
          )}

          {/* Imputación a VEHÍCULOS: aparece cuando la categoría elegida
              tiene flag vinculadaVehiculo (Seguro, Patentes, Rentas automotor,
              Mecánica). Reemplaza al bloque de obras. */}
          {modoVehiculos && (
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label>Imputación a vehículo(s) *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setLineasVeh((prev) => [...prev, { vehiculoId: '', monto: '' }])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Agregar vehículo
                </Button>
              </div>
              <div className="space-y-2">
                {lineasVeh.length === 0 && (
                  <p className="text-xs text-muted italic">
                    Agregá al menos un vehículo. Si el gasto es compartido (ej: seguro mensual),
                    repartí el monto entre varios.
                  </p>
                )}
                {lineasVeh.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                    <Combobox
                      options={vehiculos.map((v) => ({
                        value: v.id,
                        label: v.nombre,
                        hint: v.patente,
                      }))}
                      value={l.vehiculoId}
                      onChange={(v) =>
                        setLineasVeh((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, vehiculoId: v } : x)),
                        )
                      }
                      placeholder="Elegí vehículo…"
                      searchPlaceholder="Buscar…"
                    />
                    <MoneyInput
                      placeholder="Monto"
                      value={l.monto}
                      onChange={(v) =>
                        setLineasVeh((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, monto: v } : x)),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setLineasVeh((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              {lineasVeh.length > 0 && totalNum > 0 && (
                <div className="text-xs text-right">
                  {Math.abs(diferenciaVeh) < 0.01 ? (
                    <span className="text-success">
                      Suma {formatearMonto(sumaLineasVeh, moneda)} = total exacto
                    </span>
                  ) : (
                    <span className="text-danger">
                      Suma {formatearMonto(sumaLineasVeh, moneda)} · Diferencia{' '}
                      {formatearMonto(diferenciaVeh, moneda)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Imputación a OBRAS — va arriba de categoría porque es más importante
              (define a qué obra se imputa el gasto). En modo "pago a
              proveedor" las obras del último resumen vienen pre-llenas con
              el saldo pendiente visible al lado; el usuario ingresa cuánto
              paga a cada una (puede dejar menos, igual o más que el saldo). */}
          {!modoVehiculos && (
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
          )}

          {/* Warnings de préstamo a empleado — se mantienen por si en el
              futuro habilitamos egreso tipo=Préstamo dentro de "General" */}
          {esPrestamoEmpleado && (
            <p className="text-xs text-warning">
              Se va a crear un préstamo al empleado con saldo = monto. Se descontará en
              liquidaciones futuras.
            </p>
          )}
          {prestamoRequiereEmpleado && (
            <p className="text-xs text-danger">
              Elegí un empleado (categoría "Préstamos a empleados" requiere beneficiario tipo EMPLEADO).
            </p>
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
          tipoInicial={
            tipoEgreso === 'SERVICIO'
              ? 'SERVICIO'
              : tipoEgreso === 'GENERAL'
                ? 'GENERAL'
                : 'GENERAL'
          }
          onClose={() => setNuevaCatOpen(false)}
          onCreada={(cat) => {
            setCategoriaId(cat.id);
            qc.invalidateQueries({ queryKey: ['categorias'] });
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
  tipoInicial = 'GENERAL',
}: {
  onClose: () => void;
  onCreada: (cat: Categoria) => void;
  /** Tipo sugerido cuando se crea desde el flujo de egreso con un tipo ya
   * elegido (ej: estoy en modo SERVICIO → arranco en SERVICIO). */
  tipoInicial?: Categoria['tipo'];
}) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<Categoria['tipo']>(tipoInicial);
  // Reunión Dani 18/11: cuando se crea una categoría de SERVICIO, puede
  // marcarse como "vinculada a vehículos" (Seguro, Patentes, Rentas
  // Automotor, Mecánica). Al elegirla en el egreso, el reparto se hace a
  // vehículos en vez de obras.
  const [vinculadaVehiculo, setVinculadaVehiculo] = useState(false);

  const m = useMutation({
    mutationFn: () =>
      categoriasService.create({
        codigo: codigo.trim().toUpperCase(),
        nombre: nombre.trim(),
        tipo,
        vinculadaVehiculo: tipo === 'SERVICIO' ? vinculadaVehiculo : false,
      }),
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
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Combobox
              options={[
                { value: 'SERVICIO', label: 'Servicio', hint: 'EPEC, Rentas, Seguros…' },
                { value: 'PROVEEDOR', label: 'Proveedor', hint: 'Casa Santos, Prolectric…' },
                { value: 'GENERAL', label: 'General', hint: 'Gastos generales' },
                { value: 'EMPLEADO', label: 'Empleado', hint: 'Jornales, préstamos' },
                { value: 'INGRESO', label: 'Ingreso', hint: 'Solo para ingresos' },
              ]}
              value={tipo}
              onChange={(v) => setTipo(v as Categoria['tipo'])}
              placeholder="Elegí tipo…"
              searchPlaceholder="Buscar tipo…"
            />
          </div>
          {tipo === 'SERVICIO' && (
            <label className="flex items-start gap-2 rounded-md border border-border bg-muted/5 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={vinculadaVehiculo}
                onChange={(e) => setVinculadaVehiculo(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">Vinculada a vehículos</div>
                <div className="text-[11px] text-muted">
                  Al elegir esta categoría en un egreso, el reparto será entre vehículos
                  (seguro, patente, mecánica, etc.) en lugar de obras.
                </div>
              </div>
            </label>
          )}
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
