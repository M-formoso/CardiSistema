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
  chequesService,
  type CreateChequeInput,
  type EstadoCheque,
  type TipoCheque,
} from '@/services/chequesService';
import { beneficiariosService } from '@/services/beneficiariosService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

const ESTADO_VARIANTE: Record<EstadoCheque, 'default' | 'success' | 'danger' | 'muted' | 'warning'> = {
  EN_CARTERA: 'default',
  ENTREGADO: 'warning',
  DEPOSITADO: 'warning',
  COBRADO: 'success',
  EMITIDO: 'default',
  DEBITADO: 'success',
  RECHAZADO: 'danger',
  ANULADO: 'muted',
};

const SIGUIENTES_ESTADOS: Record<EstadoCheque, EstadoCheque[]> = {
  EN_CARTERA: ['ENTREGADO', 'DEPOSITADO', 'ANULADO'],
  ENTREGADO: ['COBRADO', 'RECHAZADO', 'ANULADO'],
  DEPOSITADO: ['COBRADO', 'RECHAZADO', 'ANULADO'],
  EMITIDO: ['DEBITADO', 'RECHAZADO', 'ANULADO'],
  COBRADO: [],
  DEBITADO: [],
  RECHAZADO: [],
  ANULADO: [],
};

export function ChequesPage() {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoCheque | ''>('');
  const [estado, setEstado] = useState<EstadoCheque | ''>('');
  const [q, setQ] = useState('');
  const [openNuevo, setOpenNuevo] = useState(false);

  const { data: cheques = [], isLoading } = useQuery({
    queryKey: ['cheques', { tipo, estado, q }],
    queryFn: () =>
      chequesService.list({
        tipo: tipo || undefined,
        estado: estado || undefined,
        q: q || undefined,
      }),
  });

  const cambiarMut = useMutation({
    mutationFn: ({ id, nuevoEstado }: { id: string; nuevoEstado: EstadoCheque }) =>
      chequesService.cambiarEstado(id, nuevoEstado),
    onSuccess: () => {
      toast.success('Estado actualizado');
      qc.invalidateQueries({ queryKey: ['cheques'] });
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo cambiar el estado',
      ),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cheques</h1>
          <p className="text-sm text-muted">Propios y de terceros.</p>
        </div>
        <Button onClick={() => setOpenNuevo(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nuevo cheque
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoCheque | '')}
          className="max-w-xs"
        >
          <option value="">Tipo: todos</option>
          <option value="PROPIO">Propio</option>
          <option value="TERCERO">De tercero</option>
        </Select>
        <Select
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoCheque | '')}
          className="max-w-xs"
        >
          <option value="">Estado: todos</option>
          <option value="EN_CARTERA">En cartera</option>
          <option value="ENTREGADO">Entregado</option>
          <option value="DEPOSITADO">Depositado</option>
          <option value="COBRADO">Cobrado</option>
          <option value="EMITIDO">Emitido</option>
          <option value="DEBITADO">Debitado</option>
          <option value="RECHAZADO">Rechazado</option>
          <option value="ANULADO">Anulado</option>
        </Select>
        <Input
          placeholder="Buscar nº, banco, titular…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Titular / Librador</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted py-8">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && cheques.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted py-8">
                  Sin cheques.
                </TableCell>
              </TableRow>
            )}
            {cheques.map((c) => {
              const siguientes = SIGUIENTES_ESTADOS[c.estado];
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                  <TableCell>
                    <Badge variant="muted">{c.tipo}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{c.banco ?? '—'}</TableCell>
                  <TableCell className="text-xs">{c.titular ?? c.librador ?? '—'}</TableCell>
                  <TableCell className="num font-medium">
                    {formatearMonto(c.monto, c.moneda)}
                  </TableCell>
                  <TableCell className="num text-xs">{formatearFecha(c.fechaPago)}</TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_VARIANTE[c.estado]}>{c.estado}</Badge>
                  </TableCell>
                  <TableCell>
                    {siguientes.length > 0 && (
                      <Select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            cambiarMut.mutate({
                              id: c.id,
                              nuevoEstado: e.target.value as EstadoCheque,
                            });
                          }
                        }}
                        className="w-32 text-xs"
                      >
                        <option value="">Cambiar…</option>
                        {siguientes.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <NuevoChequeDialog
        open={openNuevo}
        onOpenChange={setOpenNuevo}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['cheques'] });
          setOpenNuevo(false);
        }}
      />
    </div>
  );
}

function NuevoChequeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [tipo, setTipo] = useState<TipoCheque>('TERCERO');
  const [numero, setNumero] = useState('');
  const [banco, setBanco] = useState('');
  const [titular, setTitular] = useState('');
  const [cuit, setCuit] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [fechaEmision, setFechaEmision] = useState(() => new Date().toISOString().slice(0, 10));
  const [fechaPago, setFechaPago] = useState(() => new Date().toISOString().slice(0, 10));
  const [beneficiarioId, setBeneficiarioId] = useState('');

  const { data: benes = [] } = useQuery({
    queryKey: ['beneficiarios', { activo: true }],
    queryFn: () => beneficiariosService.list({ activo: true }),
  });

  const m = useMutation({
    mutationFn: (input: CreateChequeInput) => chequesService.create(input),
    onSuccess: () => {
      toast.success('Cheque creado');
      setNumero('');
      setBanco('');
      setTitular('');
      setCuit('');
      setMonto('');
      setBeneficiarioId('');
      onCreated();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo crear',
      ),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo cheque</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!numero.trim() || !monto) return toast.error('Completá los campos obligatorios');
            m.mutate({
              tipo,
              numero: numero.trim(),
              banco: banco.trim() || undefined,
              titular: titular.trim() || undefined,
              cuit: cuit.trim() || undefined,
              monto: Number(monto),
              moneda,
              fechaEmision,
              fechaPago,
              beneficiarioId: beneficiarioId || undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCheque)}>
                <option value="TERCERO">De tercero (recibido)</option>
                <option value="PROPIO">Propio (emitido)</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número *</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Banco</Label>
              <Input value={banco} onChange={(e) => setBanco(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Titular / Librador</Label>
              <Input value={titular} onChange={(e) => setTitular(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>CUIT</Label>
              <Input value={cuit} onChange={(e) => setCuit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Monto *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select value={moneda} onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD')}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha emisión *</Label>
              <Input
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha pago *</Label>
              <Input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Beneficiario (opcional)</Label>
            <Select value={beneficiarioId} onChange={(e) => setBeneficiarioId(e.target.value)}>
              <option value="">Sin asignar</option>
              {benes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre} · {b.tipo}
                </option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear cheque'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
