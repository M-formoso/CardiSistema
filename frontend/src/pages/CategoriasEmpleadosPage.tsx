import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, TrendingUp, Trash2 } from 'lucide-react';
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
  categoriasEmpleadosService,
  type CategoriaEmpleado,
} from '@/services/categoriasEmpleadosService';
import { formatearMonto } from '@/lib/formatters';

export function CategoriasEmpleadosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<CategoriaEmpleado | null>(null);
  const [actualizarJornal, setActualizarJornal] = useState<CategoriaEmpleado | null>(null);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['categorias-empleados'],
    queryFn: () => categoriasEmpleadosService.list(),
  });

  const desactivarMut = useMutation({
    mutationFn: (id: string) => categoriasEmpleadosService.desactivar(id),
    onSuccess: () => {
      toast.success('Categoría desactivada');
      qc.invalidateQueries({ queryKey: ['categorias-empleados'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Categorías de empleado</h2>
          <p className="text-sm text-muted">
            Oficial Capataz, Oficial, Medio Oficial, Ayudante, etc. Editar el jornal de una
            categoría se propaga a todos sus empleados.
          </p>
        </div>
        <Button onClick={() => { setEditando(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Nueva
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Jornal</TableHead>
              <TableHead className="text-right">Hora extra</TableHead>
              <TableHead className="text-center">Empleados</TableHead>
              <TableHead>Estado</TableHead>
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
            {!isLoading && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted py-8">
                  Sin categorías.
                </TableCell>
              </TableRow>
            )}
            {list.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                <TableCell className="font-medium">{c.nombre}</TableCell>
                <TableCell className="num text-right">
                  {c.jornal ? formatearMonto(c.jornal, 'ARS') : '—'}
                </TableCell>
                <TableCell className="num text-right text-xs">
                  {c.valorHoraExtra ? formatearMonto(c.valorHoraExtra, 'ARS') : '—'}
                </TableCell>
                <TableCell className="text-center">{c._count?.empleados ?? 0}</TableCell>
                <TableCell>
                  <Badge variant={c.activo ? 'success' : 'muted'}>
                    {c.activo ? 'Activa' : 'Inactiva'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActualizarJornal(c)}
                      title="Actualizar jornal (propaga a empleados)"
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Jornal
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditando(c); setOpen(true); }}
                    >
                      Editar
                    </Button>
                    {c.activo && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`¿Desactivar "${c.nombre}"?`)) desactivarMut.mutate(c.id);
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
      </div>

      {open && (
        <CategoriaDialog
          categoria={editando ?? undefined}
          onClose={() => setOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['categorias-empleados'] });
            setOpen(false);
          }}
        />
      )}

      {actualizarJornal && (
        <ActualizarJornalDialog
          categoria={actualizarJornal}
          onClose={() => setActualizarJornal(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['categorias-empleados'] });
            setActualizarJornal(null);
          }}
        />
      )}
    </div>
  );
}

function CategoriaDialog({
  categoria,
  onClose,
  onSaved,
}: {
  categoria?: CategoriaEmpleado;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [codigo, setCodigo] = useState(categoria?.codigo ?? '');
  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [jornal, setJornal] = useState(categoria?.jornal ?? '');
  const [horaExtra, setHoraExtra] = useState(categoria?.valorHoraExtra ?? '');

  const m = useMutation({
    mutationFn: () =>
      categoria
        ? categoriasEmpleadosService.update(categoria.id, {
            codigo: codigo.trim(),
            nombre: nombre.trim(),
          })
        : categoriasEmpleadosService.create({
            codigo: codigo.trim(),
            nombre: nombre.trim(),
            jornal: jornal ? Number(jornal) : undefined,
            valorHoraExtra: horaExtra ? Number(horaExtra) : undefined,
          }),
    onSuccess: () => {
      toast.success(categoria ? 'Categoría actualizada' : 'Categoría creada');
      onSaved();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo guardar',
      ),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{categoria ? 'Editar' : 'Nueva'} categoría</DialogTitle>
          {categoria && (
            <DialogDescription>
              Para cambiar el jornal usá "Actualizar jornal" (propaga a los empleados).
            </DialogDescription>
          )}
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!codigo.trim() || !nombre.trim())
              return toast.error('Código y nombre son obligatorios');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="OF_CAP"
                required
                disabled={!!categoria}
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Oficial Capataz"
                required
              />
            </div>
          </div>
          {!categoria && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Jornal inicial</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={jornal}
                  onChange={(e) => setJornal(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor hora extra</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={horaExtra}
                  onChange={(e) => setHoraExtra(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActualizarJornalDialog({
  categoria,
  onClose,
  onSaved,
}: {
  categoria: CategoriaEmpleado;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [jornal, setJornal] = useState(categoria.jornal ?? '');
  const [horaExtra, setHoraExtra] = useState(categoria.valorHoraExtra ?? '');
  const [motivo, setMotivo] = useState('');
  const [propagarATodos, setPropagarATodos] = useState(false);

  const m = useMutation({
    mutationFn: () =>
      categoriasEmpleadosService.actualizarJornal(categoria.id, {
        jornal: Number(jornal),
        valorHoraExtra: horaExtra ? Number(horaExtra) : undefined,
        motivo: motivo.trim() || undefined,
        propagarATodos,
      }),
    onSuccess: (res) => {
      toast.success(
        `Jornal actualizado · ${res.empleadosAfectados}/${res.total} empleado(s) afectado(s)`,
      );
      onSaved();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo actualizar',
      ),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Actualizar jornal de "{categoria.nombre}"</DialogTitle>
          <DialogDescription>
            Cambia el jornal de la categoría y lo propaga a los empleados activos. Queda en el
            historial de la categoría y de cada empleado.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!jornal || Number(jornal) <= 0) return toast.error('Jornal inválido');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nuevo jornal *</Label>
              <Input
                type="number"
                step="0.01"
                value={jornal}
                onChange={(e) => setJornal(e.target.value)}
                required
              />
              {categoria.jornal && (
                <p className="text-xs text-muted">Anterior: {formatearMonto(categoria.jornal, 'ARS')}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Valor hora extra</Label>
              <Input
                type="number"
                step="0.01"
                value={horaExtra}
                onChange={(e) => setHoraExtra(e.target.value)}
              />
              <p className="text-xs text-muted">Sugerido: {(Number(jornal) / 8 * 1.5 || 0).toFixed(2)}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ajuste noviembre 2026, paritarias…"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={propagarATodos}
              onChange={(e) => setPropagarATodos(e.target.checked)}
            />
            Propagar a TODOS los empleados de la categoría (incluso los que tenían jornal propio distinto)
          </label>
          {!propagarATodos && (
            <p className="text-xs text-muted">
              Por defecto, solo se actualizan los empleados cuyo jornal coincidía con el anterior
              de la categoría. Los que tenían un valor propio diferente quedan como estaban.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar y propagar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
