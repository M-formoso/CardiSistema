import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, Printer, Receipt, Trash2, Wallet } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
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
  SIGNO_CONCEPTO,
  ETIQUETA_CONCEPTO,
  type ConceptoInput,
  type EstadoLiquidacion,
  type LiquidacionItem,
  type TipoConcepto,
  type UpsertItemInput,
} from '@/services/liquidacionesService';
import { empleadosService } from '@/services/empleadosService';
import { prestamosEmpleadosService } from '@/services/prestamosEmpleadosService';
import { obrasService } from '@/services/obrasService';
import { cajasService } from '@/services/cajasService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

const ESTADO_VARIANTE: Record<EstadoLiquidacion, 'default' | 'success' | 'warning' | 'muted'> = {
  BORRADOR: 'muted',
  APROBADA: 'warning',
  PAGADA_PARCIAL: 'warning',
  PAGADA: 'success',
  CERRADA: 'default',
};

const ESTADO_LABEL: Record<EstadoLiquidacion, string> = {
  BORRADOR: 'Borrador',
  APROBADA: 'Aprobada',
  PAGADA_PARCIAL: 'Pagada parcial',
  PAGADA: 'Pagada',
  CERRADA: 'Cerrada',
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
      toast.success('Recibo quitado');
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
  const esPagable = liq.estado === 'APROBADA' || liq.estado === 'PAGADA_PARCIAL';
  const saldo = Number(liq.totalAPagar) - Number(liq.totalPagado);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => nav('/pagos?tab=liquidaciones')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {(liq.obra?.nombre ?? 'Sin obra')} · Semana {formatearFecha(liq.semanaInicio)} →{' '}
            {formatearFecha(liq.semanaFin)}
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge variant={ESTADO_VARIANTE[liq.estado]}>{ESTADO_LABEL[liq.estado]}</Badge>
            <span className="text-sm text-muted">
              {liq.items.length} recibo{liq.items.length === 1 ? '' : 's'}
            </span>
            <span className="text-sm text-muted">·</span>
            <span className="text-sm">
              Total a pagar:{' '}
              <span className="font-medium num">{formatearMonto(liq.totalAPagar, 'ARS')}</span>
            </span>
            <span className="text-sm text-muted">·</span>
            <span className="text-sm">
              Pagado:{' '}
              <span className="font-medium num">{formatearMonto(liq.totalPagado, 'ARS')}</span>
            </span>
            {saldo !== 0 && (
              <>
                <span className="text-sm text-muted">·</span>
                <span className={`text-sm ${saldo > 0 ? 'text-warning' : 'text-success'}`}>
                  {saldo > 0 ? 'Saldo pendiente' : 'A favor'}:{' '}
                  <span className="font-medium num">{formatearMonto(Math.abs(saldo), 'ARS')}</span>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {esBorrador && (
            <>
              <Button variant="outline" onClick={() => setAgregandoNuevo(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Agregar recibo
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
          {/* El recibo se descarga solo cuando ya hubo pago (parcial o total) */}
          {liq.items.length > 0 &&
            (liq.estado === 'PAGADA_PARCIAL' ||
              liq.estado === 'PAGADA' ||
              liq.estado === 'CERRADA') && (
              <Button variant="outline" onClick={() => imprimirRecibos(liq.id)}>
                <Printer className="h-4 w-4 mr-1" />
                Imprimir recibos
              </Button>
            )}
          {esPagable && saldo > 0 && (
            <Button onClick={() => setPagandoOpen(true)}>
              <Wallet className="h-4 w-4 mr-1" />
              Pagar
            </Button>
          )}
          {liq.estado === 'PAGADA' && (
            <Button variant="outline" onClick={() => cambiarEstadoMut.mutate('CERRADA')}>
              Cerrar
            </Button>
          )}
        </div>
      </div>

      {/* Recibos */}
      <div className="space-y-3">
        {liq.items.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted">
            Sin recibos todavía. Agregá el primero.
          </div>
        )}
        {liq.items.map((item) => (
          <ReciboCard
            key={item.id}
            item={item}
            esBorrador={esBorrador}
            onEditar={() => setEditItem(item)}
            onEliminar={() => {
              if (confirm(`¿Quitar el recibo de ${item.nombreLibre}?`))
                eliminarItemMut.mutate(item.id);
            }}
          />
        ))}
      </div>

      {/* Pagos realizados */}
      {liq.pagos.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Pagos registrados</h2>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Caja</TableHead>
                  <TableHead>Medio</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liq.pagos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatearFecha(p.fecha)}</TableCell>
                    <TableCell>{p.caja?.nombre ?? '—'}</TableCell>
                    <TableCell>{p.medioPago}</TableCell>
                    <TableCell className="num text-right font-medium">
                      {formatearMonto(p.monto, 'ARS')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {(editItem || agregandoNuevo) && (
        <ReciboFormDialog
          liquidacionId={liq.id}
          obraPorDefecto={{ id: liq.obraId, nombre: liq.obra?.nombre ?? 'Sin obra' }}
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
          saldoPendiente={saldo}
          onClose={() => setPagandoOpen(false)}
          onPaid={() => {
            qc.invalidateQueries({ queryKey: ['liquidaciones', id] });
            qc.invalidateQueries({ queryKey: ['liquidaciones'] });
            qc.invalidateQueries({ queryKey: ['movimientos'] });
            qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
            setPagandoOpen(false);
          }}
        />
      )}

      {liq.estado === 'PAGADA' && (
        <div className="text-sm text-muted flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Los recibos individuales se generaron al confirmar el pago total.
        </div>
      )}
    </div>
  );
}

/**
 * Descarga el PDF compacto con todos los recibos de la liquidación y lo
 * abre en una ventana nueva. Usa apiClient para llevar el token JWT.
 */
async function imprimirRecibos(liquidacionId: string) {
  try {
    const res = await apiClient.get(`/recibos/liquidacion/${liquidacionId}/pdf`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
    // El URL se mantiene hasta que se cierre la ventana; el browser lo libera.
  } catch (e) {
    toast.error(
      (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'No se pudo generar el PDF',
    );
  }
}

// ========== Card por recibo ==========

function ReciboCard({
  item,
  esBorrador,
  onEditar,
  onEliminar,
}: {
  item: LiquidacionItem;
  esBorrador: boolean;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-lg">{item.nombreLibre}</span>
            {item.pagado ? (
              <Badge variant="success">Pagado</Badge>
            ) : (
              <Badge variant="warning">Pendiente</Badge>
            )}
          </div>
          {item.beneficiario && (
            <div className="text-xs text-muted">Vinculado a legajo</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs text-muted">A pagar</div>
            <div className="text-lg font-bold num">{formatearMonto(item.aPagar, 'ARS')}</div>
          </div>
          {esBorrador && (
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={onEditar}>
                Editar
              </Button>
              <Button variant="ghost" size="icon" onClick={onEliminar}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {item.conceptos.length > 0 && (
        <div className="divide-y divide-border border-t border-border">
          {item.conceptos.map((c) => {
            const monto = Number(c.monto);
            const signo = SIGNO_CONCEPTO[c.tipo];
            return (
              <div key={c.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="muted" className="text-xs">
                      {ETIQUETA_CONCEPTO[c.tipo]}
                    </Badge>
                    <span className="truncate">{c.descripcion}</span>
                    {c.obra && c.obra.id !== undefined && (
                      <span className="text-xs text-muted">→ {c.obra.nombre}</span>
                    )}
                  </div>
                  {c.cantidad && c.valorUnitario && (
                    <div className="text-xs text-muted">
                      {Number(c.cantidad)} × {formatearMonto(c.valorUnitario, 'ARS')}
                    </div>
                  )}
                </div>
                <div
                  className={`num font-medium ${
                    signo === 0 ? 'text-muted' : monto < 0 ? 'text-warning' : ''
                  }`}
                >
                  {signo === 0 ? '—' : formatearMonto(monto, 'ARS')}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ========== Form de recibo (persona + conceptos) ==========

type ConceptoBorrador = ConceptoInput & { _key: string };

function nuevoConcepto(tipo: TipoConcepto = 'JORNAL'): ConceptoBorrador {
  return {
    _key: Math.random().toString(36).slice(2),
    tipo,
    descripcion: ETIQUETA_CONCEPTO[tipo],
    cantidad: tipo === 'JORNAL' || tipo === 'HORAS_EXTRA' ? 0 : undefined,
    valorUnitario: tipo === 'JORNAL' || tipo === 'HORAS_EXTRA' ? 0 : undefined,
    monto: 0,
  };
}

function ReciboFormDialog({
  liquidacionId,
  obraPorDefecto,
  item,
  onClose,
  onSaved,
}: {
  liquidacionId: string;
  obraPorDefecto: { id: string; nombre: string };
  item?: LiquidacionItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombreLibre, setNombreLibre] = useState(item?.nombreLibre ?? '');
  const [beneficiarioId, setBeneficiarioId] = useState(item?.beneficiarioId ?? '');
  const [observaciones, setObservaciones] = useState(item?.observaciones ?? '');
  const [conceptos, setConceptos] = useState<ConceptoBorrador[]>(() => {
    if (item && item.conceptos.length > 0) {
      return item.conceptos.map((c) => ({
        _key: c.id,
        tipo: c.tipo,
        descripcion: c.descripcion,
        cantidad: c.cantidad != null ? Number(c.cantidad) : undefined,
        valorUnitario: c.valorUnitario != null ? Number(c.valorUnitario) : undefined,
        monto: Math.abs(Number(c.monto)),
        obraId: c.obraId ?? undefined,
        prestamoId: c.prestamoId ?? undefined,
        orden: c.orden,
      }));
    }
    return [nuevoConcepto('JORNAL')];
  });

  const { data: empleados = [] } = useQuery({
    queryKey: ['empleados', { activo: true }],
    queryFn: () => empleadosService.list({ activo: true }),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras', { activo: true }],
    queryFn: () => obrasService.list({ activo: true }),
  });
  const { data: prestamosVigentes = [] } = useQuery({
    queryKey: ['prestamos-vigentes', beneficiarioId],
    queryFn: () => prestamosEmpleadosService.vigentesDe(beneficiarioId),
    enabled: !!beneficiarioId,
  });

  const empleadoSel = useMemo(
    () => empleados.find((e) => e.id === beneficiarioId),
    [empleados, beneficiarioId],
  );

  const totales = useMemo(() => {
    let sumaPositivos = 0;
    let sumaNegativos = 0;
    for (const c of conceptos) {
      const signo = SIGNO_CONCEPTO[c.tipo];
      const monto = Math.abs(Number(c.monto) || 0);
      if (signo === 1) sumaPositivos += monto;
      if (signo === -1) sumaNegativos += monto;
    }
    return { sumaPositivos, sumaNegativos, aPagar: sumaPositivos - sumaNegativos };
  }, [conceptos]);

  const guardar = useMutation({
    mutationFn: () => {
      if (!nombreLibre.trim()) throw new Error('El nombre es obligatorio');
      if (conceptos.length === 0) throw new Error('Agregá al menos un concepto');
      for (const c of conceptos) {
        if (!c.descripcion.trim()) throw new Error('Cada concepto necesita descripción');
        if (c.tipo === 'PRESTAMO_APLICACION' && !c.prestamoId) {
          throw new Error('El descuento de préstamo requiere elegir un préstamo');
        }
      }

      const payload: UpsertItemInput = {
        id: item?.id,
        beneficiarioId: beneficiarioId || undefined,
        nombreLibre: nombreLibre.trim(),
        observaciones: observaciones.trim() || undefined,
        conceptos: conceptos.map((c, idx) => ({
          tipo: c.tipo,
          descripcion: c.descripcion.trim(),
          cantidad: c.cantidad != null && c.cantidad > 0 ? c.cantidad : undefined,
          valorUnitario: c.valorUnitario != null && c.valorUnitario > 0 ? c.valorUnitario : undefined,
          monto: Math.abs(c.monto),
          obraId: c.obraId,
          prestamoId: c.prestamoId,
          orden: idx,
        })),
      };
      return liquidacionesService.upsertItem(liquidacionId, payload);
    },
    onSuccess: () => {
      toast.success('Recibo guardado');
      onSaved();
    },
    onError: (e) => {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (e as Error).message ??
        'No se pudo guardar';
      toast.error(msg);
    },
  });

  const agregarConcepto = (tipo: TipoConcepto) => {
    const c = nuevoConcepto(tipo);
    // Jornal: autocompletar valor desde el empleado si hay
    if (tipo === 'JORNAL' && empleadoSel?.legajo?.jornal) {
      c.valorUnitario = Number(empleadoSel.legajo.jornal);
    }
    if (tipo === 'HORAS_EXTRA' && empleadoSel?.legajo?.valorHoraExtra) {
      c.valorUnitario = Number(empleadoSel.legajo.valorHoraExtra);
    }
    setConceptos((prev) => [...prev, c]);
  };

  const actualizarConcepto = (key: string, patch: Partial<ConceptoBorrador>) => {
    setConceptos((prev) =>
      prev.map((c) => {
        if (c._key !== key) return c;
        const next = { ...c, ...patch };
        // Autocalcular monto si cantidad y valorUnitario presentes
        if (next.cantidad != null && next.valorUnitario != null && ('cantidad' in patch || 'valorUnitario' in patch)) {
          next.monto = Number(next.cantidad) * Number(next.valorUnitario);
        }
        return next;
      }),
    );
  };

  const quitarConcepto = (key: string) => {
    setConceptos((prev) => prev.filter((c) => c._key !== key));
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar' : 'Agregar'} recibo</DialogTitle>
          <DialogDescription>
            Una persona con sus conceptos tipados. Jornal, horas extra, viáticos, certificaciones a
            otras obras, préstamos entregados o descontados, etc.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardar.mutate();
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
              <Label>Vincular con empleado (opcional)</Label>
              <Select
                value={beneficiarioId}
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

          {/* Préstamos vigentes del empleado — sugerencia */}
          {prestamosVigentes.length > 0 && (
            <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
              <div className="font-medium mb-1">
                Préstamos vigentes de {empleadoSel?.nombre ?? 'este empleado'}:
              </div>
              <ul className="space-y-1">
                {prestamosVigentes.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <span>
                      {formatearFecha(p.fecha)} · Saldo:{' '}
                      <span className="font-medium num">
                        {formatearMonto(p.saldoPendiente, 'ARS')}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => {
                        const c = nuevoConcepto('PRESTAMO_APLICACION');
                        c.descripcion = `Descuento préstamo ${formatearFecha(p.fecha)}`;
                        c.monto = Number(p.saldoPendiente);
                        c.prestamoId = p.id;
                        setConceptos((prev) => [...prev, c]);
                      }}
                    >
                      Descontar
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lista editable de conceptos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Conceptos del recibo</Label>
              <div className="flex gap-1 flex-wrap">
                <BotonAgregar onAdd={agregarConcepto} />
              </div>
            </div>
            <div className="border border-border rounded-md divide-y">
              {conceptos.map((c) => (
                <ConceptoRow
                  key={c._key}
                  concepto={c}
                  obras={obras}
                  prestamosVigentes={prestamosVigentes}
                  obraPorDefectoNombre={obraPorDefecto.nombre}
                  onChange={(patch) => actualizarConcepto(c._key, patch)}
                  onDelete={() => quitarConcepto(c._key)}
                />
              ))}
              {conceptos.length === 0 && (
                <div className="p-4 text-center text-sm text-muted">
                  Sin conceptos. Agregá uno arriba.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Input
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej. firma pendiente, pagado con cheque X…"
            />
          </div>

          <div className="flex items-center justify-end gap-6 text-sm border-t border-border pt-3">
            <div>
              Positivos:{' '}
              <span className="font-medium num">{formatearMonto(totales.sumaPositivos, 'ARS')}</span>
            </div>
            {totales.sumaNegativos > 0 && (
              <div className="text-warning">
                Descuentos:{' '}
                <span className="font-medium num">
                  −{formatearMonto(totales.sumaNegativos, 'ARS')}
                </span>
              </div>
            )}
            <div className="text-lg">
              A pagar:{' '}
              <span className="font-bold num">{formatearMonto(totales.aPagar, 'ARS')}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardar.isPending}>
              {guardar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar recibo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Botón que despliega lista de conceptos a agregar
function BotonAgregar({ onAdd }: { onAdd: (tipo: TipoConcepto) => void }) {
  const tipos: TipoConcepto[] = [
    'JORNAL',
    'HORAS_EXTRA',
    'VIATICO',
    'VACACIONES',
    'CERTIFICACION',
    'SUELDO',
    'PRESTAMO_ENTREGADO',
    'DEDUCCION',
    'VALE',
    'NOTA_SALDO',
  ];
  return (
    <Select onChange={(e) => e.target.value && onAdd(e.target.value as TipoConcepto)} value="">
      <option value="">+ Agregar concepto…</option>
      {tipos.map((t) => (
        <option key={t} value={t}>
          {ETIQUETA_CONCEPTO[t]}
        </option>
      ))}
    </Select>
  );
}

function ConceptoRow({
  concepto,
  obras,
  prestamosVigentes,
  obraPorDefectoNombre,
  onChange,
  onDelete,
}: {
  concepto: ConceptoBorrador;
  obras: Array<{ id: string; nombre: string }>;
  prestamosVigentes: Array<{ id: string; fecha: string; saldoPendiente: string }>;
  obraPorDefectoNombre: string;
  onChange: (patch: Partial<ConceptoBorrador>) => void;
  onDelete: () => void;
}) {
  const signo = SIGNO_CONCEPTO[concepto.tipo];
  const usaCantidad = ['JORNAL', 'JORNAL_ESPECIAL', 'HORAS_EXTRA', 'VIATICO'].includes(concepto.tipo);
  const permiteObraDistinta = ['CERTIFICACION', 'JORNAL_ESPECIAL'].includes(concepto.tipo);

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={signo === -1 ? 'warning' : signo === 0 ? 'muted' : 'default'} className="text-xs">
          {ETIQUETA_CONCEPTO[concepto.tipo]}
        </Badge>
        {signo === -1 && <span className="text-xs text-warning">(descuenta)</span>}
        {signo === 0 && <span className="text-xs text-muted">(informativo)</span>}
        <div className="flex-1" />
        <Button variant="ghost" size="icon" type="button" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-12 md:col-span-5 space-y-1">
          <Label className="text-xs">Descripción</Label>
          <Input
            value={concepto.descripcion}
            onChange={(e) => onChange({ descripcion: e.target.value })}
            placeholder="Semana, Boleto, Vacaciones…"
          />
        </div>
        {usaCantidad && (
          <>
            <div className="col-span-4 md:col-span-2 space-y-1">
              <Label className="text-xs">Cantidad</Label>
              <Input
                type="number"
                step="0.01"
                value={concepto.cantidad ?? ''}
                onChange={(e) =>
                  onChange({
                    cantidad: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="col-span-4 md:col-span-2 space-y-1">
              <Label className="text-xs">Valor unit.</Label>
              <Input
                type="number"
                step="0.01"
                value={concepto.valorUnitario ?? ''}
                onChange={(e) =>
                  onChange({
                    valorUnitario: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
          </>
        )}
        <div className={`${usaCantidad ? 'col-span-4 md:col-span-3' : 'col-span-6 md:col-span-7'} space-y-1`}>
          <Label className="text-xs">Monto {signo === -1 && '(se resta)'}</Label>
          <Input
            type="number"
            step="0.01"
            value={concepto.monto ?? 0}
            onChange={(e) => onChange({ monto: Number(e.target.value) })}
            disabled={signo === 0}
          />
        </div>
      </div>

      {permiteObraDistinta && (
        <div className="space-y-1">
          <Label className="text-xs">
            Imputar a obra (opcional — default: {obraPorDefectoNombre})
          </Label>
          <Select
            value={concepto.obraId ?? ''}
            onChange={(e) => onChange({ obraId: e.target.value || undefined })}
          >
            <option value="">Obra de la liquidación</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </Select>
        </div>
      )}

      {concepto.tipo === 'PRESTAMO_APLICACION' && (
        <div className="space-y-1">
          <Label className="text-xs">Préstamo *</Label>
          <Select
            value={concepto.prestamoId ?? ''}
            onChange={(e) => onChange({ prestamoId: e.target.value || undefined })}
            required
          >
            <option value="">Elegí un préstamo vigente…</option>
            {prestamosVigentes.map((p) => (
              <option key={p.id} value={p.id}>
                {formatearFecha(p.fecha)} · Saldo {formatearMonto(p.saldoPendiente, 'ARS')}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}

// ========== Pagar ==========

function PagarDialog({
  liquidacionId,
  saldoPendiente,
  onClose,
  onPaid,
}: {
  liquidacionId: string;
  saldoPendiente: number;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [cajaId, setCajaId] = useState('');
  const [medioPago, setMedioPago] = useState<
    'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE_PROPIO' | 'CHEQUE_TERCERO'
  >('EFECTIVO');
  const [fechaPago, setFechaPago] = useState(() => new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState<string>(saldoPendiente.toFixed(2));
  const [observaciones, setObservaciones] = useState('');

  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas', 'activas'],
    queryFn: () => cajasService.list(true),
  });
  const cajasArs = cajas.filter((c) => c.moneda === 'ARS');

  const esParcial = Number(monto) > 0 && Number(monto) < saldoPendiente;

  const m = useMutation({
    mutationFn: () =>
      liquidacionesService.pagar(liquidacionId, {
        cajaId,
        medioPago,
        fechaPago,
        monto: Number(monto),
        observaciones: observaciones.trim() || undefined,
      }),
    onSuccess: (data) => {
      toast.success(
        data.estado === 'PAGADA'
          ? `Pago registrado · liquidación cerrada · ${data.recibosCreados.length} recibos emitidos`
          : `Pago parcial registrado · saldo $${data.saldoPendiente}`,
      );
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
            Saldo pendiente: <span className="font-medium num">{formatearMonto(saldoPendiente, 'ARS')}</span>.
            Podés pagar total o parcial.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!cajaId) return toast.error('Elegí una caja');
            if (Number(monto) <= 0) return toast.error('El monto debe ser mayor a 0');
            if (Number(monto) > saldoPendiente)
              return toast.error('El monto no puede superar el saldo pendiente');
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
              <Label>Fecha</Label>
              <Input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Monto a pagar *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={saldoPendiente}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
            {esParcial && (
              <p className="text-xs text-warning">
                Pago parcial · quedará saldo{' '}
                {formatearMonto(saldoPendiente - Number(monto), 'ARS')}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Input
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas internas del pago"
            />
          </div>
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
