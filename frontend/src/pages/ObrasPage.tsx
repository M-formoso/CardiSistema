import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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
import { usePagination } from '@/lib/usePagination';
import { Pagination } from '@/components/ui/pagination';

const estadoVariante: Record<Obra['estado'], 'default' | 'success' | 'warning' | 'muted'> = {
  ACTIVA: 'success',
  EN_LICITACION: 'warning',
  PAUSADA: 'muted',
  TERMINADA: 'muted',
};

const estadoLabel: Record<Obra['estado'], string> = {
  ACTIVA: 'Activa',
  EN_LICITACION: 'En licitación',
  PAUSADA: 'Pausada',
  TERMINADA: 'Terminada',
};

const tipoLabel: Record<Obra['tipo'], string> = {
  OBRA: 'Obra',
  UNIDAD_NEGOCIO: 'Unidad de negocio',
  GENERAL: 'General',
};

export function ObrasPage() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Obra | null>(null);
  const qc = useQueryClient();
  const { data: obrasRaw = [], isLoading } = useQuery({
    queryKey: ['obras', { q }],
    queryFn: () => obrasService.list({ q: q || undefined }),
  });
  const { paginados: obras, total, page, pageSize, setPage, setPageSize } =
    usePagination(obrasRaw, 25);

  const desactivarMut = useMutation({
    mutationFn: (id: string) => obrasService.desactivar(id),
    onSuccess: () => {
      toast.success('Obra desactivada');
      qc.invalidateQueries({ queryKey: ['obras'] });
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo desactivar',
      ),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Obras</h1>
          <p className="text-sm text-muted">Obras y unidades de negocio.</p>
        </div>
        <Button
          onClick={() => {
            setEditando(null);
            setOpen(true);
          }}
        >
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
        <Pagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          className="border-b border-border"
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Contratado</TableHead>
              <TableHead>Comitente</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted py-8">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && obras.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted py-8">
                  Sin obras.
                </TableCell>
              </TableRow>
            )}
            {obras.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">
                  {o.nombre}
                  {!o.activo && (
                    <Badge variant="muted" className="ml-2 text-xs">
                      Inactiva
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="muted">{tipoLabel[o.tipo]}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={estadoVariante[o.estado]}>{estadoLabel[o.estado]}</Badge>
                </TableCell>
                <TableCell className="num text-right">
                  {o.montoContratado && o.monedaContrato
                    ? formatearMonto(o.montoContratado, o.monedaContrato)
                    : '—'}
                </TableCell>
                <TableCell className="text-muted">{o.comitente ?? '—'}</TableCell>
                <TableCell className="text-muted">{o.ubicacion ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditando(o);
                        setOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    {o.activo && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (
                            confirm(
                              `¿Desactivar "${o.nombre}"? Queda oculta en los selectores pero no se pierde el historial.`,
                            )
                          )
                            desactivarMut.mutate(o.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {total > pageSize && (
          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            className="border-t border-border"
          />
        )}
      </div>

      {open && (
        <ObraDialog
          obra={editando ?? undefined}
          onClose={() => setOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['obras'] });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ObraDialog({
  obra,
  onClose,
  onSaved,
}: {
  obra?: Obra;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(obra?.nombre ?? '');
  const [tipo, setTipo] = useState<Obra['tipo']>(obra?.tipo ?? 'OBRA');
  const [estado, setEstado] = useState<Obra['estado']>(obra?.estado ?? 'ACTIVA');
  const [comitente, setComitente] = useState(obra?.comitente ?? '');
  const [ubicacion, setUbicacion] = useState(obra?.ubicacion ?? '');
  const [montoContratado, setMontoContratado] = useState(obra?.montoContratado ?? '');
  const [monedaContrato, setMonedaContrato] = useState<'ARS' | 'USD'>(
    (obra?.monedaContrato as 'ARS' | 'USD') ?? 'ARS',
  );

  const m = useMutation({
    mutationFn: () => {
      const payload = {
        nombre: nombre.trim(),
        tipo,
        estado,
        comitente: comitente.trim() || undefined,
        ubicacion: ubicacion.trim() || undefined,
        montoContratado: montoContratado ? Number(montoContratado) : undefined,
        monedaContrato: montoContratado ? monedaContrato : undefined,
      };
      return obra ? obrasService.update(obra.id, payload) : obrasService.create(payload);
    },
    onSuccess: () => {
      toast.success(obra ? 'Obra actualizada' : 'Obra creada');
      onSaved();
    },
    onError: (err) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo guardar la obra';
      toast.error(msg);
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{obra ? `Editar "${obra.nombre}"` : 'Nueva obra'}</DialogTitle>
          <DialogDescription>
            {obra
              ? 'Podés cambiar el nombre, estado, comitente, ubicación y monto contratado.'
              : 'Cargá los datos básicos — se pueden editar después.'}
          </DialogDescription>
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
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : obra ? (
                'Guardar cambios'
              ) : (
                'Crear'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
