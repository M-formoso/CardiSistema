import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Loader2, Plus, Wallet } from 'lucide-react';
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
import {
  contratosCuotasService,
  type ContratoCuota,
  type Cuota,
} from '@/services/contratosCuotasService';
import { beneficiariosService } from '@/services/beneficiariosService';
import { obrasService } from '@/services/obrasService';
import { cajasService } from '@/services/cajasService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

export function ContratosCuotasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [pagarCuota, setPagarCuota] = useState<{ cuota: Cuota; contrato: ContratoCuota } | null>(null);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['contratos-cuotas', { activo: true }],
    queryFn: () => contratosCuotasService.list({ activo: true }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contratos en cuotas</h1>
          <p className="text-sm text-muted">
            Pagos programados a profesionales (ej. 4 cuotas en USD a un arquitecto).
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nuevo contrato
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Profesional</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Cuotas</TableHead>
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
            {!isLoading && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted py-8">
                  Sin contratos.
                </TableCell>
              </TableRow>
            )}
            {list.map((c) => (
              <ContratoRow
                key={c.id}
                contrato={c}
                expandido={!!expandido[c.id]}
                onToggle={() => setExpandido((p) => ({ ...p, [c.id]: !p[c.id] }))}
                onPagarCuota={(cuota) => setPagarCuota({ cuota, contrato: c })}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <NuevoContratoDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['contratos-cuotas'] });
          setOpen(false);
        }}
      />
      {pagarCuota && (
        <PagarCuotaDialog
          cuota={pagarCuota.cuota}
          moneda={pagarCuota.contrato.moneda}
          onClose={() => setPagarCuota(null)}
          onPaid={() => {
            qc.invalidateQueries({ queryKey: ['contratos-cuotas'] });
            qc.invalidateQueries({ queryKey: ['movimientos'] });
            qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
            setPagarCuota(null);
          }}
        />
      )}
    </div>
  );
}

function ContratoRow({
  contrato,
  expandido,
  onToggle,
  onPagarCuota,
}: {
  contrato: ContratoCuota;
  expandido: boolean;
  onToggle: () => void;
  onPagarCuota: (c: Cuota) => void;
}) {
  const { data: detalle } = useQuery({
    queryKey: ['contratos-cuotas', contrato.id],
    queryFn: () => contratosCuotasService.get(contrato.id),
    enabled: expandido,
  });

  const cuotas = detalle?.cuotas ?? contrato.cuotas ?? [];
  const pagadas = cuotas.filter((c) => c.estado === 'PAGADA').length;

  return (
    <>
      <TableRow>
        <TableCell>
          <Button variant="ghost" size="icon" onClick={onToggle}>
            {expandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-medium">{contrato.beneficiario?.nombre}</TableCell>
        <TableCell>{contrato.concepto}</TableCell>
        <TableCell className="text-sm text-muted">{contrato.obra?.nombre ?? 'General'}</TableCell>
        <TableCell className="num font-medium">
          {formatearMonto(contrato.montoTotal, contrato.moneda)}
        </TableCell>
        <TableCell>
          <Badge variant={pagadas === contrato.cantidadCuotas ? 'success' : 'default'}>
            {pagadas}/{contrato.cantidadCuotas}
          </Badge>
        </TableCell>
      </TableRow>
      {expandido && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/5 p-0">
            <Table>
              <TableBody>
                {cuotas.map((cuota) => (
                  <TableRow key={cuota.id}>
                    <TableCell className="w-16 pl-8">Nº {cuota.numero}</TableCell>
                    <TableCell className="num">{formatearFecha(cuota.vencimiento)}</TableCell>
                    <TableCell className="num font-medium">
                      {formatearMonto(cuota.monto, contrato.moneda)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          cuota.estado === 'PAGADA'
                            ? 'success'
                            : cuota.estado === 'ANULADA'
                              ? 'muted'
                              : 'warning'
                        }
                      >
                        {cuota.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-32 text-right pr-6">
                      {cuota.estado === 'PENDIENTE' && (
                        <Button variant="outline" size="sm" onClick={() => onPagarCuota(cuota)}>
                          <Wallet className="h-3 w-3 mr-1" />
                          Pagar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function NuevoContratoDialog({
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
  const [concepto, setConcepto] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('USD');
  const [cantidadCuotas, setCantidadCuotas] = useState('4');
  const [observaciones, setObservaciones] = useState('');

  const { data: benes = [] } = useQuery({
    queryKey: ['beneficiarios', { tipo: 'PROFESIONAL' }],
    queryFn: () => beneficiariosService.list({ tipo: 'PROFESIONAL', activo: true }),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras', { activo: true }],
    queryFn: () => obrasService.list({ activo: true }),
  });

  const m = useMutation({
    mutationFn: () =>
      contratosCuotasService.create({
        beneficiarioId,
        obraId: obraId || undefined,
        concepto: concepto.trim(),
        montoTotal: Number(montoTotal),
        moneda,
        cantidadCuotas: Number(cantidadCuotas),
        observaciones: observaciones.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Contrato creado — se generaron las cuotas con vencimiento mensual');
      setBeneficiarioId('');
      setObraId('');
      setConcepto('');
      setMontoTotal('');
      setCantidadCuotas('4');
      setObservaciones('');
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
          <DialogTitle>Nuevo contrato en cuotas</DialogTitle>
          <DialogDescription>
            Se generan cuotas iguales con vencimiento cada 30 días.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!beneficiarioId || !concepto || !montoTotal)
              return toast.error('Profesional, concepto y monto son obligatorios');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Profesional *</Label>
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
            <Label>Concepto *</Label>
            <Input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej: Proyecto ejecutivo Mont Petit"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Obra (opcional)</Label>
            <Select value={obraId} onChange={(e) => setObraId(e.target.value)}>
              <option value="">Sin obra (gasto general)</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Monto total *</Label>
              <Input
                type="number"
                step="0.01"
                value={montoTotal}
                onChange={(e) => setMontoTotal(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda *</Label>
              <Select value={moneda} onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD')}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cuotas *</Label>
              <Input
                type="number"
                min="1"
                max="60"
                value={cantidadCuotas}
                onChange={(e) => setCantidadCuotas(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear contrato'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PagarCuotaDialog({
  cuota,
  moneda,
  onClose,
  onPaid,
}: {
  cuota: Cuota;
  moneda: 'ARS' | 'USD';
  onClose: () => void;
  onPaid: () => void;
}) {
  const [cajaId, setCajaId] = useState('');
  const [medioPago, setMedioPago] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE_PROPIO' | 'CHEQUE_TERCERO'>('TRANSFERENCIA');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas', 'activas'],
    queryFn: () => cajasService.list(true),
  });
  const cajasValidas = cajas.filter((c) => c.moneda === moneda);

  const m = useMutation({
    mutationFn: () =>
      contratosCuotasService.pagarCuota(cuota.id, { cajaId, medioPago, fecha }),
    onSuccess: () => {
      toast.success(`Cuota ${cuota.numero} pagada`);
      onPaid();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo',
      ),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagar cuota {cuota.numero}</DialogTitle>
          <DialogDescription>Monto: {formatearMonto(cuota.monto, moneda)}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!cajaId) return toast.error('Elegí una caja');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Caja ({moneda}) *</Label>
            <Select value={cajaId} onChange={(e) => setCajaId(e.target.value)} required>
              <option value="">Elegí…</option>
              {cajasValidas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
