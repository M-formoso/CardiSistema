import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { empresasService, type Empresa } from '@/services/empresasService';
import { usePagination } from '@/lib/usePagination';
import { Pagination } from '@/components/ui/pagination';

export function EmpresasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Empresa | null>(null);

  const { data: listRaw = [], isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => empresasService.list(),
  });
  const { paginados: list, total, page, pageSize, setPage, setPageSize } =
    usePagination(listRaw, 25);

  const desactivarMut = useMutation({
    mutationFn: (id: string) => empresasService.desactivar(id),
    onSuccess: () => {
      toast.success('Empresa desactivada');
      qc.invalidateQueries({ queryKey: ['empresas'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Empresas</h2>
          <p className="text-sm text-muted">
            Razones sociales a las que pertenecen los empleados (Cardi, Picardi, etc.).
          </p>
        </div>
        <Button onClick={() => { setEditando(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Nueva
        </Button>
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
              <TableHead>Nombre</TableHead>
              <TableHead>CUIT</TableHead>
              <TableHead className="text-center">Empleados</TableHead>
              <TableHead>Estado</TableHead>
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
            {!isLoading && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted py-8">
                  Sin empresas.
                </TableCell>
              </TableRow>
            )}
            {list.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.nombre}</TableCell>
                <TableCell className="font-mono text-xs">{e.cuit ?? '—'}</TableCell>
                <TableCell className="text-center">{e._count?.empleados ?? 0}</TableCell>
                <TableCell>
                  <Badge variant={e.activo ? 'success' : 'muted'}>
                    {e.activo ? 'Activa' : 'Inactiva'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditando(e); setOpen(true); }}
                    >
                      Editar
                    </Button>
                    {e.activo && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`¿Desactivar "${e.nombre}"?`)) desactivarMut.mutate(e.id);
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
        <EmpresaDialog
          empresa={editando ?? undefined}
          onClose={() => setOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['empresas'] });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function EmpresaDialog({
  empresa,
  onClose,
  onSaved,
}: {
  empresa?: Empresa;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(empresa?.nombre ?? '');
  const [cuit, setCuit] = useState(empresa?.cuit ?? '');

  const m = useMutation({
    mutationFn: () =>
      empresa
        ? empresasService.update(empresa.id, { nombre: nombre.trim(), cuit: cuit.trim() || null })
        : empresasService.create({ nombre: nombre.trim(), cuit: cuit.trim() || undefined }),
    onSuccess: () => {
      toast.success(empresa ? 'Empresa actualizada' : 'Empresa creada');
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
          <DialogTitle>{empresa ? 'Editar' : 'Nueva'} empresa</DialogTitle>
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
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>CUIT</Label>
            <Input value={cuit} onChange={(e) => setCuit(e.target.value)} placeholder="20-12345678-9" />
          </div>
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
