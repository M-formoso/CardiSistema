import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Plus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { formatearFecha, formatearMonto } from '@/lib/formatters';

const ESTADO_VARIANTE: Record<EstadoLiquidacion, 'default' | 'success' | 'warning' | 'muted'> = {
  BORRADOR: 'muted',
  APROBADA: 'warning',
  PAGADA: 'success',
  CERRADA: 'default',
};

export function LiquidacionesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: list = [], isLoading } = useQuery({
    queryKey: ['liquidaciones'],
    queryFn: () => liquidacionesService.list(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Liquidaciones semanales</h1>
          <p className="text-sm text-muted">
            Una semana a la vez: cargá los días por empleado y pagá en un solo paso.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nueva semana
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semana</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Empleados</TableHead>
              <TableHead>Total bruto</TableHead>
              <TableHead>Pagado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted py-8">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted py-8">
                  Sin liquidaciones. Creá la primera semana.
                </TableCell>
              </TableRow>
            )}
            {list.map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  <div className="font-medium">
                    {formatearFecha(l.semanaInicio)} → {formatearFecha(l.semanaFin)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANTE[l.estado]}>{l.estado}</Badge>
                </TableCell>
                <TableCell className="text-center">{l._count?.items ?? 0}</TableCell>
                <TableCell className="num">{formatearMonto(l.totalBruto, 'ARS')}</TableCell>
                <TableCell className="num">{formatearMonto(l.totalPagado, 'ARS')}</TableCell>
                <TableCell>
                  <Link to={`/liquidaciones/${l.id}`}>
                    <Button variant="outline" size="sm">
                      Abrir
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NuevaLiquidacionDialog
        open={open}
        onOpenChange={setOpen}
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
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [inicio, setInicio] = useState(() => mondayOfWeek(new Date()).toISOString().slice(0, 10));
  const [fin, setFin] = useState(() => {
    const m = mondayOfWeek(new Date());
    m.setDate(m.getDate() + 6);
    return m.toISOString().slice(0, 10);
  });

  const m = useMutation({
    mutationFn: () =>
      liquidacionesService.create({
        semanaInicio: inicio,
        semanaFin: fin,
      }),
    onSuccess: () => {
      toast.success('Liquidación creada en BORRADOR');
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
          <DialogTitle>Nueva semana de liquidación</DialogTitle>
          <DialogDescription>
            Rango sugerido: lunes a domingo. Después agregás los empleados con sus días por obra.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
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
