import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Search, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { proveedoresService } from '@/services/proveedoresService';
import { beneficiariosService } from '@/services/beneficiariosService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

/**
 * Lista de proveedores con saldo calculado al vuelo.
 * Click en una fila → detalle con cuenta corriente, pagos y resúmenes.
 */
export function ProveedoresPage() {
  const [q, setQ] = useState('');
  const [nuevoOpen, setNuevoOpen] = useState(false);

  const { data: proveedores = [], isLoading } = useQuery({
    queryKey: ['proveedores', { q }],
    queryFn: () => proveedoresService.list({ q: q.trim() || undefined }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6" /> Proveedores
          </h1>
          <p className="text-sm text-muted">
            Cuenta corriente por proveedor. Saldo = último resumen cargado − pagos posteriores.
          </p>
        </div>
        <Button onClick={() => setNuevoOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nuevo proveedor
        </Button>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o CUIT…"
          className="pl-10 max-w-sm"
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead>CUIT / CUIL</TableHead>
              <TableHead>Último resumen</TableHead>
              <TableHead className="text-right">Saldo actual</TableHead>
              <TableHead className="text-right">Pagos</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted py-8">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && proveedores.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted py-10 text-sm">
                  {q
                    ? 'Sin coincidencias.'
                    : 'Todavía no cargaste ningún proveedor. Usá "Nuevo proveedor" para empezar.'}
                </TableCell>
              </TableRow>
            )}
            {proveedores.map((p) => {
              const saldoNum = Number(p.saldoTotal);
              return (
                <TableRow key={p.id} className="hover:bg-muted/5">
                  <TableCell>
                    <Link to={`/proveedores/${p.id}`} className="font-medium hover:underline">
                      {p.nombre}
                    </Link>
                    {!p.activo && (
                      <Badge variant="muted" className="ml-2 text-[10px]">
                        INACTIVO
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{p.cuitCuil ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted">
                    {p.ultimoResumenFecha ? (
                      <>
                        <span className="num">{formatearFecha(p.ultimoResumenFecha)}</span>
                        <span className="text-foreground/70 ml-2">
                          ({formatearMonto(p.ultimoResumenMonto ?? '0', 'ARS')})
                        </span>
                      </>
                    ) : (
                      <span className="italic">sin resumen cargado</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right num font-semibold ${
                      saldoNum > 0.01
                        ? 'text-danger'
                        : saldoNum < -0.01
                          ? 'text-success'
                          : 'text-muted'
                    }`}
                    title={
                      !p.ultimoResumenFecha
                        ? 'Sin resumen: el saldo mostrado es solo los pagos hechos (negativo)'
                        : undefined
                    }
                  >
                    {formatearMonto(saldoNum, 'ARS')}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted">{p.cantidadPagos}</TableCell>
                  <TableCell>
                    <Link to={`/proveedores/${p.id}`}>
                      <Button variant="outline" size="sm">
                        Ver detalle
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {nuevoOpen && (
        <NuevoProveedorDialog onClose={() => setNuevoOpen(false)} />
      )}
    </div>
  );
}

function NuevoProveedorDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [cuitCuil, setCuitCuil] = useState('');
  const [contacto, setContacto] = useState('');
  const [rubro, setRubro] = useState('');
  const [condicionPago, setCondicionPago] = useState('');

  const m = useMutation({
    mutationFn: () =>
      beneficiariosService.create({
        tipo: 'PROVEEDOR',
        nombre: nombre.trim(),
        cuitCuil: cuitCuil.trim() || undefined,
        contacto: contacto.trim() || undefined,
        rubro: rubro.trim() || undefined,
        condicionPago: condicionPago.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Proveedor creado');
      qc.invalidateQueries({ queryKey: ['proveedores'] });
      qc.invalidateQueries({ queryKey: ['beneficiarios'] });
      onClose();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo crear',
      ),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo proveedor</DialogTitle>
          <DialogDescription>
            Se crea como Beneficiario tipo PROVEEDOR. Después vas a poder cargar resúmenes de
            cuenta corriente y registrar pagos.
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
            <Label>Nombre / Razón social *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>CUIT / CUIL</Label>
              <Input value={cuitCuil} onChange={(e) => setCuitCuil(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Rubro</Label>
              <Input value={rubro} onChange={(e) => setRubro(e.target.value)} placeholder="Materiales, Fletes…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contacto</Label>
              <Input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Teléfono / email" />
            </div>
            <div className="space-y-1.5">
              <Label>Condición de pago</Label>
              <Input
                value={condicionPago}
                onChange={(e) => setCondicionPago(e.target.value)}
                placeholder="Contado, 30 días…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear proveedor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
