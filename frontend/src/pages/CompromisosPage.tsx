import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, RefreshCw, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  compromisosService,
  type CompromisoPago,
  type CreateVencimientoInput,
} from '@/services/compromisosService';
import { obrasService } from '@/services/obrasService';
import { beneficiariosService } from '@/services/beneficiariosService';
import { categoriasService } from '@/services/categoriasService';
import { cajasService } from '@/services/cajasService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

export function CompromisosPage() {
  const qc = useQueryClient();
  const [openVenc, setOpenVenc] = useState(false);
  const [pagando, setPagando] = useState<CompromisoPago | null>(null);

  const { data: proyeccion } = useQuery({
    queryKey: ['compromisos', 'proyeccion'],
    queryFn: () => compromisosService.proyeccion(30),
  });

  const { data: vencimientos = [] } = useQuery({
    queryKey: ['vencimientos'],
    queryFn: () => compromisosService.listVencimientos(),
  });

  const generarMut = useMutation({
    mutationFn: () => compromisosService.generar(),
    onSuccess: (data) => {
      toast.success(`${data.creados} compromiso${data.creados === 1 ? '' : 's'} generado${data.creados === 1 ? '' : 's'}`);
      qc.invalidateQueries({ queryKey: ['compromisos'] });
    },
  });

  const omitirMut = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      compromisosService.omitir(id, motivo),
    onSuccess: () => {
      toast.success('Compromiso omitido');
      qc.invalidateQueries({ queryKey: ['compromisos'] });
    },
  });

  const desactivarVencMut = useMutation({
    mutationFn: (id: string) => compromisosService.desactivarVencimiento(id),
    onSuccess: () => {
      toast.success('Vencimiento desactivado');
      qc.invalidateQueries({ queryKey: ['vencimientos'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compromisos y vencimientos</h1>
          <p className="text-sm text-muted">
            Agenda de pagos recurrentes con proyección de los próximos 30 días.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => generarMut.mutate()} disabled={generarMut.isPending}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Generar del mes
          </Button>
          <Button onClick={() => setOpenVenc(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo vencimiento
          </Button>
        </div>
      </div>

      {proyeccion && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted">Próximos 30 días</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{proyeccion.cantidad}</div>
              <div className="text-xs text-muted mt-1">compromiso{proyeccion.cantidad === 1 ? '' : 's'} pendiente{proyeccion.cantidad === 1 ? '' : 's'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted">Total ARS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold num">
                {formatearMonto(proyeccion.totales.ars, 'ARS')}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted">Total USD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold num text-primary">
                {formatearMonto(proyeccion.totales.usd, 'USD')}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-2">Pendientes próximos 30 días</h2>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Obra / Benef.</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proyeccion?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted py-6">
                    No hay compromisos pendientes en los próximos 30 días.
                  </TableCell>
                </TableRow>
              )}
              {proyeccion?.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="num">{formatearFecha(c.fecha)}</TableCell>
                  <TableCell>{c.concepto}</TableCell>
                  <TableCell className="text-xs text-muted">
                    {c.obra?.nombre ?? c.beneficiario?.nombre ?? '—'}
                  </TableCell>
                  <TableCell className="num font-medium">
                    {formatearMonto(c.montoEstimado, c.moneda)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => setPagando(c)}>
                        <Wallet className="h-3 w-3 mr-1" />
                        Pagar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const motivo = prompt('Motivo para omitir:');
                          if (motivo && motivo.trim().length >= 3)
                            omitirMut.mutate({ id: c.id, motivo: motivo.trim() });
                        }}
                        title="Omitir"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Vencimientos recurrentes</h2>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead>Día</TableHead>
                <TableHead>Obra / Benef.</TableHead>
                <TableHead>Monto estimado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vencimientos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted py-6">
                    Sin vencimientos cargados.
                  </TableCell>
                </TableRow>
              )}
              {vencimientos.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.concepto}</TableCell>
                  <TableCell className="num text-center">{v.diaDelMes}</TableCell>
                  <TableCell className="text-xs text-muted">
                    {v.obra?.nombre ?? v.beneficiario?.nombre ?? '—'}
                  </TableCell>
                  <TableCell className="num">
                    {formatearMonto(v.montoEstimado, v.moneda)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={v.activo ? 'success' : 'muted'}>
                      {v.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {v.activo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`¿Desactivar "${v.concepto}"?`))
                            desactivarVencMut.mutate(v.id);
                        }}
                      >
                        Desactivar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <NuevoVencimientoDialog
        open={openVenc}
        onOpenChange={setOpenVenc}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['vencimientos'] });
          setOpenVenc(false);
        }}
      />
      {pagando && (
        <PagarCompromisoDialog
          compromiso={pagando}
          onClose={() => setPagando(null)}
          onPaid={() => {
            qc.invalidateQueries({ queryKey: ['compromisos'] });
            qc.invalidateQueries({ queryKey: ['movimientos'] });
            qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
            setPagando(null);
          }}
        />
      )}
    </div>
  );
}

function NuevoVencimientoDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [concepto, setConcepto] = useState('');
  const [diaDelMes, setDiaDelMes] = useState('10');
  const [montoEstimado, setMontoEstimado] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [obraId, setObraId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [beneficiarioId, setBeneficiarioId] = useState('');

  const { data: obras = [] } = useQuery({
    queryKey: ['obras', { activo: true }],
    queryFn: () => obrasService.list({ activo: true }),
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias', 'activas'],
    queryFn: () => categoriasService.list(true),
  });
  const { data: benes = [] } = useQuery({
    queryKey: ['beneficiarios', { activo: true }],
    queryFn: () => beneficiariosService.list({ activo: true }),
  });

  const m = useMutation({
    mutationFn: () => {
      const input: CreateVencimientoInput = {
        concepto: concepto.trim(),
        diaDelMes: Number(diaDelMes),
        montoEstimado: Number(montoEstimado),
        moneda,
        obraId: obraId || undefined,
        categoriaId: categoriaId || undefined,
        beneficiarioId: beneficiarioId || undefined,
      };
      return compromisosService.crearVencimiento(input);
    },
    onSuccess: () => {
      toast.success('Vencimiento creado');
      setConcepto('');
      setMontoEstimado('');
      setObraId('');
      setCategoriaId('');
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo vencimiento recurrente</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!concepto.trim() || !montoEstimado)
              return toast.error('Concepto y monto son obligatorios');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Concepto *</Label>
            <Input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej: Luz Rialto, Ingresos Brutos…"
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Día del mes *</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={diaDelMes}
                onChange={(e) => setDiaDelMes(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Monto estimado *</Label>
              <Input
                type="number"
                step="0.01"
                value={montoEstimado}
                onChange={(e) => setMontoEstimado(e.target.value)}
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
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Obra</Label>
              <Select value={obraId} onChange={(e) => setObraId(e.target.value)}>
                <option value="">Sin obra</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                <option value="">—</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Beneficiario</Label>
              <Select value={beneficiarioId} onChange={(e) => setBeneficiarioId(e.target.value)}>
                <option value="">—</option>
                {benes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </Select>
            </div>
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

function PagarCompromisoDialog({
  compromiso,
  onClose,
  onPaid,
}: {
  compromiso: CompromisoPago;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [cajaId, setCajaId] = useState('');
  const [monto, setMonto] = useState(compromiso.montoEstimado);
  const [medioPago, setMedioPago] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE_PROPIO' | 'CHEQUE_TERCERO'>('TRANSFERENCIA');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas', 'activas'],
    queryFn: () => cajasService.list(true),
  });
  const cajasValidas = cajas.filter((c) => c.moneda === compromiso.moneda);

  const m = useMutation({
    mutationFn: () =>
      compromisosService.pagar(compromiso.id, {
        cajaId,
        monto: Number(monto),
        medioPago,
        fecha,
      }),
    onSuccess: () => {
      toast.success('Compromiso pagado');
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
          <DialogTitle>Pagar compromiso</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!cajaId || !monto) return toast.error('Completá los datos');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="text-sm text-muted">
            {compromiso.concepto} · {formatearFecha(compromiso.fecha)}
          </div>
          <div className="space-y-2">
            <Label>Caja ({compromiso.moneda}) *</Label>
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
              <Label>Monto real *</Label>
              <Input
                type="number"
                step="0.01"
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
