import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeftRight,
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ScrollText,
  Settings2,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cajasService } from '@/services/cajasService';
import { obrasService } from '@/services/obrasService';
import { categoriasService } from '@/services/categoriasService';
import {
  movimientosService,
  type EstadoMovimiento,
  type Movimiento,
  type TipoMovimiento,
} from '@/services/movimientosService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';
import { NuevoEgresoDialog } from '@/pages/movimientos/NuevoEgresoDialog';
import { NuevoIngresoDialog } from '@/pages/movimientos/NuevoIngresoDialog';
import { TransferirDialog } from '@/pages/movimientos/TransferirDialog';
import { CambioMonedaDialog } from '@/pages/movimientos/CambioMonedaDialog';
import { CarteraChequesDialog } from './CarteraChequesDialog';
import { NuevoChequeDialog } from './NuevoChequeDialog';
import { GestionCuentasDialog } from './GestionCuentasDialog';
import { CotizacionBadge } from '@/components/layout/CotizacionBadge';
import { Pagination } from '@/components/ui/pagination';
import { Landmark, Filter } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type MonedaFiltro = 'TODAS' | 'ARS' | 'USD';

const ESTADO_VARIANTE: Record<EstadoMovimiento, 'success' | 'danger' | 'muted'> = {
  CONFIRMADO: 'success',
  ANULADO: 'danger',
  REVERSA: 'muted',
};

