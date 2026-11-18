import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { beneficiariosService } from '@/services/beneficiariosService';

/**
 * Selector de "Origen" (quién nos paga). Reunión Dani 18/11: separado de
 * empleados, es una EMPRESA_PAGADORA (Grupo Fonte, Astori, Marcelo Picardi).
 * Trae un combobox buscable + botón "+" al lado para alta inline.
 */
export function OrigenPicker({
  value,
  onChange,
  label = 'Origen (empresa que paga)',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const qc = useQueryClient();
  const [nuevoOpen, setNuevoOpen] = useState(false);

  const { data: origenes = [] } = useQuery({
    queryKey: ['beneficiarios', { tipo: 'EMPRESA_PAGADORA', activo: true }],
    queryFn: () => beneficiariosService.list({ tipo: 'EMPRESA_PAGADORA', activo: true }),
  });

  const opts = useMemo<ComboboxOption[]>(
    () => origenes.map((o) => ({ value: o.id, label: o.nombre, hint: o.cuitCuil ?? undefined })),
    [origenes],
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          onClick={() => setNuevoOpen(true)}
          className="text-xs text-primary hover:underline"
        >
          + Nuevo origen
        </button>
      </div>
      <Combobox
        options={opts}
        value={value}
        onChange={onChange}
        placeholder="Sin origen"
        searchPlaceholder="Buscar…"
        allLabel="Sin origen"
      />
      {nuevoOpen && (
        <NuevoOrigenDialog
          onClose={() => setNuevoOpen(false)}
          onCreated={(b) => {
            qc.invalidateQueries({ queryKey: ['beneficiarios'] });
            onChange(b.id);
            setNuevoOpen(false);
          }}
        />
      )}
    </div>
  );
}

function NuevoOrigenDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (b: { id: string; nombre: string }) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [cuit, setCuit] = useState('');

  const m = useMutation({
    mutationFn: () =>
      beneficiariosService.create({
        tipo: 'EMPRESA_PAGADORA',
        nombre: nombre.trim(),
        cuitCuil: cuit.trim() || undefined,
      }),
    onSuccess: (b) => {
      toast.success('Origen creado');
      onCreated(b);
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo crear',
      ),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo origen (empresa que paga)</DialogTitle>
          <DialogDescription>
            Quién nos envía la plata: Grupo Fonte, Marcelo Picardi, Astori, etc.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nombre.trim()) return toast.error('El nombre es obligatorio');
            m.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>CUIT (opcional)</Label>
            <Input value={cuit} onChange={(e) => setCuit(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear origen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
