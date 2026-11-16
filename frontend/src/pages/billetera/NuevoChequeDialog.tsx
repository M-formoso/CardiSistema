import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  chequesService,
  type CreateChequeInput,
  type TipoCheque,
} from '@/services/chequesService';
import { beneficiariosService } from '@/services/beneficiariosService';
import { cajasService } from '@/services/cajasService';
import { obrasService } from '@/services/obrasService';
import { cn } from '@/lib/utils';

// Bancos argentinos más usados. El input tiene autocompletado: las sugerencias
// aparecen SOLO cuando el usuario empieza a tipear (no hay chevron ni lista
// desplegable al hacer click). Si no hay match, se acepta el texto libre.
const BANCOS_AR = [
  'Nación', 'Provincia', 'Ciudad', 'Galicia', 'Santander', 'BBVA',
  'Macro', 'Patagonia', 'Credicoop', 'Comafi', 'HSBC', 'Supervielle',
  'ICBC', 'Itaú', 'Hipotecario', 'Industrial', 'Bind', 'Bica', 'CMF',
  'Columbia', 'Piano', 'Mariva', 'Formosa', 'Chaco',
];

/**
 * Alta rápida de cheque desde la billetera.
 * Si el cheque es TERCERO, al guardarse el backend genera también el INGRESO
 * a la Caja Cheques correspondiente (misma transacción). Esta UI deja elegir
 * la caja destino (si hay más de una) y una obra opcional para imputar.
 */
