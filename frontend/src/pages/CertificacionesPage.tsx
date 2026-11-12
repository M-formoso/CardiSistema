import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Plus, ExternalLink, Search, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  liquidacionesService,
  type EstadoLiquidacion,
  type ConceptoInput,
} from '@/services/liquidacionesService';
import { empleadosService, type Empleado } from '@/services/empleadosService';
import { obrasService } from '@/services/obrasService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

const ESTADO_VARIANTE: Record<EstadoLiquidacion, 'default' | 'success' | 'warning' | 'muted'> = {
  BORRADOR: 'muted',
  APROBADA: 'warning',
  PAGADA_PARCIAL: 'warning',
  PAGADA: 'success',
  CERRADA: 'default',
};

const ESTADO_LABEL: Record<EstadoLiquidacion, string> = {
  BORRADOR: 'Borrador',
  APROBADA: 'Aprobada',
  PAGADA_PARCIAL: 'Pagada parcial',
  PAGADA: 'Pagada',
  CERRADA: 'Cerrada',
};

/**
 * Sección Certificaciones — flujo principal para pagarle a la gente.
 * Internamente son LiquidacionesSemanales: una obra + una semana + varios
 * recibos (uno por empleado). Al crear, se arman los recibos con jornal
 * autocargado del legajo de cada empleado × días trabajados.
 */