export function BilleteraPage() {
  const qc = useQueryClient();

  // ---------- Filtros ----------
  const [cajaId, setCajaId] = useState<string>('');
  const [moneda, setMoneda] = useState<MonedaFiltro>('TODAS');
  const [desde, setDesde] = useState<string>(() => inicioMesActual());
  const [hasta, setHasta] = useState<string>(() => hoyIso());
  const [tipo, setTipo] = useState<TipoMovimiento | ''>('');
  const [obraId, setObraId] = useState<string>('');
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ---------- Dialogs ----------
  const [openEgreso, setOpenEgreso] = useState(false);
  const [openIngreso, setOpenIngreso] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [openCambio, setOpenCambio] = useState(false);
  const [openCartera, setOpenCartera] = useState(false);
  const [openNuevoCheque, setOpenNuevoCheque] = useState(false);
  const [openCuentas, setOpenCuentas] = useState(false);
  const [openFiltrosMobile, setOpenFiltrosMobile] = useState(false);
  const [openFiltrosMovsMobile, setOpenFiltrosMovsMobile] = useState(false);

  // ---------- Data ----------
  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas', 'activas'],
    queryFn: () => cajasService.list(true),
  });
  const { data: saldos = [] } = useQuery({
    queryKey: ['cajas', 'saldos'],
    queryFn: cajasService.saldos,
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras', { activo: true }],
    queryFn: () => obrasService.list({ activo: true }),
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias', 'activas'],
    queryFn: () => categoriasService.list(true),
  });
  const { data: listado, isLoading: loadingMovs } = useQuery({
    queryKey: [
      'movimientos',
      { cajaId, tipo, obraId, categoriaId, desde, hasta, q, page, pageSize },
    ],
    queryFn: () =>
      movimientosService.list({
        cajaId: cajaId || undefined,
        tipo: tipo || undefined,
        obraId: obraId || undefined,
        categoriaId: categoriaId || undefined,
        desde,
        hasta,
        q: q || undefined,
        page,
        pageSize,
      }),
  });

  // Reset a página 1 al cambiar cualquier filtro
  useEffect(() => {
    setPage(1);
  }, [cajaId, tipo, obraId, categoriaId, desde, hasta, q, pageSize]);

  // ---------- Totales ----------
  const totales = useMemo(() => {
    let saldoArs = 0;
    let saldoUsd = 0;
    for (const s of saldos) {
      if (cajaId && s.cajaId !== cajaId) continue;
      if (s.moneda === 'ARS' && moneda !== 'USD') saldoArs += Number(s.saldo);
      if (s.moneda === 'USD' && moneda !== 'ARS') saldoUsd += Number(s.saldo);
    }
    let ingresos = 0;
    let egresos = 0;
    for (const m of listado?.data ?? []) {
      if (m.estado !== 'CONFIRMADO') continue;
      const monto = Number(m.monto);
      if (m.tipo === 'INGRESO') ingresos += monto;
      if (m.tipo === 'EGRESO') egresos += monto;
    }
    return { saldoArs, saldoUsd, ingresos, egresos };
  }, [saldos, cajaId, moneda, listado]);

  const monedaCajaSel = cajas.find((c) => c.id === cajaId)?.moneda;

  // ---------- Acciones ----------
  const anularMut = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      movimientosService.anular(id, motivo),
    onSuccess: () => {
      toast.success('Movimiento anulado (reversa generada)');
      refrescar();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo anular',
      ),
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['movimientos'] });
    qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
    qc.invalidateQueries({ queryKey: ['cheques'] });
  };

  // ---------- Atajos ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key === 'n') {
        e.preventDefault();
        setOpenIngreso(true);
      }
      if (e.key === 'e') {
        e.preventDefault();
        setOpenEgreso(true);
      }
      if (e.key === 't') {
        e.preventDefault();
        setOpenTransfer(true);
      }
      if (e.key === '/') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[data-mov-search]')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    // -m-* neutraliza el padding del <main>; el h-[calc(100%+N)] compensa
    // ese padding en la altura para que la Billetera ocupe el main completo.
    <div className="-m-4 sm:-m-6 lg:-m-8 h-[calc(100%+2rem)] sm:h-[calc(100%+3rem)] lg:h-[calc(100%+4rem)] flex flex-col">
      {/* ==================== HERO ==================== */}
      <div
        className="shrink-0 relative bg-accent text-white px-4 sm:px-8 lg:px-12 pt-6 pb-8 shadow-lg"
        style={{
          backgroundImage:
            'radial-gradient(500px 220px at 15% -40px, rgba(67,144,182,0.5), transparent 70%), radial-gradient(500px 220px at 85% -20px, rgba(100,180,220,0.3), transparent 70%)',
        }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Billetera</h1>
            <p className="text-sm text-white/60">
              Cajas, movimientos, cheques y cotización — todo en un solo lugar.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <CotizacionBadge variant="dark" />
            {/* Botón Filtros — solo mobile */}
            <Button
              variant="outline"
              onClick={() => setOpenFiltrosMobile(true)}
              className="md:hidden bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <Filter className="h-4 w-4 mr-1" />
              Filtros
              {(cajaId || moneda !== 'TODAS') && (
                <span className="ml-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>
            <NuevoMenu
              onIngreso={() => setOpenIngreso(true)}
              onEgreso={() => setOpenEgreso(true)}
              onTransferir={() => setOpenTransfer(true)}
              onCambio={() => setOpenCambio(true)}
              onCheque={() => setOpenNuevoCheque(true)}
            />
            <HerramientasMenu
              onCartera={() => setOpenCartera(true)}
              onCuentas={() => setOpenCuentas(true)}
              onRefrescar={refrescar}
            />
          </div>
        </div>

        {/* Filtros — solo desktop (en mobile van al dialog "Filtros") */}
        <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 block mb-1">
              Caja
            </label>
            <Combobox
              variant="dark"
              options={cajas.map((c) => ({
                value: c.id,
                label: c.nombre,
                hint: c.moneda,
              }))}
              value={cajaId}
              onChange={setCajaId}
              allLabel="Todas las cajas"
              searchPlaceholder="Buscar caja…"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 block mb-1">
              Moneda
            </label>
            <Select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as MonedaFiltro)}
              className="bg-white/10 border-white/20 text-white"
            >
              <option value="TODAS" className="text-foreground">
                Todas
              </option>
              <option value="ARS" className="text-foreground">
                ARS
              </option>
              <option value="USD" className="text-foreground">
                USD
              </option>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 block mb-1">
              Desde
            </label>
            <Input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="bg-white/10 border-white/20 text-white [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 block mb-1">
              Hasta
            </label>
            <Input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="bg-white/10 border-white/20 text-white [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <BigStatCard
            titulo="Saldos"
            subtitulo={cajaId ? cajas.find((c) => c.id === cajaId)?.nombre ?? '' : 'Todas las cajas'}
            items={[
              {
                label: 'ARS',
                simbolo: '$',
                value: totales.saldoArs,
                color: totales.saldoArs < 0 ? 'text-red-300' : 'text-white',
                icon: <Wallet className="h-3 w-3" />,
              },
              {
                label: 'USD',
                simbolo: 'US$',
                value: totales.saldoUsd,
                color: totales.saldoUsd < 0 ? 'text-red-300' : 'text-white',
                icon: <Wallet className="h-3 w-3" />,
              },
            ]}
          />
          <BigStatCard
            titulo={`Movimientos · ${rangoLabel(desde, hasta)}`}
            subtitulo={`${listado?.total ?? 0} registros`}
            items={[
              {
                label: 'Ingresos',
                simbolo: '+',
                value: totales.ingresos,
                color: 'text-emerald-300',
                icon: <TrendingUp className="h-3 w-3" />,
              },
              {
                label: 'Egresos',
                simbolo: '−',
                value: totales.egresos,
                color: 'text-red-300',
                icon: <TrendingDown className="h-3 w-3" />,
              },
            ]}
          />
        </div>
      </div>

      {/* ==================== BODY (hero → filtros → tabla scroll → footer) ==================== */}
      <div className="flex-1 min-h-0 flex flex-col bg-card">
        {/* Filtros fijos arriba */}
        <div className="shrink-0 border-b border-border px-4 sm:px-6 lg:px-8 py-3 bg-card">
          <div className="flex items-center justify-between gap-3 lg:justify-start lg:gap-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Movimientos
            </h2>
            {/* Botón Filtros — solo mobile */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenFiltrosMovsMobile(true)}
              className="md:hidden h-8 text-xs"
            >
              <Filter className="h-3.5 w-3.5 mr-1" />
              Filtros
              {(tipo || obraId || categoriaId || q) && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Button>
            <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap items-center gap-2 w-full lg:w-auto">
              <Combobox
                size="sm"
                className="w-full lg:w-36"
                options={[
                  { value: 'INGRESO', label: 'Ingresos' },
                  { value: 'EGRESO', label: 'Egresos' },
                ]}
                value={tipo}
                onChange={(v) => setTipo(v as TipoMovimiento | '')}
                allLabel="Tipo: todos"
                searchPlaceholder="Filtrar tipo…"
              />
              <Combobox
                size="sm"
                className="w-full lg:w-48"
                options={obras.map((o) => ({ value: o.id, label: o.nombre, hint: o.tipo }))}
                value={obraId}
                onChange={setObraId}
                allLabel="Obra: todas"
                searchPlaceholder="Buscar obra…"
                emptyText="Ninguna obra coincide"
              />
              <Combobox
                size="sm"
                className="w-full lg:w-52"
                options={categorias.map((c) => ({
                  value: c.id,
                  label: c.nombre,
                  hint: c.codigo,
                }))}
                value={categoriaId}
                onChange={setCategoriaId}
                allLabel="Categoría: todas"
                searchPlaceholder="Buscar categoría…"
                emptyText="Ninguna categoría coincide"
              />
              <div className="relative col-span-2 sm:col-span-3 lg:col-span-1">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  data-mov-search
                  placeholder="Buscar en descripción… (/)"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-7 h-8 text-xs w-full lg:w-60"
                />
              </div>
              {(tipo || obraId || categoriaId || q) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs col-span-2 sm:col-span-3 lg:col-span-1"
                  onClick={() => {
                    setTipo('');
                    setObraId('');
                    setCategoriaId('');
                    setQ('');
                  }}
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tabla scrolleable — ocupa todo el espacio libre */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Table>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:bg-card [&_th]:z-10 [&_th]:border-b [&_th]:border-border [&_th]:shadow-[0_1px_0_0_hsl(var(--border))]">
              <TableRow>
                <TableHead className="pl-4 sm:pl-6 lg:pl-8">Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Caja</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Equiv.</TableHead>
                <TableHead>Obra(s)</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Beneficiario</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="pr-4 sm:pr-6 lg:pr-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingMovs && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted py-8">
                    <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!loadingMovs && listado?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted py-8">
                    Sin movimientos en el período. Ampliá las fechas o cargá el primero arriba.
                  </TableCell>
                </TableRow>
              )}
              {listado?.data.map((m) => (
                <MovimientoRow
                  key={m.id}
                  m={m}
                  onAnular={() => {
                    const motivo = prompt('Motivo de la anulación:');
                    if (motivo && motivo.trim().length >= 3)
                      anularMut.mutate({ id: m.id, motivo: motivo.trim() });
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Footer fijo abajo: paginación + atajos */}
        <div className="shrink-0 border-t border-border bg-card">
          {listado && (
            <Pagination
              total={listado.total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
          {/* Atajos de teclado — solo desktop (no sirven en mobile sin teclado físico) */}
          <div className="hidden md:flex text-xs text-muted px-4 sm:px-6 lg:px-8 py-2 border-t border-border items-center justify-between flex-wrap gap-2">
            <span>
              Atajos: <kbd className="px-1 border rounded">n</kbd> ingreso ·{' '}
              <kbd className="px-1 border rounded">e</kbd> egreso ·{' '}
              <kbd className="px-1 border rounded">t</kbd> transferir ·{' '}
              <kbd className="px-1 border rounded">/</kbd> buscar
            </span>
            <span>Moneda caja filtrada: {monedaCajaSel ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* ==================== DIALOGS ==================== */}
      <NuevoEgresoDialog
        open={openEgreso}
        onOpenChange={setOpenEgreso}
        onCreated={() => {
          setOpenEgreso(false);
          refrescar();
        }}
      />
      <NuevoIngresoDialog
        open={openIngreso}
        onOpenChange={setOpenIngreso}
        onCreated={() => {
          setOpenIngreso(false);
          refrescar();
        }}
      />
      <TransferirDialog
        open={openTransfer}
        onOpenChange={setOpenTransfer}
        onCreated={() => {
          setOpenTransfer(false);
          refrescar();
        }}
      />
      <CambioMonedaDialog
        open={openCambio}
        onOpenChange={setOpenCambio}
        onCreated={() => {
          setOpenCambio(false);
          refrescar();
        }}
      />
      <NuevoChequeDialog
        open={openNuevoCheque}
        onOpenChange={setOpenNuevoCheque}
        onCreated={() => {
          setOpenNuevoCheque(false);
          refrescar();
        }}
      />
      {openCartera && <CarteraChequesDialog onClose={() => setOpenCartera(false)} />}
      {openCuentas && <GestionCuentasDialog onClose={() => setOpenCuentas(false)} />}

      {/* ==================== DIALOGS DE FILTROS (mobile) ==================== */}
      {openFiltrosMobile && (
        <FiltrosGlobalesMobile
          cajas={cajas}
          cajaId={cajaId}
          setCajaId={setCajaId}
          moneda={moneda}
          setMoneda={setMoneda}
          desde={desde}
          setDesde={setDesde}
          hasta={hasta}
          setHasta={setHasta}
          onClose={() => setOpenFiltrosMobile(false)}
        />
      )}
      {openFiltrosMovsMobile && (
        <FiltrosMovimientosMobile
          obras={obras}
          categorias={categorias}
          tipo={tipo}
          setTipo={setTipo}
          obraId={obraId}
          setObraId={setObraId}
          categoriaId={categoriaId}
          setCategoriaId={setCategoriaId}
          q={q}
          setQ={setQ}
          onClose={() => setOpenFiltrosMovsMobile(false)}
        />
      )}
    </div>
  );
}

// ======================================================================
// Dialogs de filtros mobile
// ======================================================================

function FiltrosGlobalesMobile({
  cajas,
  cajaId,
  setCajaId,
  moneda,
  setMoneda,
  desde,
  setDesde,
  hasta,
  setHasta,
  onClose,
}: {
  cajas: Array<{ id: string; nombre: string; moneda: string }>;
  cajaId: string;
  setCajaId: (v: string) => void;
  moneda: MonedaFiltro;
  setMoneda: (v: MonedaFiltro) => void;
  desde: string;
  setDesde: (v: string) => void;
  hasta: string;
  setHasta: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filtros</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Caja</Label>
            <Combobox
              options={cajas.map((c) => ({ value: c.id, label: c.nombre, hint: c.moneda }))}
              value={cajaId}
              onChange={setCajaId}
              allLabel="Todas las cajas"
              searchPlaceholder="Buscar caja…"
            />
          </div>
          <div className="space-y-2">
            <Label>Moneda</Label>
            <Select value={moneda} onChange={(e) => setMoneda(e.target.value as MonedaFiltro)}>
              <option value="TODAS">Todas</option>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FiltrosMovimientosMobile({
  obras,
  categorias,
  tipo,
  setTipo,
  obraId,
  setObraId,
  categoriaId,
  setCategoriaId,
  q,
  setQ,
  onClose,
}: {
  obras: Array<{ id: string; nombre: string; tipo: string }>;
  categorias: Array<{ id: string; codigo: string; nombre: string }>;
  tipo: TipoMovimiento | '';
  setTipo: (v: TipoMovimiento | '') => void;
  obraId: string;
  setObraId: (v: string) => void;
  categoriaId: string;
  setCategoriaId: (v: string) => void;
  q: string;
  setQ: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filtros de movimientos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Combobox
              options={[
                { value: 'INGRESO', label: 'Ingresos' },
                { value: 'EGRESO', label: 'Egresos' },
              ]}
              value={tipo}
              onChange={(v) => setTipo(v as TipoMovimiento | '')}
              allLabel="Todos los tipos"
            />
          </div>
          <div className="space-y-2">
            <Label>Obra</Label>
            <Combobox
              options={obras.map((o) => ({ value: o.id, label: o.nombre, hint: o.tipo }))}
              value={obraId}
              onChange={setObraId}
              allLabel="Todas las obras"
              searchPlaceholder="Buscar obra…"
            />
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Combobox
              options={categorias.map((c) => ({ value: c.id, label: c.nombre, hint: c.codigo }))}
              value={categoriaId}
              onChange={setCategoriaId}
              allLabel="Todas las categorías"
              searchPlaceholder="Buscar categoría…"
            />
          </div>
          <div className="space-y-2">
            <Label>Buscar en descripción</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Texto libre…" />
          </div>
          {(tipo || obraId || categoriaId || q) && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setTipo('');
                setObraId('');
                setCategoriaId('');
                setQ('');
              }}
            >
              Limpiar todos los filtros
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ======================================================================
// Sub-componentes
// ======================================================================

function MovimientoRow({ m, onAnular }: { m: Movimiento; onAnular: () => void }) {
  const obras =
    m.imputaciones?.length
      ? m.imputaciones.map((i) => i.obra.nombre).join(', ')
      : null;
  return (
    <TableRow>
      <TableCell className="num">{formatearFecha(m.fecha)}</TableCell>
      <TableCell>
        <Badge
          variant={
            m.tipo === 'INGRESO' ? 'success' : m.tipo === 'EGRESO' ? 'danger' : 'muted'
          }
        >
          {m.tipo}
        </Badge>
      </TableCell>
      <TableCell className="text-xs">{m.caja?.nombre}</TableCell>
      <TableCell className="num font-medium">{formatearMonto(m.monto, m.moneda)}</TableCell>
      <TableCell className="num text-xs text-muted">
        {m.moneda === 'ARS'
          ? formatearMonto(m.montoUsd, 'USD')
          : formatearMonto(m.montoArs, 'ARS')}
      </TableCell>
      <TableCell className="text-xs max-w-[180px]">
        {obras ? (
          <span className="inline-block px-2 py-0.5 rounded bg-primary/10 text-primary font-medium truncate max-w-full">
            {obras}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted">{m.categoria?.nombre ?? '—'}</TableCell>
      <TableCell className="text-xs">{m.beneficiario?.nombre ?? '—'}</TableCell>
      <TableCell className="text-xs max-w-xs">
        <div className="truncate">{m.descripcion ?? '—'}</div>
      </TableCell>
      <TableCell>
        <Badge variant={ESTADO_VARIANTE[m.estado]}>{m.estado}</Badge>
      </TableCell>
      <TableCell>
        {m.estado === 'CONFIRMADO' && (
          <Button variant="ghost" size="icon" onClick={onAnular} title="Anular">
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function BigStatCard({
  titulo,
  subtitulo,
  items,
  footer,
}: {
  titulo: string;
  subtitulo?: string;
  items: Array<{
    label: string;
    simbolo: string;
    value: number;
    color?: string;
    icon?: React.ReactNode;
  }>;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/[0.06] border border-white/10 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
          {titulo}
        </div>
        {subtitulo && <div className="text-[11px] text-white/40 truncate ml-2">{subtitulo}</div>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {items.map((it, i) => {
          const nfmt = it.value.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          return (
            <div key={i}>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50 flex items-center gap-1">
                {it.icon}
                {it.label}
              </div>
              <div className={`mt-1 flex items-baseline gap-1 ${it.color ?? 'text-white'}`}>
                <span className="text-base text-white/60">{it.simbolo}</span>
                <span className="text-2xl md:text-3xl font-bold tabular-nums truncate">{nfmt}</span>
              </div>
            </div>
          );
        })}
      </div>
      {footer && <div className="mt-3 pt-3 border-t border-white/10">{footer}</div>}
    </div>
  );
}

function NuevoMenu({
  onIngreso,
  onEgreso,
  onTransferir,
  onCambio,
  onCheque,
}: {
  onIngreso: () => void;
  onEgreso: () => void;
  onTransferir: () => void;
  onCambio: () => void;
  onCheque: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setOpen((v) => !v)} className="shadow-lg">
        <Plus className="h-4 w-4 mr-1" /> Nuevo <ChevronDown className="h-3 w-3 ml-1" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-lg shadow-xl z-30 overflow-hidden text-foreground">
          <MenuItem
            icon={<TrendingUp className="h-4 w-4 text-success" />}
            label="Ingreso"
            hint="Cobros, aportes, devoluciones"
            onClick={() => {
              setOpen(false);
              onIngreso();
            }}
          />
          <MenuItem
            icon={<Minus className="h-4 w-4 text-danger" />}
            label="Egreso"
            hint="Pagos, gastos, imputación a obra"
            onClick={() => {
              setOpen(false);
              onEgreso();
            }}
          />
          <MenuItem
            icon={<ArrowLeftRight className="h-4 w-4 text-primary" />}
            label="Transferencia"
            hint="Entre cajas de la misma moneda"
            onClick={() => {
              setOpen(false);
              onTransferir();
            }}
          />
          <MenuItem
            icon={<RefreshCw className="h-4 w-4 text-primary" />}
            label="Cambio USD ↔ ARS"
            hint="Con cotización pactada"
            onClick={() => {
              setOpen(false);
              onCambio();
            }}
          />
          <div className="border-t border-border" />
          <MenuItem
            icon={<ScrollText className="h-4 w-4 text-primary" />}
            label="Nuevo cheque"
            hint="Propio o de tercero"
            onClick={() => {
              setOpen(false);
              onCheque();
            }}
          />
        </div>
      )}
    </div>
  );
}

function HerramientasMenu({
  onCartera,
  onCuentas,
  onRefrescar,
}: {
  onCartera: () => void;
  onCuentas: () => void;
  onRefrescar: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
      >
        <Settings2 className="h-4 w-4 mr-1" /> Herramientas{' '}
        <ChevronDown className="h-3 w-3 ml-1" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-card border border-border rounded-lg shadow-xl z-30 overflow-hidden text-foreground">
          <MenuItem
            icon={<Landmark className="h-4 w-4 text-primary" />}
            label="Cuentas"
            hint="Saldos, alta y ajustes"
            onClick={() => {
              setOpen(false);
              onCuentas();
            }}
          />
          <MenuItem
            icon={<ScrollText className="h-4 w-4 text-primary" />}
            label="Cartera de cheques"
            hint="Agrupado por vencimiento"
            onClick={() => {
              setOpen(false);
              onCartera();
            }}
          />
          <MenuItem
            icon={<RefreshCw className="h-4 w-4 text-primary" />}
            label="Refrescar datos"
            onClick={() => {
              setOpen(false);
              onRefrescar();
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 hover:bg-muted/10 transition flex items-start gap-3"
    >
      <span className="mt-0.5">{icon}</span>
      <span className="flex-1">
        <span className="text-sm font-medium block">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
}

// ---------- helpers ----------

function inicioMesActual(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function rangoLabel(desde: string, hasta: string): string {
  const short = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  };
  return `${short(desde)} — ${short(hasta)}`;
}