export function NuevoChequeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoCheque>('TERCERO');
  const [numero, setNumero] = useState('');
  const [banco, setBanco] = useState('');
  const [titular, setTitular] = useState('');
  const [cuit, setCuit] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [fechaEmision, setFechaEmision] = useState(() => new Date().toISOString().slice(0, 10));
  const [fechaPago, setFechaPago] = useState(() => new Date().toISOString().slice(0, 10));
  const [beneficiarioId, setBeneficiarioId] = useState('');
  const [cajaIngresoId, setCajaIngresoId] = useState('');
  const [obraIngresoId, setObraIngresoId] = useState('');

  const { data: benes = [] } = useQuery({
    queryKey: ['beneficiarios', { activo: true }],
    queryFn: () => beneficiariosService.list({ activo: true }),
  });
  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas', 'activas'],
    queryFn: () => cajasService.list(true),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras', { activo: true }],
    queryFn: () => obrasService.list({ activo: true }),
  });

  // Cajas candidatas: CHEQUES_TERCEROS activas y en la moneda elegida.
  const cajasCheques = useMemo(
    () => cajas.filter((c) => c.tipo === 'CHEQUES_TERCEROS' && c.moneda === moneda),
    [cajas, moneda],
  );

  const benesOpts = useMemo<ComboboxOption[]>(
    () => benes.map((b) => ({ value: b.id, label: b.nombre, hint: b.tipo })),
    [benes],
  );
  const cajasChequesOpts = useMemo<ComboboxOption[]>(
    () => cajasCheques.map((c) => ({ value: c.id, label: c.nombre, hint: c.moneda })),
    [cajasCheques],
  );
  const obrasOpts = useMemo<ComboboxOption[]>(
    () => obras.map((o) => ({ value: o.id, label: o.nombre })),
    [obras],
  );

  const m = useMutation({
    mutationFn: (input: CreateChequeInput) => chequesService.create(input),
    onSuccess: () => {
      toast.success('Cheque creado — ingreso registrado en la caja');
      setNumero('');
      setBanco('');
      setTitular('');
      setCuit('');
      setMonto('');
      setBeneficiarioId('');
      setCajaIngresoId('');
      setObraIngresoId('');
      qc.invalidateQueries({ queryKey: ['cheques'] });
      qc.invalidateQueries({ queryKey: ['movimientos'] });
      qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
      onCreated();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo crear',
      ),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo cheque</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!numero.trim() || !monto)
              return toast.error('Número y monto son obligatorios');
            if (tipo === 'TERCERO' && cajasCheques.length === 0) {
              return toast.error(
                `No hay ninguna caja CHEQUES_TERCEROS en ${moneda}. Creala primero en Billetera → Cuentas.`,
              );
            }
            if (tipo === 'TERCERO' && cajasCheques.length > 1 && !cajaIngresoId) {
              return toast.error('Elegí a qué caja va el cheque.');
            }
            m.mutate({
              tipo,
              numero: numero.trim(),
              banco: banco.trim() || undefined,
              titular: titular.trim() || undefined,
              cuit: cuit.trim() || undefined,
              monto: Number(monto),
              moneda,
              fechaEmision,
              fechaPago,
              beneficiarioId: beneficiarioId || undefined,
              cajaIngresoId: cajaIngresoId || undefined,
              obraIngresoId: obraIngresoId || undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCheque)}>
                <option value="TERCERO">De tercero (recibido)</option>
                <option value="PROPIO">Propio (emitido)</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número *</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Banco</Label>
              <BankInput value={banco} onChange={setBanco} options={BANCOS_AR} />
            </div>
            <div className="space-y-2">
              <Label>Titular / Librador</Label>
              <Input value={titular} onChange={(e) => setTitular(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>CUIT</Label>
              <Input value={cuit} onChange={(e) => setCuit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Monto *</Label>
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
              <Label>Moneda</Label>
              <Select value={moneda} onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD')}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha emisión *</Label>
              <Input
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha pago *</Label>
              <Input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Beneficiario (opcional)</Label>
            <Combobox
              options={benesOpts}
              value={beneficiarioId}
              onChange={setBeneficiarioId}
              placeholder="Sin asignar"
              searchPlaceholder="Buscar beneficiario…"
              allLabel="Sin asignar"
            />
          </div>

          {tipo === 'TERCERO' && (
            <div className="rounded-md border border-border bg-muted/5 p-3 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                Ingreso a la caja
              </div>
              {cajasCheques.length === 0 && (
                <p className="text-xs text-danger">
                  No hay ninguna caja CHEQUES_TERCEROS en {moneda}. Creala primero en Billetera → Cuentas.
                </p>
              )}
              {cajasCheques.length > 1 && (
                <div className="space-y-2">
                  <Label>Caja destino *</Label>
                  <Combobox
                    options={cajasChequesOpts}
                    value={cajaIngresoId}
                    onChange={setCajaIngresoId}
                    placeholder="Elegí caja…"
                    searchPlaceholder="Buscar…"
                  />
                </div>
              )}
              {cajasCheques.length === 1 && (
                <p className="text-xs text-muted">
                  El ingreso se va a cargar en{' '}
                  <span className="font-medium text-foreground">{cajasCheques[0].nombre}</span>.
                </p>
              )}
              <div className="space-y-2">
                <Label>Obra (opcional)</Label>
                <Combobox
                  options={obrasOpts}
                  value={obraIngresoId}
                  onChange={setObraIngresoId}
                  placeholder="Sin imputar a obra"
                  searchPlaceholder="Buscar obra…"
                  allLabel="Sin imputar a obra"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear cheque'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Input con autocompletado inline. Se comporta como un input normal (sin
 * chevron, sin dropdown al click), pero muestra sugerencias debajo solo
 * cuando el usuario tipea algo que matchea con la lista. Acepta texto
 * libre: si el usuario escribe algo que no está en la lista, se guarda igual.
 * Navegable con ↑ ↓ Enter Esc.
 */
function BankInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter((o) => o.toLowerCase().includes(q) && o.toLowerCase() !== q)
      .slice(0, 8);
  }, [value, options]);

  const show = focused && matches.length > 0;

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlight(0);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setFocused(true);
        }}
        onBlur={() => {
          // Pequeño delay para que el click en la sugerencia se registre
          blurTimer.current = setTimeout(() => setFocused(false), 150);
        }}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const chosen = matches[highlight];
            if (chosen) {
              onChange(chosen);
              setFocused(false);
            }
          } else if (e.key === 'Escape') {
            setFocused(false);
          }
        }}
        placeholder="Tipeá el banco…"
        autoComplete="off"
      />
      {show && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-xl max-h-60 overflow-y-auto">
          {matches.map((m, i) => (
            <button
              key={m}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(m);
                setFocused(false);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                'w-full text-left px-3 py-2 text-sm transition-colors',
                i === highlight ? 'bg-primary/10 text-primary' : 'hover:bg-muted/5',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