export function CertificacionesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filtroObra, setFiltroObra] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoLiquidacion | ''>('');

  const { data: obras = [] } = useQuery({
    queryKey: ['obras', { activo: true }],
    queryFn: () => obrasService.list({ activo: true }),
  });

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['certificaciones', { filtroObra, filtroEstado }],
    queryFn: () =>
      liquidacionesService.list({
        obraId: filtroObra || undefined,
        estado: filtroEstado || undefined,
      }),
  });

  const obrasOpts = useMemo(
    () => obras.map((o) => ({ value: o.id, label: o.nombre })),
    [obras],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Certificaciones</h1>
          <p className="text-sm text-muted">
            Pagos por obra y semana. Elegís los empleados que trabajaron, cargás los días, el
            sistema calcula el total y genera el recibo imprimible.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nueva certificación
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-w-3xl">
        <Combobox
          options={obrasOpts}
          value={filtroObra}
          onChange={setFiltroObra}
          allLabel="Todas las obras"
          placeholder="Todas las obras"
        />
        <Combobox
          options={(Object.keys(ESTADO_LABEL) as EstadoLiquidacion[]).map((e) => ({
            value: e,
            label: ESTADO_LABEL[e],
          }))}
          value={filtroEstado}
          onChange={(v) => setFiltroEstado(v as EstadoLiquidacion | '')}
          allLabel="Todos los estados"
          placeholder="Todos los estados"
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semana</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Personas</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted py-8">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted py-10">
                  <p className="mb-2">Sin certificaciones todavía.</p>
                  <p className="text-xs">Tocá "Nueva certificación" para armar la primera.</p>
                </TableCell>
              </TableRow>
            )}
            {list.map((l) => {
              const saldo = Number(l.totalAPagar) - Number(l.totalPagado);
              return (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="font-medium">
                      {formatearFecha(l.semanaInicio)} → {formatearFecha(l.semanaFin)}
                    </div>
                  </TableCell>
                  <TableCell>{l.obra?.nombre ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_VARIANTE[l.estado]}>{ESTADO_LABEL[l.estado]}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{l._count?.items ?? 0}</TableCell>
                  <TableCell className="num text-right">
                    {formatearMonto(l.totalAPagar, 'ARS')}
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatearMonto(l.totalPagado, 'ARS')}
                  </TableCell>
                  <TableCell className={`num text-right ${saldo > 0 ? 'text-warning' : ''}`}>
                    {formatearMonto(saldo, 'ARS')}
                  </TableCell>
                  <TableCell>
                    <Link to={`/liquidaciones/${l.id}`}>
                      <Button variant="outline" size="sm">
                        Abrir
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {open && (
        <NuevaCertificacionWizard
          obras={obras}
          onClose={() => setOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['certificaciones'] });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ================================================================
   Wizard "Nueva certificación"
   - Elegís obra + semana + empleados
   - Por cada empleado: días trabajados, hs extra, descripción
   - Subtotal por empleado se calcula automático (jornal × días + hs × valorHE)
   - Total general en vivo
   - Al crear: liquidación aprobada con recibos listos para pagar / imprimir
   ================================================================ */

type EmpleadoCargado = {
  empleadoId: string;
  nombre: string;
  jornal: number;
  valorHoraExtra: number;
  dias: string;
  horasExtras: string;
  descripcion: string;
};

function NuevaCertificacionWizard({
  obras,
  onClose,
  onCreated,
}: {
  obras: Array<{ id: string; nombre: string }>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const nav = useNavigate();
  const [obraId, setObraId] = useState('');
  const [semanaInicio, setSemanaInicio] = useState(() =>
    mondayOfWeek(new Date()).toISOString().slice(0, 10),
  );
  const [semanaFin, setSemanaFin] = useState(() => {
    const m = mondayOfWeek(new Date());
    m.setDate(m.getDate() + 6);
    return m.toISOString().slice(0, 10);
  });
  const [seleccionados, setSeleccionados] = useState<EmpleadoCargado[]>([]);
  const [busqueda, setBusqueda] = useState('');

  const { data: empleados = [] } = useQuery({
    queryKey: ['empleados', { activo: true }],
    queryFn: () => empleadosService.list({ activo: true }),
  });

  const empleadosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return empleados;
    return empleados.filter(
      (e) =>
        e.nombre.toLowerCase().includes(q) ||
        (e.legajo?.categoria?.nombre?.toLowerCase().includes(q) ?? false) ||
        (e.legajo?.empresa?.nombre?.toLowerCase().includes(q) ?? false),
    );
  }, [empleados, busqueda]);

  const total = useMemo(
    () =>
      seleccionados.reduce((acc, e) => {
        const d = Number(e.dias) || 0;
        const h = Number(e.horasExtras) || 0;
        return acc + d * e.jornal + h * e.valorHoraExtra;
      }, 0),
    [seleccionados],
  );

  const obrasOpts = useMemo(
    () => obras.map((o) => ({ value: o.id, label: o.nombre })),
    [obras],
  );

  const toggleEmpleado = (emp: Pick<Empleado, 'id' | 'nombre' | 'legajo'>) => {
    const esta = seleccionados.find((s) => s.empleadoId === emp.id);
    if (esta) {
      setSeleccionados((prev) => prev.filter((s) => s.empleadoId !== emp.id));
    } else {
      setSeleccionados((prev) => [
        ...prev,
        {
          empleadoId: emp.id,
          nombre: emp.nombre,
          jornal: Number(emp.legajo?.jornal ?? 0),
          valorHoraExtra: Number(emp.legajo?.valorHoraExtra ?? 0),
          dias: '5',
          horasExtras: '0',
          descripcion: '',
        },
      ]);
    }
  };

  const actualizarEmpleado = (empleadoId: string, patch: Partial<EmpleadoCargado>) => {
    setSeleccionados((prev) =>
      prev.map((s) => (s.empleadoId === empleadoId ? { ...s, ...patch } : s)),
    );
  };

  const quitarEmpleado = (empleadoId: string) =>
    setSeleccionados((prev) => prev.filter((s) => s.empleadoId !== empleadoId));

  const crear = useMutation({
    mutationFn: async () => {
      if (!obraId) throw new Error('Elegí una obra');
      if (seleccionados.length === 0) throw new Error('Elegí al menos un empleado');
      const sinDias = seleccionados.filter(
        (s) => (Number(s.dias) || 0) <= 0 && (Number(s.horasExtras) || 0) <= 0,
      );
      if (sinDias.length > 0) {
        throw new Error(
          `Cargá días o horas para: ${sinDias.map((s) => s.nombre).join(', ')}`,
        );
      }
      const liq = await liquidacionesService.create({
        semanaInicio,
        semanaFin,
        obraId,
      });
      for (const s of seleccionados) {
        const conceptos: ConceptoInput[] = [];
        const dias = Number(s.dias) || 0;
        const hs = Number(s.horasExtras) || 0;
        if (dias > 0) {
          conceptos.push({
            tipo: 'JORNAL',
            descripcion: `${dias} jornal${dias === 1 ? '' : 'es'} de la semana`,
            cantidad: dias,
            valorUnitario: s.jornal,
            monto: dias * s.jornal,
          });
        }
        if (hs > 0) {
          conceptos.push({
            tipo: 'HORAS_EXTRA',
            descripcion: `${hs} hora${hs === 1 ? '' : 's'} extra`,
            cantidad: hs,
            valorUnitario: s.valorHoraExtra,
            monto: hs * s.valorHoraExtra,
          });
        }
        if (s.descripcion.trim()) {
          conceptos.push({
            tipo: 'NOTA_SALDO',
            descripcion: s.descripcion.trim(),
            monto: 0,
          });
        }
        await liquidacionesService.upsertItem(liq.id, {
          beneficiarioId: s.empleadoId,
          nombreLibre: s.nombre,
          conceptos,
        });
      }
      await liquidacionesService.cambiarEstado(liq.id, 'APROBADA');
      return liq;
    },
    onSuccess: (liq) => {
      toast.success(
        `Certificación creada · ${seleccionados.length} persona(s) · Total ${formatearMonto(total, 'ARS')}`,
      );
      onCreated();
      nav(`/liquidaciones/${liq.id}`);
    },
    onError: (e) => {
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          (e as Error).message ??
          'No se pudo crear',
      );
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva certificación</DialogTitle>
          <DialogDescription>
            Elegí la obra, la semana y los empleados. El sistema calcula automáticamente el monto
            según el jornal de cada uno y los días trabajados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* 1. Obra + semana */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">1. Obra y semana</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Obra / proyecto *</Label>
                <Combobox
                  options={obrasOpts}
                  value={obraId}
                  onChange={setObraId}
                  placeholder="Elegí obra…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Desde *</Label>
                <Input
                  type="date"
                  value={semanaInicio}
                  onChange={(e) => setSemanaInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hasta *</Label>
                <Input
                  type="date"
                  value={semanaFin}
                  onChange={(e) => setSemanaFin(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* 2. Seleccionar empleados */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                2. Personas ({seleccionados.length} elegida{seleccionados.length === 1 ? '' : 's'})
              </h3>
            </div>
            <div className="border border-border rounded-md">
              <div className="relative border-b border-border">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, categoría o empresa…"
                  className="w-full pl-10 pr-3 py-2.5 text-sm bg-transparent focus:outline-none"
                />
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-border">
                {empleadosFiltrados.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted">
                    {empleados.length === 0
                      ? 'No hay empleados cargados. Importalos desde Empleados.'
                      : 'Sin coincidencias.'}
                  </div>
                )}
                {empleadosFiltrados.map((emp) => {
                  const marcado = seleccionados.some((s) => s.empleadoId === emp.id);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => toggleEmpleado(emp)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/5 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                            marcado ? 'bg-primary border-primary' : 'border-border'
                          }`}
                        >
                          {marcado && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{emp.nombre}</div>
                          <div className="text-xs text-muted truncate">
                            {emp.legajo?.categoria?.nombre ?? 'Sin categoría'}
                            {emp.legajo?.empresa ? ` · ${emp.legajo.empresa.nombre}` : ''}
                            {emp.legajo?.jornal
                              ? ` · ${formatearMonto(emp.legajo.jornal, 'ARS')}/día`
                              : ' · sin jornal cargado'}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 3. Detalle por empleado */}
          {seleccionados.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">3. Detalle por persona</h3>
              <div className="space-y-2">
                {seleccionados.map((s) => {
                  const d = Number(s.dias) || 0;
                  const h = Number(s.horasExtras) || 0;
                  const sub = d * s.jornal + h * s.valorHoraExtra;
                  return (
                    <div
                      key={s.empleadoId}
                      className="border border-border rounded-md p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm">{s.nombre}</div>
                        <button
                          type="button"
                          onClick={() => quitarEmpleado(s.empleadoId)}
                          className="text-muted hover:text-foreground"
                          aria-label="Quitar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                        <div className="space-y-1">
                          <Label className="text-xs">Jornal</Label>
                          <div className="num text-muted pt-2">
                            {formatearMonto(s.jornal, 'ARS')}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Días</Label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            max="7"
                            value={s.dias}
                            onChange={(e) =>
                              actualizarEmpleado(s.empleadoId, { dias: e.target.value })
                            }
                            className="num text-right"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Hs extra</Label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={s.horasExtras}
                            onChange={(e) =>
                              actualizarEmpleado(s.empleadoId, {
                                horasExtras: e.target.value,
                              })
                            }
                            className="num text-right"
                          />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs">Descripción (opcional)</Label>
                          <Input
                            value={s.descripcion}
                            onChange={(e) =>
                              actualizarEmpleado(s.empleadoId, { descripcion: e.target.value })
                            }
                            placeholder="Trabajo específico, notas…"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end text-sm pt-1 border-t border-border">
                        <div>
                          Subtotal:{' '}
                          <span className="font-semibold num">{formatearMonto(sub, 'ARS')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Total general */}
          {seleccionados.length > 0 && (
            <div className="rounded-md bg-primary/5 border border-primary/20 p-3 flex items-center justify-between">
              <div className="text-sm text-muted">
                {seleccionados.length} persona{seleccionados.length === 1 ? '' : 's'} ·{' '}
                {obraId ? obras.find((o) => o.id === obraId)?.nombre : 'sin obra'}
              </div>
              <div className="text-lg">
                Total a pagar:{' '}
                <span className="font-bold num text-primary">
                  {formatearMonto(total, 'ARS')}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => crear.mutate()}
            disabled={crear.isPending || !obraId || seleccionados.length === 0}
          >
            {crear.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Crear certificación'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function mondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
