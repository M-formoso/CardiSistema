import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Car, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { categoriasService, type Categoria, type TipoCategoria } from '@/services/categoriasService';
import { usePagination } from '@/lib/usePagination';
import { Pagination } from '@/components/ui/pagination';

const TIPO_LABEL: Record<TipoCategoria, string> = {
  SERVICIO: 'Servicio',
  PROVEEDOR: 'Proveedor',
  GENERAL: 'General',
  EMPLEADO: 'Empleado',
  INGRESO: 'Ingreso',
};

const TIPO_OPTS = [
  { value: 'SERVICIO', label: 'Servicio', hint: 'EPEC, Rentas, Seguros…' },
  { value: 'PROVEEDOR', label: 'Proveedor', hint: 'Casa Santos, Prolectric…' },
  { value: 'GENERAL', label: 'General', hint: 'Gastos generales' },
  { value: 'EMPLEADO', label: 'Empleado', hint: 'Jornales, préstamos' },
  { value: 'INGRESO', label: 'Ingreso', hint: 'Solo para ingresos' },
];

export function CategoriasPage() {
  const [open, setOpen] = useState(false);
  const [verInactivas, setVerInactivas] = useState(false);
  const qc = useQueryClient();
  const { data: catsRaw = [], isLoading } = useQuery({
    queryKey: ['categorias', { soloActivas: !verInactivas }],
    queryFn: () => categoriasService.list(!verInactivas),
  });
  const { paginados: cats, total, page, pageSize, setPage, setPageSize } =
    usePagination(catsRaw, 25);

  const desactivarMut = useMutation({
    mutationFn: (id: string) => categoriasService.desactivar(id),
    onSuccess: () => {
      toast.success('Categoría eliminada (soft)');
      qc.invalidateQueries({ queryKey: ['categorias'] });
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo eliminar',
      ),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorías de gasto</h1>
          <p className="text-sm text-muted">
            Agrupan los movimientos en reportes. El tipo filtra qué categorías aparecen en
            cada flujo de egreso (Servicio / Proveedor / General).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={verInactivas}
              onChange={(e) => setVerInactivas(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Ver inactivas
          </label>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva categoría
          </Button>
        </div>
      </div>

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
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Vehículos</TableHead>
              <TableHead>Orden</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
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
            {!isLoading &&
              cats.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="muted">{TIPO_LABEL[c.tipo]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.vinculadaVehiculo ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Car className="h-3.5 w-3.5" /> Sí
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="num text-xs">{c.orden}</TableCell>
                  <TableCell>
                    <Badge variant={c.activo ? 'success' : 'muted'}>
                      {c.activo ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {c.activo && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Eliminar (se puede recuperar activándola de nuevo)"
                        onClick={() => {
                          if (
                            confirm(
                              `¿Eliminar la categoría "${c.nombre}"? Los movimientos históricos que la usen quedan intactos. Si querés recuperarla, tildá "Ver inactivas" arriba.`,
                            )
                          ) {
                            desactivarMut.mutate(c.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    )}
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

      <NuevaCategoriaDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['categorias'] });
          setOpen(false);
        }}
      />
    </div>
  );
}

function NuevaCategoriaDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [orden, setOrden] = useState('0');
  const [tipo, setTipo] = useState<Categoria['tipo']>('GENERAL');
  const [vinculadaVehiculo, setVinculadaVehiculo] = useState(false);

  const m = useMutation({
    mutationFn: () =>
      categoriasService.create({
        codigo: codigo.trim().toUpperCase(),
        nombre: nombre.trim(),
        orden: Number(orden),
        tipo,
        vinculadaVehiculo: tipo === 'SERVICIO' ? vinculadaVehiculo : false,
      }),
    onSuccess: () => {
      toast.success('Categoría creada');
      setCodigo('');
      setNombre('');
      setOrden('0');
      setTipo('GENERAL');
      setVinculadaVehiculo(false);
      onCreated();
    },
    onError: (err) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo crear';
      toast.error(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva categoría</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!codigo.trim() || !nombre.trim()) return toast.error('Código y nombre son obligatorios');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                placeholder="Ej: MAT, FLETE, PROF"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Combobox
                options={TIPO_OPTS}
                value={tipo}
                onChange={(v) => setTipo(v as Categoria['tipo'])}
                placeholder="Elegí tipo…"
                searchPlaceholder="Buscar…"
              />
            </div>
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
            </div>
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
