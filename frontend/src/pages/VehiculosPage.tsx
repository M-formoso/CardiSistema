import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Search, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { vehiculosService } from '@/services/vehiculosService';
import { formatearMonto } from '@/lib/formatters';

/**
 * Lista de vehículos (reunión Dani 18/11). Cada uno con su gasto total
 * acumulado (seguro, patentes, mecánica, etc). Click en una fila → detalle.
 */
export function VehiculosPage() {
  const [q, setQ] = useState('');
  const [nuevoOpen, setNuevoOpen] = useState(false);

  const { data: vehiculos = [], isLoading } = useQuery({
    queryKey: ['vehiculos', { q }],
    queryFn: () => vehiculosService.list({ q: q.trim() || undefined }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Car className="h-6 w-6" /> Vehículos
          </h1>
          <p className="text-sm text-muted">
            Gastos por vehículo: seguro, patentes, rentas, mecánica. Los pagos se imputan desde el
            egreso cuando la categoría de servicio está vinculada a vehículos.
          </p>
        </div>
        <Button onClick={() => setNuevoOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nuevo vehículo
        </Button>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, patente o modelo…"
          className="pl-10 max-w-sm"
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehículo</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Patente</TableHead>
              <TableHead className="text-right">Gasto total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted py-8">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && vehiculos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted py-10 text-sm">
                  {q
                    ? 'Sin coincidencias.'
                    : 'Todavía no cargaste ningún vehículo. Usá "Nuevo vehículo" para empezar.'}
                </TableCell>
              </TableRow>
            )}
            {vehiculos.map((v) => (
              <TableRow key={v.id} className="hover:bg-muted/5">
                <TableCell>
                  <Link to={`/vehiculos/${v.id}`} className="font-medium hover:underline">
                    {v.nombre}
                  </Link>
                  {!v.activo && (
                    <Badge variant="muted" className="ml-2 text-[10px]">
                      INACTIVO
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted">{v.modelo ?? '—'}</TableCell>
                <TableCell className="text-xs font-mono">{v.patente}</TableCell>
                <TableCell className="text-right num font-semibold">
                  {formatearMonto(v.gastoTotal ?? '0', 'ARS')}
                </TableCell>
                <TableCell>
                  <Link to={`/vehiculos/${v.id}`}>
                    <Button variant="outline" size="sm">
                      Ver detalle
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {nuevoOpen && <NuevoVehiculoDialog onClose={() => setNuevoOpen(false)} />}
    </div>
  );
}

function NuevoVehiculoDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [modelo, setModelo] = useState('');
  const [patente, setPatente] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const m = useMutation({
    mutationFn: () =>
      vehiculosService.create({
        nombre: nombre.trim(),
        modelo: modelo.trim() || undefined,
        patente: patente.trim(),
        observaciones: observaciones.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Vehículo creado');
      qc.invalidateQueries({ queryKey: ['vehiculos'] });
      onClose();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo crear',
      ),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo vehículo</DialogTitle>
          <DialogDescription>Cargá nombre, modelo y patente del vehículo.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nombre.trim() || !patente.trim())
              return toast.error('Nombre y patente son obligatorios');
            m.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              autoFocus
              placeholder="Toyota Hilux Dani"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Input
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="2020"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Patente *</Label>
              <Input
                value={patente}
                onChange={(e) => setPatente(e.target.value.toUpperCase())}
                required
                placeholder="AB123CD"
                className="uppercase"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observaciones</Label>
            <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear vehículo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
