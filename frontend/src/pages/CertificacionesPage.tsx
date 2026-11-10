import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
import { certificacionesService, type Certificacion, type EstadoCertificacion } from '@/services/certificacionesService';
import { beneficiariosService } from '@/services/beneficiariosService';
import { obrasService } from '@/services/obrasService';
import { cajasService } from '@/services/cajasService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

const ESTADO_VARIANTE: Record<EstadoCertificacion, 'default' | 'success' | 'warning' | 'muted'> = {
  PENDIENTE: 'warning',
  PARCIAL: 'default',
  PAGADA: 'success',
  ANULADA: 'muted',
};

export function CertificacionesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pagarId, setPagarId] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoCertificacion | ''>('');

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['certificaciones', { estado }],
    queryFn: () => certificacionesService.list({ estado: estado || undefined }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Certificaciones</h1>
          <p className="text-sm text-muted">Pagos a contratistas por avance de obra.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nueva certificación
        </Button>
      </div>

      <Select
        value={estado}
        onChange={(e) => setEstado(e.target.value as EstadoCertificacion | '')}
        className="max-w-xs"
      >
        <option value="">Todos los estados</option>
        <option value="PENDIENTE">Pendientes</option>
        <option value="PARCIAL">Parciales</option>
        <option value="PAGADA">Pagadas</option>
        <option value="ANULADA">Anuladas</option>
      </Select>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Nº</TableHead>
              <TableHead>Contratista</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead>Avance</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted py-8">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted py-8">
                  Sin certificaciones.
                </TableCell>
              </TableRow>
            )}
            {list.map((c: Certificacion) => (
              <TableRow key={c.id}>
                <TableCell className="num">{formatearFecha(c.fecha)}</TableCell>
                <TableCell className="font-mono text-xs">{c.numero ?? '—'}</TableCell>
                <TableCell className="text-sm">{c.beneficiario?.nombre}</TableCell>
                <TableCell className="text-sm">{c.obra?.nombre}</TableCell>
                <TableCell className="num font-medium">
                  {formatearMonto(c.monto, c.moneda)}
                </TableCell>
                <TableCell className="num">
                  {formatearMonto(c.saldoPendiente, c.moneda)}
                </TableCell>
                <TableCell className="text-xs">
                  {c.porcentajeAvance ? `${c.porcentajeAvance}%` : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANTE[c.estado]}>{c.estado}</Badge>
                </TableCell>
                <TableCell>
                  {(c.estado === 'PENDIENTE' || c.estado === 'PARCIAL') && (
                    <Button variant="outline" size="sm" onClick={() => setPagarId(c.id)}>
                      <Wallet className="h-3 w-3 mr-1" />
                      Pagar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NuevaCertificacionDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['certificaciones'] });
          setOpen(false);
        }}
      />
      {pagarId && (
        <PagarCertificacionDialog
          certificacion={list.find((c) => c.id === pagarId)!}
          onClose={() => setPagarId(null)}
          onPaid={() => {
            qc.invalidateQueries({ queryKey: ['certificaciones'] });
            qc.invalidateQueries({ queryKey: ['movimientos'] });
            qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
            setPagarId(null);
          }}
        />
      )}
    </div>
  );
}

function NuevaCertificacionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [beneficiarioId, setBeneficiarioId] = useState('');
  const [obraId, setObraId] = useState('');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [porcentajeAvance, setPorcentajeAvance] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const { data: benes = [] } = useQuery({
    queryKey: ['beneficiarios', { tipo: 'CONTRATISTA' }],
    queryFn: () => beneficiariosService.list({ tipo: 'CONTRATISTA', activo: true }),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras', { activo: true }],
    queryFn: () => obrasService.list({ activo: true }),
  });

  const m = useMutation({
    mutationFn: () =>
      certificacionesService.create({
        beneficiarioId,
        obraId,
        numero: numero.trim() || undefined,
        fecha,
        monto: Number(monto),
        moneda,
        porcentajeAvance: porcentajeAvance ? Number(porcentajeAvance) : undefined,
        descripcion: descripcion.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Certificación creada');
      setBeneficiarioId('');
      setObraId('');
      setNumero('');
      setMonto('');
      setPorcentajeAvance('');
      setDescripcion('');
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva certificación</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!beneficiarioId || !obraId || !monto)
              return toast.error('Contratista, obra y monto son obligatorios');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Contratista *</Label>
              <Select
                value={beneficiarioId}
                onChange={(e) => setBeneficiarioId(e.target.value)}
                required
              >
                <option value="">Elegí…</option>
                {benes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Obra *</Label>
              <Select value={obraId} onChange={(e) => setObraId(e.target.value)} required>
                <option value="">Elegí…</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Nº</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>% Avance</Label>
              <Input
                type="number"
                step="0.01"
                value={porcentajeAvance}
                onChange={(e) => setPorcentajeAvance(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Monto *</Label>
              <Input
                type="number"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda *</Label>
              <Select value={moneda} onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD')}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
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

function PagarCertificacionDialog({
  certificacion,
  onClose,
  onPaid,
}: {
  certificacion: Certificacion;
  onClose: () => void;
  onPaid: () => void;
}) {
  const saldo = Number(certificacion.saldoPendiente);
  const [cajaId, setCajaId] = useState('');
  const [monto, setMonto] = useState(saldo.toFixed(2));
  const [medioPago, setMedioPago] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE_PROPIO' | 'CHEQUE_TERCERO'>('TRANSFERENCIA');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas', 'activas'],
    queryFn: () => cajasService.list(true),
  });

  const cajasValidas = cajas.filter((c) => c.moneda === certificacion.moneda);

  const m = useMutation({
    mutationFn: () =>
      certificacionesService.pagar(certificacion.id, {
        cajaId,
        monto: Number(monto),
        medioPago,
        fecha,
      }),
    onSuccess: () => {
      toast.success('Certificación pagada');
      onPaid();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo pagar',
      ),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar certificación</DialogTitle>
          <DialogDescription>
            {certificacion.beneficiario?.nombre} · {certificacion.obra?.nombre} · saldo{' '}
            {formatearMonto(saldo, certificacion.moneda)}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!cajaId || !monto) return toast.error('Completá los datos');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Caja ({certificacion.moneda}) *</Label>
            <Select value={cajaId} onChange={(e) => setCajaId(e.target.value)} required>
              <option value="">Elegí…</option>
              {cajasValidas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Monto *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={saldo}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Medio *</Label>
              <Select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value as typeof medioPago)}
              >
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="EFECTIVO">Efectivo</option>
                <option value="CHEQUE_PROPIO">Cheque propio</option>
                <option value="CHEQUE_TERCERO">Cheque tercero</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pagar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
