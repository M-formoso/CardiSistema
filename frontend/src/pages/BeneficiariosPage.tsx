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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  beneficiariosService,
  type TipoBeneficiario,
} from '@/services/beneficiariosService';

const TIPOS: Array<{ v: TipoBeneficiario | ''; label: string }> = [
  { v: '', label: 'Todos' },
  { v: 'EMPLEADO', label: 'Empleados' },
  { v: 'CONTRATISTA', label: 'Contratistas' },
  { v: 'PROVEEDOR', label: 'Proveedores' },
  { v: 'PROFESIONAL', label: 'Profesionales' },
  { v: 'OTRO', label: 'Otros' },
];

export function BeneficiariosPage() {
  const [tipo, setTipo] = useState<TipoBeneficiario | ''>('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: list = [], isLoading } = useQuery({
    queryKey: ['beneficiarios', { tipo, q }],
    queryFn: () =>
      beneficiariosService.list({
        tipo: tipo || undefined,
        q: q || undefined,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Beneficiarios</h1>
          <p className="text-sm text-muted">
            Empleados, contratistas, proveedores, profesionales y otros.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nuevo
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select
          className="max-w-xs"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoBeneficiario | '')}
        >
          {TIPOS.map((t) => (
            <option key={t.v} value={t.v}>
              {t.label}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Buscar por nombre o CUIT…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>CUIT/CUIL</TableHead>
              <TableHead>Rubro</TableHead>
              <TableHead>Estado</TableHead>
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
                  Sin beneficiarios.
                </TableCell>
              </TableRow>
            )}
            {list.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.nombre}</TableCell>
                <TableCell>
                  <Badge variant="muted">{b.tipo}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{b.cuitCuil ?? '—'}</TableCell>
                <TableCell className="text-muted">{b.rubro ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={b.activo ? 'success' : 'muted'}>
                    {b.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NuevoBeneficiarioDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['beneficiarios'] });
          setOpen(false);
        }}
      />
    </div>
  );
}

function NuevoBeneficiarioDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [tipo, setTipo] = useState<TipoBeneficiario>('PROVEEDOR');
  const [nombre, setNombre] = useState('');
  const [cuit, setCuit] = useState('');
  const [rubro, setRubro] = useState('');
  const [contacto, setContacto] = useState('');

  const m = useMutation({
    mutationFn: () =>
      beneficiariosService.create({
        tipo,
        nombre: nombre.trim(),
        cuitCuil: cuit.trim() || undefined,
        rubro: rubro.trim() || undefined,
        contacto: contacto.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Beneficiario creado');
      setNombre('');
      setCuit('');
      setRubro('');
      setContacto('');
      onCreated();
    },
    onError: (err) => {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'No se pudo crear',
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo beneficiario</DialogTitle>
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
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoBeneficiario)}>
                <option value="EMPLEADO">Empleado</option>
                <option value="CONTRATISTA">Contratista</option>
                <option value="PROVEEDOR">Proveedor</option>
                <option value="PROFESIONAL">Profesional</option>
                <option value="OTRO">Otro</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CUIT / CUIL</Label>
              <Input value={cuit} onChange={(e) => setCuit(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nombre / Razón social *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Rubro</Label>
            <Input value={rubro} onChange={(e) => setRubro(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Contacto</Label>
            <Input
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              placeholder="Teléfono, email…"
            />
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
