import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, TrendingUp, Trash2, ChevronLeft } from 'lucide-react';
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

/**
 * Modal con CRUD completo de categorías de empleado.
 * - Lista con jornal actual + cantidad de empleados por categoría.
 * - Alta: código + nombre + jornal + hora extra.
 * - Edición: código, nombre, orden.
 * - Actualización masiva de jornal (propaga a empleados de la categoría).
 * - Desactivar.
 *
 * Internamente navega entre "lista" y "form" dentro del mismo dialog
 * para no abrir dialogs apilados.
 */
export function GestionCategoriasDialog({
  onClose,
  onCategoriaCreada,
}: {
  onClose: () => void;
  /** Se dispara cuando se crea una nueva categoría — útil para refrescar selectores en el padre. */
  onCategoriaCreada?: (cat: CategoriaEmpleado) => void;
}) {
  const qc = useQueryClient();
  const [vista, setVista] = useState<
    | { tipo: 'lista' }
    | { tipo: 'form'; categoria?: CategoriaEmpleado }
    | { tipo: 'jornal'; categoria: CategoriaEmpleado }
  >({ tipo: 'lista' });

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
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        {vista.tipo === 'lista' && (
          <>
            <DialogHeader>
              <DialogTitle>Categorías de empleado</DialogTitle>
              <DialogDescription>
                Oficial Capataz, Oficial, 1/2 Oficial, Ayudante… Cambiar el jornal de una
                categoría se puede propagar automáticamente a todos sus empleados.
              </DialogDescription>
            </DialogHeader>

            <div className="flex justify-end">
              <Button size="sm" onClick={() => setVista({ tipo: 'form' })}>
                <Plus className="h-4 w-4 mr-1" />
                Nueva categoría
              </Button>
            </div>

            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Jornal</TableHead>
                    <TableHead className="text-right">Hora extra</TableHead>
                    <TableHead className="text-center">Empleados</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted py-6">
                        <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                        Cargando…
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && list.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted py-6">
                        Sin categorías. Creá la primera.
                      </TableCell>
                    </TableRow>
                  )}
                  {list.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                      <TableCell className="font-medium">
                        {c.nombre}
                        {!c.activo && (
                          <Badge variant="muted" className="ml-2 text-xs">
                            Inactiva
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="num text-right whitespace-nowrap">
                        {c.jornal ? formatearMonto(c.jornal, 'ARS') : '—'}
                      </TableCell>
                      <TableCell className="num text-right text-xs whitespace-nowrap">
                        {c.valorHoraExtra ? formatearMonto(c.valorHoraExtra, 'ARS') : '—'}
                      </TableCell>
                      <TableCell className="text-center">{c._count?.empleados ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setVista({ tipo: 'jornal', categoria: c })}
                            title="Actualizar jornal (propaga a empleados)"
                          >
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Jornal
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setVista({ tipo: 'form', categoria: c })}
                          >
                            Editar
                          </Button>
                          {c.activo && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`¿Desactivar "${c.nombre}"?`))
                                  desactivarMut.mutate(c.id);
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

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        )}

        {vista.tipo === 'form' && (
          <FormCategoria
            categoria={vista.categoria}
            onBack={() => setVista({ tipo: 'lista' })}
            onSaved={(creada) => {
              qc.invalidateQueries({ queryKey: ['categorias-empleados'] });
              if (creada && onCategoriaCreada) onCategoriaCreada(creada);
              setVista({ tipo: 'lista' });
            }}
          />
        )}

        {vista.tipo === 'jornal' && (
          <FormActualizarJornal
            categoria={vista.categoria}
            onBack={() => setVista({ tipo: 'lista' })}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ['categorias-empleados'] });
              qc.invalidateQueries({ queryKey: ['empleados'] });
              setVista({ tipo: 'lista' });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormCategoria({
  categoria,
  onBack,
  onSaved,
}: {
  categoria?: CategoriaEmpleado;
  onBack: () => void;
  onSaved: (creada?: CategoriaEmpleado) => void;
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
    onSuccess: (cat) => {
      toast.success(categoria ? 'Categoría actualizada' : 'Categoría creada');
      onSaved(categoria ? undefined : (cat as CategoriaEmpleado));
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo guardar',
      ),
  });

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <DialogTitle>{categoria ? 'Editar' : 'Nueva'} categoría</DialogTitle>
        </div>
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
                placeholder="50000"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor hora extra</Label>
              <Input
                type="number"
                step="0.01"
                value={horaExtra}
                onChange={(e) => setHoraExtra(e.target.value)}
                placeholder={jornal ? ((Number(jornal) / 8) * 1.5).toFixed(2) : ''}
              />
            </div>
          </div>
        )}
        {categoria && (
          <p className="text-xs text-muted">
            Para cambiar el jornal usá el botón "Jornal" de la lista (propaga a los empleados).
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onBack}>
            Volver
          </Button>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function FormActualizarJornal({
  categoria,
  onBack,
  onSaved,
}: {
  categoria: CategoriaEmpleado;
  onBack: () => void;
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
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <DialogTitle>Actualizar jornal de "{categoria.nombre}"</DialogTitle>
        </div>
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
              <p className="text-xs text-muted">
                Anterior: {formatearMonto(categoria.jornal, 'ARS')}
              </p>
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
            <p className="text-xs text-muted">
              Sugerido: {((Number(jornal) / 8) * 1.5 || 0).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Motivo</Label>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Paritarias, ajuste noviembre…"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={propagarATodos}
            onChange={(e) => setPropagarATodos(e.target.checked)}
          />
          Propagar a TODOS los empleados de la categoría (incluso con jornal propio distinto)
        </label>
        {!propagarATodos && (
          <p className="text-xs text-muted">
            Por defecto, solo se actualizan los empleados cuyo jornal coincidía con el anterior
            de la categoría. Los que tenían un valor propio diferente quedan como estaban.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onBack}>
            Volver
          </Button>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Actualizar y propagar'
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
