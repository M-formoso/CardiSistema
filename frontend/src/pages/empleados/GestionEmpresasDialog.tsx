import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ChevronLeft } from 'lucide-react';
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
import { empresasService, type Empresa } from '@/services/empresasService';

/**
 * Modal con CRUD completo de empresas (razones sociales a las que pertenecen
 * los empleados: Cardi, Picardi, etc.). Mismo patrón que GestionCategoriasDialog.
 */
export function GestionEmpresasDialog({
  onClose,
  onEmpresaCreada,
}: {
  onClose: () => void;
  onEmpresaCreada?: (empresa: Empresa) => void;
}) {
  const qc = useQueryClient();
  const [vista, setVista] = useState<
    { tipo: 'lista' } | { tipo: 'form'; empresa?: Empresa }
  >({ tipo: 'lista' });

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => empresasService.list(),
  });

  const desactivarMut = useMutation({
    mutationFn: (id: string) => empresasService.desactivar(id),
    onSuccess: () => {
      toast.success('Empresa desactivada');
      qc.invalidateQueries({ queryKey: ['empresas'] });
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        {vista.tipo === 'lista' && (
          <>
            <DialogHeader>
              <DialogTitle>Empresas</DialogTitle>
              <DialogDescription>
                Razones sociales a las que pertenecen los empleados (Cardi, Picardi, u otras).
              </DialogDescription>
            </DialogHeader>

            <div className="flex justify-end">
              <Button size="sm" onClick={() => setVista({ tipo: 'form' })}>
                <Plus className="h-4 w-4 mr-1" />
                Nueva empresa
              </Button>
            </div>

            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead className="text-center">Empleados</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted py-6">
                        <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                        Cargando…
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && list.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted py-6">
                        Sin empresas. Creá la primera.
                      </TableCell>
                    </TableRow>
                  )}
                  {list.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.nombre}
                        {!e.activo && (
                          <Badge variant="muted" className="ml-2 text-xs">
                            Inactiva
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.cuit ?? '—'}</TableCell>
                      <TableCell className="text-center">{e._count?.empleados ?? 0}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setVista({ tipo: 'form', empresa: e })}
                          >
                            Editar
                          </Button>
                          {e.activo && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`¿Desactivar "${e.nombre}"?`))
                                  desactivarMut.mutate(e.id);
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
          <FormEmpresa
            empresa={vista.empresa}
            onBack={() => setVista({ tipo: 'lista' })}
            onSaved={(creada) => {
              qc.invalidateQueries({ queryKey: ['empresas'] });
              if (creada && onEmpresaCreada) onEmpresaCreada(creada);
              setVista({ tipo: 'lista' });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormEmpresa({
  empresa,
  onBack,
  onSaved,
}: {
  empresa?: Empresa;
  onBack: () => void;
  onSaved: (creada?: Empresa) => void;
}) {
  const [nombre, setNombre] = useState(empresa?.nombre ?? '');
  const [cuit, setCuit] = useState(empresa?.cuit ?? '');

  const m = useMutation({
    mutationFn: () =>
      empresa
        ? empresasService.update(empresa.id, {
            nombre: nombre.trim(),
            cuit: cuit.trim() || null,
          })
        : empresasService.create({
            nombre: nombre.trim(),
            cuit: cuit.trim() || undefined,
          }),
    onSuccess: (emp) => {
      toast.success(empresa ? 'Empresa actualizada' : 'Empresa creada');
      onSaved(empresa ? undefined : (emp as Empresa));
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
          <DialogTitle>{empresa ? 'Editar' : 'Nueva'} empresa</DialogTitle>
        </div>
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
          <Label>Nombre *</Label>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Cardi, Picardi…"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>CUIT</Label>
          <Input
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            placeholder="20-12345678-9"
          />
        </div>
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
