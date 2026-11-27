import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeftRight,
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ScrollText,
  Settings2,
  TrendingUp,
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
import { beneficiariosService } from '@/services/beneficiariosService';
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
import { MovimientoDetalleDialog } from './MovimientoDetalleDialog';
import { MovimientoEditarDialog } from './MovimientoEditarDialog';
import { CotizacionBadge } from '@/components/layout/CotizacionBadge';
import { Pagination } from '@/components/ui/pagination';
import { FitText } from '@/components/ui/fit-text';
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
  const [beneficiarioId, setBeneficiarioId] = useState<string>('');
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
  const { data: benes = [] } = useQuery({
    queryKey: ['beneficiarios', { activo: true }],
    queryFn: () => beneficiariosService.list({ activo: true }),
  });
  const { data: listado, isLoading: loadingMovs } = useQuery({
    queryKey: [
      'movimientos',
      { cajaId, tipo, obraId, categoriaId, beneficiarioId, desde, hasta, q, page, pageSize },
    ],
    queryFn: () =>
      movimientosService.list({
        cajaId: cajaId || undefined,
        tipo: tipo || undefined,
        obraId: obraId || undefined,
        categoriaId: categoriaId || undefined,
        beneficiarioId: beneficiarioId || undefined,
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
  }, [cajaId, tipo, obraId, categoriaId, beneficiarioId, desde, hasta, q, pageSize]);

  // ---------- Acciones ----------
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [editarMov, setEditarMov] = useState<Movimiento | null>(null);

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
      {/* ==================== HERO (reunión Dani 26/11 v2) ====================
          Un poco más alto que v1, con cards de caja grandes ocupando todo
          el banner (distribución horizontal pareja, no apretadas arriba). */}
      <div
        className="shrink-0 relative bg-accent text-white px-4 sm:px-8 lg:px-12 pt-5 pb-6 shadow-lg"
        style={{
          backgroundImage:
            'radial-gradient(500px 220px at 15% -40px, rgba(67,144,182,0.5), transparent 70%), radial-gradient(500px 220px at 85% -20px, rgba(100,180,220,0.3), transparent 70%)',
        }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h1 className="text-xl font-bold tracking-tight">Billetera</h1>
          <div className="flex gap-2 flex-wrap items-center">
            <CotizacionBadge variant="dark" />
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

        {/* Saldo por caja — una chip chica por caja, grilla responsive */}
        <SaldosCajasCompacto cajas={cajas} saldos={saldos} />
      </div>

      {/* ==================== BODY ====================
          Mini-barra solo con acciones. Los filtros bajan a la tabla
          (una fila sticky por debajo del header, uno por columna). */}
      <div className="flex-1 min-h-0 flex flex-col bg-card">
        <div className="shrink-0 border-b border-border px-4 sm:px-6 lg:px-8 py-2 bg-card flex items-center gap-3 flex-wrap">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider shrink-0">
            Movimientos
          </h2>
          {/* Mobile: dialog de filtros (más compacto que tener 8 combos en pantalla chica) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenFiltrosMovsMobile(true)}
            className="md:hidden h-8 text-xs"
          >
            <Filter className="h-3.5 w-3.5 mr-1" />
            Filtros
            {(cajaId || moneda !== 'TODAS' || tipo || obraId || categoriaId || beneficiarioId || q) && (
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </Button>
          <div className="hidden md:flex items-center gap-2 ml-auto">
            {(cajaId || moneda !== 'TODAS' || tipo || obraId || categoriaId || beneficiarioId || q) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setCajaId('');
                  setMoneda('TODAS');
                  setTipo('');
                  setObraId('');
                  setCategoriaId('');
                  setBeneficiarioId('');
                  setQ('');
                }}
              >
                Limpiar filtros
              </Button>
            )}
            <span className="text-[11px] text-muted">
              {listado?.total ?? 0} registros
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={async () => {
                try {
                  const blob = await movimientosService.pdfBlob({
                    cajaId: cajaId || undefined,
                    tipo: tipo || undefined,
                    obraId: obraId || undefined,
                    categoriaId: categoriaId || undefined,
                    beneficiarioId: beneficiarioId || undefined,
                    desde,
                    hasta,
                    q: q || undefined,
                  });
                  const url = URL.createObjectURL(blob);
                  window.open(url, '_blank');
                  setTimeout(() => URL.revokeObjectURL(url), 30_000);
                } catch {
                  toast.error('No se pudo generar el PDF');
                }
              }}
            >
              <Printer className="h-3.5 w-3.5 mr-1" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Tabla scrolleable — ocupa todo el espacio libre.
            Patrón Excel/Airtable (reunión Dani 26/11 v2): dos filas sticky
            arriba — títulos + filtros, uno por columna, alineados. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Table>
            <TableHeader className="[&_th]:bg-card [&_th]:z-10">
              {/* Fila 1: títulos */}
              <TableRow className="[&_th]:sticky [&_th]:top-0 [&_th]:border-b [&_th]:border-border/50">
                <TableHead className="pl-4 sm:pl-6 lg:pl-8">Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Caja</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Equiv.</TableHead>
                <TableHead>Obra(s)</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Beneficiario</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="pr-4 sm:pr-6 lg:pr-8">Estado</TableHead>
              </TableRow>
              {/* Fila 2: filtros alineados con cada columna (desktop).
                  En mobile se oculta y se usa el dialog "Filtros" de arriba. */}
              <TableRow className="hidden md:table-row [&_th]:sticky [&_th]:top-[37px] [&_th]:py-1.5 [&_th]:border-b [&_th]:border-border [&_th]:shadow-[0_1px_0_0_hsl(var(--border))]">
                <TableHead className="pl-4 sm:pl-6 lg:pl-8">
                  <div className="flex flex-col gap-0.5">
                    <Input
                      type="date"
                      value={desde}
                      onChange={(e) => setDesde(e.target.value)}
                      className="h-7 w-[120px] text-[11px] px-1.5"
                      aria-label="Desde"
                      title="Desde"
                    />
                    <Input
                      type="date"
                      value={hasta}
                      onChange={(e) => setHasta(e.target.value)}
                      className="h-7 w-[120px] text-[11px] px-1.5"
                      aria-label="Hasta"
                      title="Hasta"
                    />
                  </div>
                </TableHead>
                <TableHead>
                  <Select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as TipoMovimiento | '')}
                    className="h-7 w-[90px] text-[11px]"
                  >
                    <option value="">Todos</option>
                    <option value="INGRESO">Ingreso</option>
                    <option value="EGRESO">Egreso</option>
                  </Select>
                </TableHead>
                <TableHead>
                  <Combobox
                    size="sm"
                    className="w-[130px]"
                    options={cajas.map((c) => ({ value: c.id, label: c.nombre, hint: c.moneda }))}
                    value={cajaId}
                    onChange={setCajaId}
                    allLabel="Todas"
                    searchPlaceholder="Buscar caja…"
                  />
                </TableHead>
                <TableHead>
                  <Select
                    value={moneda}
                    onChange={(e) => setMoneda(e.target.value as MonedaFiltro)}
                    className="h-7 w-[85px] text-[11px]"
                    title="Filtrar por moneda"
                  >
                    <option value="TODAS">Todas</option>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </Select>
                </TableHead>
                <TableHead>{/* Equiv. — sin filtro */}</TableHead>
                <TableHead>
                  <Combobox
                    size="sm"
                    className="w-[150px]"
                    options={obras.map((o) => ({ value: o.id, label: o.nombre, hint: o.tipo }))}
                    value={obraId}
                    onChange={setObraId}
                    allLabel="Todas"
                    searchPlaceholder="Buscar obra…"
                    emptyText="Ninguna obra"
                  />
                </TableHead>
                <TableHead>
                  <Combobox
                    size="sm"
                    className="w-[140px]"
                    options={categorias.map((c) => ({ value: c.id, label: c.nombre, hint: c.codigo }))}
                    value={categoriaId}
                    onChange={setCategoriaId}
                    allLabel="Todas"
                    searchPlaceholder="Buscar categoría…"
                    emptyText="Ninguna"
                  />
                </TableHead>
                <TableHead>
                  <Combobox
                    size="sm"
                    className="w-[150px]"
                    options={benes.map((b) => ({ value: b.id, label: b.nombre, hint: b.tipo }))}
                    value={beneficiarioId}
                    onChange={setBeneficiarioId}
                    allLabel="Todos"
                    searchPlaceholder="Buscar…"
                    emptyText="Ninguno"
                  />
                </TableHead>
                <TableHead>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-1.5 top-1/2 -translate-y-1/2 text-muted" />
                    <Input
                      data-mov-search
                      placeholder="Buscar… (/)"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      className="pl-6 h-7 text-[11px] w-[160px]"
                    />
                  </div>
                </TableHead>
                <TableHead className="pr-4 sm:pr-6 lg:pr-8">{/* Estado — sin filtro por ahora */}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingMovs && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted py-8">
                    <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!loadingMovs && listado?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted py-8">
                    Sin movimientos en el período. Ampliá las fechas o cargá el primero arriba.
                  </TableCell>
                </TableRow>
              )}
              {listado?.data.map((m) => (
                <MovimientoRow
                  key={m.id}
                  m={m}
                  onDetalle={() => setDetalleId(m.id)}
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
            <span>{cajaId ? `Caja: ${cajas.find((c) => c.id === cajaId)?.nombre ?? '—'}` : 'Todas las cajas'}</span>
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

      <MovimientoDetalleDialog
        movimientoId={detalleId}
        onClose={() => setDetalleId(null)}
        onChanged={refrescar}
        onEditar={(mov) => {
          setDetalleId(null);
          setEditarMov(mov);
        }}
      />
      <MovimientoEditarDialog
        movimiento={editarMov}
        onClose={() => setEditarMov(null)}
        onSaved={refrescar}
      />

      {/* Dialog único de filtros (mobile) — ahora cubre todo: fecha, caja,
          moneda, tipo, obra, categoría, proveedor, buscador. */}
      {openFiltrosMovsMobile && (
        <FiltrosMovimientosMobile
          cajas={cajas}
          cajaId={cajaId}
          setCajaId={setCajaId}
          moneda={moneda}
          setMoneda={setMoneda}
          desde={desde}
          setDesde={setDesde}
          hasta={hasta}
          setHasta={setHasta}
          obras={obras}
          categorias={categorias}
          benes={benes}
          tipo={tipo}
          setTipo={setTipo}
          obraId={obraId}
          setObraId={setObraId}
          categoriaId={categoriaId}
          setCategoriaId={setCategoriaId}
          beneficiarioId={beneficiarioId}
          setBeneficiarioId={setBeneficiarioId}
          q={q}
          setQ={setQ}
          onClose={() => setOpenFiltrosMovsMobile(false)}
        />
      )}
    </div>
  );
}

// ======================================================================
// Dialog único de filtros (mobile)
// ======================================================================

function FiltrosMovimientosMobile({
  cajas,
  cajaId,
  setCajaId,
  moneda,
  setMoneda,
  desde,
  setDesde,
  hasta,
  setHasta,
  obras,
  categorias,
  benes,
  tipo,
  setTipo,
  obraId,
  setObraId,
  categoriaId,
  setCategoriaId,
  beneficiarioId,
  setBeneficiarioId,
  q,
  setQ,
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
  obras: Array<{ id: string; nombre: string; tipo: string }>;
  categorias: Array<{ id: string; codigo: string; nombre: string }>;
  benes: Array<{ id: string; nombre: string; tipo: string }>;
  tipo: TipoMovimiento | '';
  setTipo: (v: TipoMovimiento | '') => void;
  obraId: string;
  setObraId: (v: string) => void;
  categoriaId: string;
  setCategoriaId: (v: string) => void;
  beneficiarioId: string;
  setBeneficiarioId: (v: string) => void;
  q: string;
  setQ: (v: string) => void;
  onClose: () => void;
}) {
  const hayFiltro =
    cajaId || moneda !== 'TODAS' || tipo || obraId || categoriaId || beneficiarioId || q;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filtros</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
            <Label>Proveedor / origen</Label>
            <Combobox
              options={benes.map((b) => ({ value: b.id, label: b.nombre, hint: b.tipo }))}
              value={beneficiarioId}
              onChange={setBeneficiarioId}
              allLabel="Todos"
              searchPlaceholder="Buscar…"
            />
          </div>
          <div className="space-y-2">
            <Label>Buscar en descripción</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Texto libre…" />
          </div>
          {hayFiltro && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setCajaId('');
                setMoneda('TODAS');
                setTipo('');
                setObraId('');
                setCategoriaId('');
                setBeneficiarioId('');
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

function MovimientoRow({ m, onDetalle }: { m: Movimiento; onDetalle: () => void }) {
  const obras =
    m.imputaciones?.length
      ? m.imputaciones.map((i) => i.obra.nombre).join(', ')
      : null;
  return (
    <TableRow onClick={onDetalle} className="cursor-pointer hover:bg-muted/5 transition-colors">
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
    </TableRow>
  );
}

/**
 * Cards de saldo por caja distribuidas horizontalmente, ocupando todo el
 * banner (reunión Dani 26/11 v2). Grilla que se adapta a la cantidad de
 * cajas — con 1 ocupa todo el ancho, con 2 se parte al medio, con 3+ en
 * grid. Cards más altas y visuales que la v1 compacta.
 */
function SaldosCajasCompacto({
  cajas,
  saldos,
}: {
  cajas: Array<{ id: string; nombre: string; moneda: 'ARS' | 'USD' }>;
  saldos: Array<{ cajaId: string; saldo: string | number; moneda: string }>;
}) {
  const porCaja = new Map(saldos.map((s) => [s.cajaId, Number(s.saldo)]));

  if (cajas.length === 0) {
    return (
      <div className="rounded-lg bg-white/[0.06] border border-white/10 p-3 text-xs text-white/60">
        No hay cajas cargadas. Creá una desde Herramientas → Cuentas.
      </div>
    );
  }

  // Grilla responsiva que se adapta a la cantidad de cajas.
  // Con pocas cajas (1-3) usa columnas iguales. Con muchas, wrap en grid.
  const n = cajas.length;
  const colsClass =
    n === 1
      ? 'grid-cols-1'
      : n === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : n === 3
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid ${colsClass} gap-3`}>
      {cajas.map((c) => {
        const saldo = porCaja.get(c.id) ?? 0;
        const neg = saldo < 0;
        const simbolo = c.moneda === 'USD' ? 'US$' : '$';
        const nfmt = saldo.toLocaleString('es-AR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        return (
          <div
            key={c.id}
            className="min-w-0 rounded-xl bg-white/[0.08] border border-white/15 px-4 py-3 backdrop-blur-sm shadow-sm"
          >
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/70 truncate">
              {c.nombre}
            </div>
            <div
              className={`mt-1 flex items-baseline gap-1.5 min-w-0 ${neg ? 'text-red-300' : 'text-white'}`}
            >
              <span className="text-sm text-white/55 shrink-0">{simbolo}</span>
              <div className="flex-1 min-w-0">
                <FitText className="font-bold" maxSize={32} minSize={14}>
                  {nfmt}
                </FitText>
              </div>
            </div>
          </div>
        );
      })}
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
