import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Plus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
} from '@/services/liquidacionesService';
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

export function LiquidacionesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filtroObra, setFiltroObra] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoLiquidacion | ''>('');

  const { data: obras = [] } = useQuery({
    queryKey: ['obras', { activo: true }],
    queryFn: () => obrasService.list({ activo: true }),
  });

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['liquidaciones', { filtroObra, filtroEstado }],
    queryFn: () =>
      liquidacionesService.list({
        obraId: filtroObra || undefined,
        estado: filtroEstado || undefined,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Liquidaciones semanales</h1>
          <p className="text-sm text-muted">
            Una liquidación por obra y semana. Cargá los recibos y pagá total o en partes.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nueva liquidación
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select
          className="max-w-xs"
          value={filtroObra}
          onChange={(e) => setFiltroObra(e.target.value)}
        >
          <option value="">Todas las obras</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </Select>
        <Select
          className="max-w-xs"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as EstadoLiquidacion | '')}
        >
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADO_LABEL) as EstadoLiquidacion[]).map((e) => (
            <option key={e} value={e}>
              {ESTADO_LABEL[e]}
            </option>
          ))}
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semana</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Recibos</TableHead>
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
                <TableCell colSpan={8} className="text-center text-muted py-8">
                  Sin liquidaciones con esos filtros. Creá una nueva.
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

      <NuevaLiquidacionDialog
        open={open}
        onOpenChange={setOpen}
        obras={obras}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['liquidaciones'] });
          setOpen(false);
        }}
      />
    </div>
  );
}

function NuevaLiquidacionDialog({
  open,
  onOpenChange,
  obras,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obras: Array<{ id: string; nombre: string }>;
  onCreated: () => void;
}) {
  const [inicio, setInicio] = useState(() => mondayOfWeek(new Date()).toISOString().slice(0, 10));
  const [fin, setFin] = useState(() => {
    const m = mondayOfWeek(new Date());
    m.setDate(m.getDate() + 6);
    return m.toISOString().slice(0, 10);
  });
  const [obraId, setObraId] = useState('');

  const m = useMutation({
    mutationFn: () =>
      liquidacionesService.create({
        semanaInicio: inicio,
        semanaFin: fin,
        obraId,
      }),
    onSuccess: () => {
      toast.success('Liquidación creada en BORRADOR. Agregá los recibos.');
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva liquidación</DialogTitle>
          <DialogDescription>
            Una obra por liquidación. Después agregás un recibo por cada persona.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!obraId) return toast.error('Elegí una obra');
            if (new Date(fin) < new Date(inicio))
              return toast.error('La fecha fin debe ser mayor o igual a la de inicio');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Desde *</Label>
              <Input
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Hasta *</Label>
              <Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Obra *</Label>
            <Select value={obraId} onChange={(e) => setObraId(e.target.value)} required>
              <option value="">Elegí…</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
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

function mondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
