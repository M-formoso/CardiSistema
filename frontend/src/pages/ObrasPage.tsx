import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
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
import { obrasService, type Obra } from '@/services/obrasService';
import { formatearMonto } from '@/lib/formatters';

const estadoVariante: Record<Obra['estado'], 'default' | 'success' | 'warning' | 'muted'> = {
  ACTIVA: 'success',
  EN_LICITACION: 'warning',
  PAUSADA: 'muted',
  TERMINADA: 'muted',
};

export function ObrasPage() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['obras', { q }],
    queryFn: () => obrasService.list({ q: q || undefined }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Obras</h1>
          <p className="text-sm text-muted">Obras y unidades de negocio.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nueva obra
        </Button>
      </div>

      <Input
        placeholder="Buscar por nombre…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Contratado</TableHead>
              <TableHead>Comitente</TableHead>
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
            {!isLoading && obras.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted py-8">
                  Sin obras.
                </TableCell>
              </TableRow>
            )}
            {obras.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.nombre}</TableCell>
                <TableCell>
                  <Badge variant="muted">{o.tipo}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={estadoVariante[o.estado]}>{o.estado}</Badge>
                </TableCell>
                <TableCell className="num">
                  {o.montoContratado && o.monedaContrato
                    ? formatearMonto(o.montoContratado, o.monedaContrato)
                    : '—'}
                </TableCell>
                <TableCell className="text-muted">{o.comitente ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NuevaObraDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['obras'] });
          setOpen(false);
        }}
      />
    </div>
  );
}

function NuevaObraDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<Obra['tipo']>('OBRA');
  const [estado, setEstado] = useState<Obra['estado']>('ACTIVA');
  const [comitente, setComitente] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [montoContratado, setMontoContratado] = useState('');
  const [monedaContrato, setMonedaContrato] = useState<'ARS' | 'USD'>('ARS');

  const m = useMutation({
    mutationFn: () =>
      obrasService.create({
        nombre: nombre.trim(),
        tipo,
        estado,
        comitente: comitente.trim() || undefined,
        ubicacion: ubicacion.trim() || undefined,
        montoContratado: montoContratado ? Number(montoContratado) : undefined,
        monedaContrato: montoContratado ? monedaContrato : undefined,
      }),
    onSuccess: () => {
      toast.success('Obra creada');
      setNombre('');
      setComitente('');
      setUbicacion('');
      setMontoContratado('');
      onCreated();
    },
    onError: (err) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo crear la obra';
      toast.error(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva obra</DialogTitle>
          <DialogDescription>Cargá los datos básicos — se pueden editar después.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nombre.trim()) return toast.error('El nombre es obligatorio');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: General Paz"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as Obra['tipo'])}>
                <option value="OBRA">Obra</option>
                <option value="UNIDAD_NEGOCIO">Unidad de negocio</option>
                <option value="GENERAL">General (gastos)</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={estado}
                onChange={(e) => setEstado(e.target.value as Obra['estado'])}
              >
                <option value="ACTIVA">Activa</option>
                <option value="EN_LICITACION">En licitación</option>
                <option value="PAUSADA">Pausada</option>
                <option value="TERMINADA">Terminada</option>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Comitente</Label>
            <Input value={comitente} onChange={(e) => setComitente(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Ubicación</Label>
            <Input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Monto contratado</Label>
              <Input
                type="number"
                step="0.01"
                value={montoContratado}
                onChange={(e) => setMontoContratado(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select
                value={monedaContrato}
                onChange={(e) => setMonedaContrato(e.target.value as 'ARS' | 'USD')}
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </Select>
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
