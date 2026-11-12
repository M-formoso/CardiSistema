import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ExternalLink, Download } from 'lucide-react';
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
  empleadosService,
  type Empleado,
  type SituacionFiscal,
} from '@/services/empleadosService';
import { empresasService } from '@/services/empresasService';
import { categoriasEmpleadosService } from '@/services/categoriasEmpleadosService';
import { obrasService } from '@/services/obrasService';
import { formatearMonto } from '@/lib/formatters';
import { usePagination } from '@/lib/usePagination';
import { Pagination } from '@/components/ui/pagination';

export function EmpleadosPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Empleado | null>(null);

  // Filtros
  const [q, setQ] = useState('');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroObra, setFiltroObra] = useState('');
  const [filtroSituacion, setFiltroSituacion] = useState<SituacionFiscal | ''>('');

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas', { activo: true }],
    queryFn: () => empresasService.list({ activo: true }),
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias-empleados', { activo: true }],
    queryFn: () => categoriasEmpleadosService.list({ activo: true }),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras', { activo: true }],
    queryFn: () => obrasService.list({ activo: true }),
  });

  const { data: listRaw = [], isLoading } = useQuery({
    queryKey: [
      'empleados',
      { q, filtroEmpresa, filtroCategoria, filtroObra, filtroSituacion },
    ],
    queryFn: () =>
      empleadosService.list({
        activo: true,
        q: q || undefined,
        empresaId: filtroEmpresa || undefined,
        categoriaId: filtroCategoria || undefined,
        obraId: filtroObra || undefined,
        situacionFiscal: filtroSituacion || undefined,
      }),
  });
  const { paginados: list, total, page, pageSize, setPage, setPageSize } =
    usePagination(listRaw, 25);

  const desactivarMut = useMutation({
    mutationFn: (id: string) => empleadosService.desactivar(id),
    onSuccess: () => {
      toast.success('Empleado desactivado');
      qc.invalidateQueries({ queryKey: ['empleados'] });
    },
  });

  const cargarMut = useMutation({
    mutationFn: () => empleadosService.cargarIniciales(),
    onSuccess: (r) => {
      toast.success(
        `Importados: ${r.creados} nuevos · ${r.actualizados} actualizados (total ${r.total})`,
      );
      if (r.categoriasFaltantes) {
        toast.warning(
          'No había categorías cargadas — los empleados quedaron sin categoría. Cargalas y volvé a importar para asociarlas.',
        );
      }
      qc.invalidateQueries({ queryKey: ['empleados'] });
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo importar',
      ),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empleados</h1>
          <p className="text-sm text-muted">
            Nómina única: empleados y contratistas (una misma persona puede ser ambos).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm('Importar los 24 empleados del Excel inicial del cliente? Es idempotente, no duplica ni pisa datos editados.'))
                cargarMut.mutate();
            }}
            disabled={cargarMut.isPending}
          >
            {cargarMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Importar del Excel
          </Button>
          <Button onClick={() => { setEditando(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo empleado
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Input
          placeholder="Buscar nombre o CUIT…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)}>
          <option value="">Todas las empresas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </Select>
        <Select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </Select>
        <Select value={filtroObra} onChange={(e) => setFiltroObra(e.target.value)}>
          <option value="">Todas las obras</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>{o.nombre}</option>
          ))}
        </Select>
        <Select
          value={filtroSituacion}
          onChange={(e) => setFiltroSituacion(e.target.value as SituacionFiscal | '')}
        >
          <option value="">Declarado y no declarado</option>
          <option value="BLANCO">Declarado</option>
          <option value="NEGRO">No declarado</option>
        </Select>
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
              <TableHead>Categoría</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Obra actual</TableHead>
              <TableHead className="text-right">Jornal</TableHead>
              <TableHead>Situación</TableHead>
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
                  Sin empleados con esos filtros.
                </TableCell>
              </TableRow>
            )}
            {list.map((emp) => {
              const obraActual = obras.find((o) => o.id === emp.legajo?.obraActualId);
              return (
                <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/5" onClick={() => nav(`/empleados/${emp.id}`)}>
                  <TableCell className="font-medium">
                    <div className="hover:underline">{emp.nombre}</div>
                    <div className="text-xs text-muted font-mono">
                      {emp.legajo?.dni ?? emp.cuitCuil ?? '—'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {emp.legajo?.categoria?.nombre ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {emp.legajo?.empresa?.nombre ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm">{obraActual?.nombre ?? '—'}</TableCell>
                  <TableCell className="num text-right">
                    {emp.legajo?.jornal ? formatearMonto(emp.legajo.jornal, 'ARS') : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={emp.legajo?.situacionFiscal === 'BLANCO' ? 'success' : 'muted'}>
                      {emp.legajo?.situacionFiscal === 'BLANCO' ? 'Declarado' : 'No declarado'}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => nav(`/empleados/${emp.id}`)}
                      >
                        Abrir
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditando(emp); setOpen(true); }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`¿Desactivar a ${emp.nombre}?`)) desactivarMut.mutate(emp.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
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
        <EmpleadoDialog
          empleado={editando ?? undefined}
          empresas={empresas}
          categorias={categorias}
          obras={obras}
          onClose={() => setOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['empleados'] });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ========== Dialog alta/edición de empleado ==========

function EmpleadoDialog({
  empleado,
  empresas,
  categorias,
  obras,
  onClose,
  onSaved,
}: {
  empleado?: Empleado;
  empresas: Array<{ id: string; nombre: string }>;
  categorias: Array<{ id: string; nombre: string; jornal?: string | null }>;
  obras: Array<{ id: string; nombre: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(empleado?.nombre ?? '');
  const [dni, setDni] = useState(empleado?.legajo?.dni ?? '');
  const [cuitCuil, setCuitCuil] = useState(empleado?.cuitCuil ?? '');
  const [empresaId, setEmpresaId] = useState(empleado?.legajo?.empresaId ?? '');
  const [categoriaId, setCategoriaId] = useState(empleado?.legajo?.categoriaId ?? '');
  const [situacion, setSituacion] = useState<SituacionFiscal>(
    empleado?.legajo?.situacionFiscal ?? 'NEGRO',
  );
  const [fechaIngreso, setFechaIngreso] = useState(
    empleado?.legajo?.fechaIngreso?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [jornal, setJornal] = useState(empleado?.legajo?.jornal ?? '');
  const [horaExtra, setHoraExtra] = useState(empleado?.legajo?.valorHoraExtra ?? '');
  const [obraActualId, setObraActualId] = useState(empleado?.legajo?.obraActualId ?? '');

  const catSel = categorias.find((c) => c.id === categoriaId);

  const m = useMutation({
    mutationFn: () =>
      empleado
        ? empleadosService.update(empleado.id, {
            nombre: nombre.trim(),
            dni: dni.trim() || null,
            cuitCuil: cuitCuil.trim() || null,
            empresaId: empresaId || null,
            categoriaId: categoriaId || null,
            situacionFiscal: situacion,
            fechaIngreso,
            obraActualId: obraActualId || null,
          })
        : empleadosService.create({
            nombre: nombre.trim(),
            dni: dni.trim() || undefined,
            cuitCuil: cuitCuil.trim() || undefined,
            empresaId: empresaId || undefined,
            categoriaId: categoriaId || undefined,
            situacionFiscal: situacion,
            fechaIngreso,
            jornal: jornal ? Number(jornal) : undefined,
            valorHoraExtra: horaExtra ? Number(horaExtra) : undefined,
            obraActualId: obraActualId || undefined,
          }),
    onSuccess: () => {
      toast.success(empleado ? 'Empleado actualizado' : 'Empleado creado');
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{empleado ? 'Editar' : 'Nuevo'} empleado</DialogTitle>
          {empleado && (
            <DialogDescription>
              El jornal se cambia desde la ficha del empleado (abre con la flecha de la tabla).
            </DialogDescription>
          )}
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nombre.trim()) return toast.error('El nombre es obligatorio');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>Nombre y apellido *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>DNI</Label>
              <Input value={dni} onChange={(e) => setDni(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CUIT / CUIL</Label>
              <Input value={cuitCuil} onChange={(e) => setCuitCuil(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
                <option value="">— sin asignar —</option>
                {empresas.map((em) => (
                  <option key={em.id} value={em.id}>{em.nombre}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={categoriaId}
                onChange={(e) => {
                  setCategoriaId(e.target.value);
                  // En alta: autocargar jornal desde la categoría si no hay valor propio
                  if (!empleado) {
                    const c = categorias.find((x) => x.id === e.target.value);
                    if (c?.jornal && !jornal) setJornal(c.jornal);
                  }
                }}
              >
                <option value="">— sin asignar —</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </Select>
              {catSel?.jornal && (
                <p className="text-xs text-muted">
                  Jornal referencia: {formatearMonto(catSel.jornal, 'ARS')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Situación</Label>
              <Select
                value={situacion}
                onChange={(e) => setSituacion(e.target.value as SituacionFiscal)}
              >
                <option value="BLANCO">Declarado</option>
                <option value="NEGRO">No declarado</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha de ingreso *</Label>
              <Input
                type="date"
                value={fechaIngreso}
                onChange={(e) => setFechaIngreso(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Obra actual</Label>
              <Select value={obraActualId} onChange={(e) => setObraActualId(e.target.value)}>
                <option value="">— sin asignar —</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </Select>
            </div>
            {!empleado && (
              <>
                <div className="space-y-2">
                  <Label>Jornal</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={jornal}
                    onChange={(e) => setJornal(e.target.value)}
                    placeholder={catSel?.jornal ? `Default: ${catSel.jornal}` : ''}
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
              </>
            )}
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

