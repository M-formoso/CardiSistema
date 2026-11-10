import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, Receipt, Trash2, Wallet } from 'lucide-react';
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
  liquidacionesService,
  type EstadoLiquidacion,
  type LiquidacionItem,
  type UpsertItemInput,
} from '@/services/liquidacionesService';
import { beneficiariosService } from '@/services/beneficiariosService';
import { obrasService } from '@/services/obrasService';
import { cajasService } from '@/services/cajasService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

const ESTADO_VARIANTE: Record<EstadoLiquidacion, 'default' | 'success' | 'warning' | 'muted'> = {
  BORRADOR: 'muted',
  APROBADA: 'warning',
  PAGADA: 'success',
  CERRADA: 'default',
};

export function LiquidacionDetallePage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [editItem, setEditItem] = useState<LiquidacionItem | null>(null);
  const [agregandoNuevo, setAgregandoNuevo] = useState(false);
  const [pagandoOpen, setPagandoOpen] = useState(false);

  const { data: liq, isLoading } = useQuery({
    queryKey: ['liquidaciones', id],
    queryFn: () => liquidacionesService.get(id!),
    enabled: !!id,
  });

  const cambiarEstadoMut = useMutation({
    mutationFn: (nuevo: EstadoLiquidacion) => liquidacionesService.cambiarEstado(id!, nuevo),
    onSuccess: () => {
      toast.success('Estado actualizado');
      qc.invalidateQueries({ queryKey: ['liquidaciones', id] });
      qc.invalidateQueries({ queryKey: ['liquidaciones'] });
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo cambiar el estado',
      ),
  });

  const eliminarItemMut = useMutation({
    mutationFn: (itemId: string) => liquidacionesService.eliminarItem(itemId),
    onSuccess: () => {
      toast.success('Empleado quitado');
      qc.invalidateQueries({ queryKey: ['liquidaciones', id] });
    },
  });

  if (isLoading || !liq) {
    return (
      <div className="text-muted">
        <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
        Cargando…
      </div>
    );
  }

  const esBorrador = liq.estado === 'BORRADOR';
  const esPagable = liq.estado === 'APROBADA' || liq.estado === 'PAGADA';
  const sinPagar = liq.items.filter((i) => !i.pagado).length;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => nav('/liquidaciones')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Semana {formatearFecha(liq.semanaInicio)} → {formatearFecha(liq.semanaFin)}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant={ESTADO_VARIANTE[liq.estado]}>{liq.estado}</Badge>
            <span className="text-sm text-muted">
              {liq.items.length} empleado{liq.items.length === 1 ? '' : 's'}
            </span>
            <span className="text-sm text-muted">·</span>
            <span className="text-sm">
              Total: <span className="font-medium num">{formatearMonto(liq.totalBruto, 'ARS')}</span>
            </span>
            <span className="text-sm text-muted">·</span>
            <span className="text-sm">
              Pagado: <span className="font-medium num">{formatearMonto(liq.totalPagado, 'ARS')}</span>
            </span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {esBorrador && (
            <>
              <Button variant="outline" onClick={() => setAgregandoNuevo(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar empleado
              </Button>
              <Button
                variant="outline"
                onClick={() => cambiarEstadoMut.mutate('APROBADA')}
                disabled={liq.items.length === 0}
              >
                Aprobar
              </Button>
            </>
          )}
          {esPagable && sinPagar > 0 && (
            <Button onClick={() => setPagandoOpen(true)}>
              <Wallet className="h-4 w-4 mr-1" />
              Pagar pendientes
            </Button>
          )}
          {liq.estado === 'PAGADA' && (
            <Button variant="outline" onClick={() => cambiarEstadoMut.mutate('CERRADA')}>
              Cerrar
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empleado</TableHead>
              <TableHead>Días</TableHead>
              <TableHead>Valor día</TableHead>
              <TableHead>Subtotal</TableHead>
              <TableHead>Desc.</TableHead>
              <TableHead>A pagar</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liq.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted py-8">
                  Sin empleados en esta semana todavía.
                </TableCell>
              </TableRow>
            )}
            {liq.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.nombreLibre}</div>
                  <div className="text-xs text-muted">
                    {item.dias.map((d) => `${d.obra.nombre} (${d.dias}d)`).join(' · ')}
                  </div>
                </TableCell>
                <TableCell className="num">{item.diasTrabajados}</TableCell>
                <TableCell className="num text-xs">{formatearMonto(item.valorDia, 'ARS')}</TableCell>
                <TableCell className="num text-xs">{formatearMonto(item.subtotal, 'ARS')}</TableCell>
                <TableCell className="num text-xs">
                  {formatearMonto(item.descuentos, 'ARS')}
                </TableCell>
                <TableCell className="num font-medium">
                  {formatearMonto(item.aPagar, 'ARS')}
                </TableCell>
                <TableCell>
                  {item.pagado ? (
                    <Badge variant="success">Pagado</Badge>
                  ) : (
                    <Badge variant="warning">Pendiente</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {esBorrador && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setEditItem(item)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('¿Quitar este empleado?'))
                              eliminarItemMut.mutate(item.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {(editItem || agregandoNuevo) && (
        <ItemFormDialog
          liquidacionId={liq.id}
          semanaInicio={liq.semanaInicio}
          semanaFin={liq.semanaFin}
          item={editItem ?? undefined}
          onClose={() => {
            setEditItem(null);
            setAgregandoNuevo(false);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['liquidaciones', id] });
            setEditItem(null);
            setAgregandoNuevo(false);
          }}
        />
      )}

      {pagandoOpen && (
        <PagarDialog
          liquidacionId={liq.id}
          itemsPendientes={liq.items.filter((i) => !i.pagado)}
          onClose={() => setPagandoOpen(false)}
          onPaid={() => {
            qc.invalidateQueries({ queryKey: ['liquidaciones', id] });
            qc.invalidateQueries({ queryKey: ['movimientos'] });
            qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
            setPagandoOpen(false);
          }}
        />
      )}

      {liq.items.some((i) => i.pagado) && (
        <div className="text-sm text-muted flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Los recibos de los empleados pagados están disponibles en la sección "Recibos".
        </div>
      )}
    </div>
  );
}

// ========== Form de item (empleado + días por obra) ==========

function ItemFormDialog({
  liquidacionId,
  semanaInicio,
  semanaFin,
  item,
  onClose,
  onSaved,
}: {
  liquidacionId: string;
  semanaInicio: string;
  semanaFin: string;
  item?: LiquidacionItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const diasSemana = useMemo(() => {
    const out: string[] = [];
    const cur = new Date(semanaInicio);
    const fin = new Date(semanaFin);
    while (cur <= fin) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [semanaInicio, semanaFin]);

  const [nombreLibre, setNombreLibre] = useState(item?.nombreLibre ?? '');
  const [beneficiarioId, setBeneficiarioId] = useState(item?.beneficiarioId ?? '');
  const [valorDia, setValorDia] = useState(item?.valorDia ?? '');
  const [descuentos, setDescuentos] = useState(item?.descuentos ?? '0');
  const [dias, setDias] = useState<Record<string, { dias: string; obraId: string }>>(() => {
    const seed: Record<string, { dias: string; obraId: string }> = {};
    diasSemana.forEach((fecha) => {
      const existente = item?.dias.find((d) => d.fecha.startsWith(fecha));
      seed[fecha] = {
        dias: existente ? existente.dias : '',
        obraId: existente?.obraId ?? '',
      };
    });
    return seed;
  });

  const { data: empleados = [] } = useQuery({
    queryKey: ['beneficiarios', { tipo: 'EMPLEADO' }],
    queryFn: () => beneficiariosService.list({ tipo: 'EMPLEADO', activo: true }),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras', { activo: true }],
    queryFn: () => obrasService.list({ activo: true }),
  });

  const totalDias = Object.values(dias).reduce((acc, d) => acc + (Number(d.dias) || 0), 0);
  const subtotal = totalDias * Number(valorDia || 0);
  const aPagar = Math.max(0, subtotal - Number(descuentos || 0));

  const m = useMutation({
    mutationFn: () => {
      const diasPayload = Object.entries(dias)
        .filter(([, d]) => Number(d.dias) > 0 && d.obraId)
        .map(([fecha, d]) => ({
          fecha,
          dias: Number(d.dias),
          obraId: d.obraId,
        }));
      if (diasPayload.length === 0) throw new Error('Cargá al menos un día trabajado en una obra');

      const payload: UpsertItemInput = {
        id: item?.id,
        beneficiarioId: beneficiarioId || undefined,
        nombreLibre: nombreLibre.trim(),
        valorDia: Number(valorDia),
        descuentos: Number(descuentos || 0),
        dias: diasPayload,
      };
      return liquidacionesService.upsertItem(liquidacionId, payload);
    },
    onSuccess: () => {
      toast.success('Empleado guardado');
      onSaved();
    },
    onError: (e) => {
      const msg =
        (e as Error).message ??
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'No se pudo guardar';
      toast.error(msg);
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar' : 'Agregar'} empleado</DialogTitle>
          <DialogDescription>
            Cargá los días por obra. El reparto a obras lo calcula el sistema al pagar.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nombreLibre.trim() || !valorDia)
              return toast.error('Nombre y valor del día son obligatorios');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nombre libre (como aparece en la planilla) *</Label>
              <Input
                value={nombreLibre}
                onChange={(e) => setNombreLibre(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Vincular con legajo (opcional)</Label>
              <Select
                value={beneficiarioId ?? ''}
                onChange={(e) => {
                  setBeneficiarioId(e.target.value);
                  const emp = empleados.find((x) => x.id === e.target.value);
                  if (emp && !nombreLibre) setNombreLibre(emp.nombre);
                }}
              >
                <option value="">Sin vincular</option>
                {empleados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor por día *</Label>
              <Input
                type="number"
                step="0.01"
                value={valorDia}
                onChange={(e) => setValorDia(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Descuentos / Vales</Label>
              <Input
                type="number"
                step="0.01"
                value={descuentos}
                onChange={(e) => setDescuentos(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Días trabajados por obra</Label>
            <div className="border border-border rounded-md divide-y">
              {diasSemana.map((fecha) => (
                <div key={fecha} className="grid grid-cols-[120px_90px_1fr] gap-2 p-2 items-center">
                  <div className="text-sm">{formatearFecha(fecha)}</div>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="1"
                    placeholder="0"
                    value={dias[fecha].dias}
                    onChange={(e) =>
                      setDias((p) => ({
                        ...p,
                        [fecha]: { ...p[fecha], dias: e.target.value },
                      }))
                    }
                    className="num text-right"
                  />
                  <Select
                    value={dias[fecha].obraId}
                    onChange={(e) =>
                      setDias((p) => ({
                        ...p,
                        [fecha]: { ...p[fecha], obraId: e.target.value },
                      }))
                    }
                  >
                    <option value="">— obra —</option>
                    {obras.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-6 text-sm">
            <div>
              Días: <span className="font-medium num">{totalDias.toFixed(2)}</span>
            </div>
            <div>
              Subtotal: <span className="font-medium num">{formatearMonto(subtotal, 'ARS')}</span>
            </div>
            <div className="text-lg">
              A pagar: <span className="font-bold num">{formatearMonto(aPagar, 'ARS')}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ========== Pagar ==========

function PagarDialog({
  liquidacionId,
  itemsPendientes,
  onClose,
  onPaid,
}: {
  liquidacionId: string;
  itemsPendientes: LiquidacionItem[];
  onClose: () => void;
  onPaid: () => void;
}) {
  const [cajaId, setCajaId] = useState('');
  const [medioPago, setMedioPago] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE_PROPIO' | 'CHEQUE_TERCERO'>('EFECTIVO');
  const [fechaPago, setFechaPago] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas', 'activas'],
    queryFn: () => cajasService.list(true),
  });
  const cajasArs = cajas.filter((c) => c.moneda === 'ARS');

  const totalPendiente = itemsPendientes.reduce((acc, i) => acc + Number(i.aPagar), 0);

  const m = useMutation({
    mutationFn: () =>
      liquidacionesService.pagar(liquidacionId, {
        cajaId,
        medioPago,
        fechaPago,
      }),
    onSuccess: () => {
      toast.success(`${itemsPendientes.length} empleado(s) pagados · recibos generados`);
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
          <DialogTitle>Pagar liquidación</DialogTitle>
          <DialogDescription>
            {itemsPendientes.length} empleado(s) pendiente(s) · Total:{' '}
            {formatearMonto(totalPendiente, 'ARS')}
          </DialogDescription>
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
            <Label>Caja (ARS) *</Label>
            <Select value={cajaId} onChange={(e) => setCajaId(e.target.value)} required>
              <option value="">Elegí…</option>
              {cajasArs.map((c) => (
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
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="CHEQUE_PROPIO">Cheque propio</option>
                <option value="CHEQUE_TERCERO">Cheque tercero</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha pago</Label>
              <Input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            Se van a generar {itemsPendientes.length} egresos (uno por empleado, imputado
            proporcionalmente a sus obras) y {itemsPendientes.length} recibos.
          </p>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar pago'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
