import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Pencil, XCircle, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { movimientosService, type Movimiento } from '@/services/movimientosService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

const ESTADO_VARIANTE: Record<Movimiento['estado'], 'default' | 'success' | 'warning' | 'muted' | 'danger'> = {
  CONFIRMADO: 'success',
  ANULADO: 'danger',
  REVERSA: 'muted',
};

const TIPO_VARIANTE: Record<Movimiento['tipo'], 'default' | 'success' | 'warning' | 'muted' | 'danger'> = {
  INGRESO: 'success',
  EGRESO: 'danger',
  TRANSFERENCIA: 'default',
  CAMBIO_MONEDA: 'default',
  AJUSTE: 'muted',
};

const MEDIO_LABEL: Record<Movimiento['medioPago'], string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE_PROPIO: 'Cheque propio',
  CHEQUE_TERCERO: 'Cheque de tercero',
};

/**
 * Modal de detalle de un movimiento. Muestra TODO (fecha, caja, monto,
 * equivalente, medio de pago, obras imputadas, beneficiario, categoría,
 * cheque linkeado si hay, metadata) y permite anular con motivo.
 * La edición queda para el próximo paso (necesita endpoint nuevo).
 */
export function MovimientoDetalleDialog({
  movimientoId,
  onClose,
  onChanged,
}: {
  movimientoId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const open = movimientoId !== null;
  const qc = useQueryClient();
  const [modoAnular, setModoAnular] = useState(false);
  const [motivo, setMotivo] = useState('');

  const { data: mov, isLoading } = useQuery({
    queryKey: ['movimiento', movimientoId],
    queryFn: () => movimientosService.get(movimientoId!),
    enabled: !!movimientoId,
  });

  const anularMut = useMutation({
    mutationFn: () => movimientosService.anular(movimientoId!, motivo.trim()),
    onSuccess: () => {
      toast.success('Movimiento anulado');
      qc.invalidateQueries({ queryKey: ['movimientos'] });
      qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
      qc.invalidateQueries({ queryKey: ['movimiento', movimientoId] });
      onChanged();
      handleClose();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo anular',
      ),
  });

  function handleClose() {
    setModoAnular(false);
    setMotivo('');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalle del movimiento
            {mov && (
              <>
                <Badge variant={TIPO_VARIANTE[mov.tipo]}>{mov.tipo}</Badge>
                <Badge variant={ESTADO_VARIANTE[mov.estado]}>{mov.estado}</Badge>
              </>
            )}
          </DialogTitle>
          {mov && (
            <DialogDescription>
              {formatearFecha(mov.fecha)} · {mov.caja?.nombre ?? 'Caja —'}
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading && (
          <div className="py-10 text-center text-muted">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
            Cargando…
          </div>
        )}

        {mov && !isLoading && (
          <div className="space-y-4 text-sm">
            {/* Montos */}
            <section className="rounded-lg border border-border p-3 bg-muted/5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted uppercase tracking-wide mb-1">Monto</div>
                  <div className="text-2xl font-bold num">
                    {formatearMonto(mov.monto, mov.moneda)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted uppercase tracking-wide mb-1">Equivalente</div>
                  <div className="text-lg num text-muted">
                    {mov.moneda === 'ARS'
                      ? formatearMonto(mov.montoUsd, 'USD')
                      : formatearMonto(mov.montoArs, 'ARS')}
                  </div>
                  <div className="text-[11px] text-muted">
                    Cotización: 1 USD = $ {Number(mov.cotizacion).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </section>

            {/* Caja + medio */}
            <section className="grid grid-cols-2 gap-3">
              <Campo label="Caja" value={mov.caja?.nombre ?? '—'} />
              <Campo label="Medio de pago" value={MEDIO_LABEL[mov.medioPago]} />
            </section>

            {/* Beneficiario + categoría */}
            <section className="grid grid-cols-2 gap-3">
              <Campo
                label={mov.tipo === 'INGRESO' ? 'Origen (quién envía)' : 'Beneficiario'}
                value={mov.beneficiario?.nombre ?? '—'}
                hint={mov.beneficiario?.tipo}
              />
              <Campo label="Categoría" value={mov.categoria?.nombre ?? '—'} hint={mov.categoria?.codigo} />
            </section>

            {/* Descripción */}
            {mov.descripcion && (
              <section>
                <Campo label="Descripción" value={mov.descripcion} />
              </section>
            )}

            {/* Cheque linkeado */}
            {mov.cheque && (
              <section className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wide">
                  <FileText className="h-3.5 w-3.5" />
                  Cheque asociado
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted">N°</span> <span className="font-mono">{mov.cheque.numero}</span></div>
                  <div><span className="text-muted">Banco:</span> {mov.cheque.banco ?? '—'}</div>
                  <div><span className="text-muted">Librador:</span> {mov.cheque.librador ?? mov.cheque.titular ?? '—'}</div>
                  <div><span className="text-muted">Pago:</span> {formatearFecha(mov.cheque.fechaPago)}</div>
                  <div><span className="text-muted">Estado:</span> <Badge variant="muted">{mov.cheque.estado}</Badge></div>
                  <div><span className="text-muted">Tipo:</span> {mov.cheque.tipo}</div>
                </div>
              </section>
            )}

            {/* Obras imputadas (egresos) */}
            {mov.imputaciones && mov.imputaciones.length > 0 && (
              <section>
                <div className="text-xs text-muted uppercase tracking-wide mb-2">
                  Imputación a obra{mov.imputaciones.length > 1 ? 's' : ''}
                </div>
                <div className="space-y-1">
                  {mov.imputaciones.map((i) => (
                    <div
                      key={i.obraId}
                      className="flex items-center justify-between rounded bg-muted/10 px-3 py-1.5 text-xs"
                    >
                      <span className="font-medium">{i.obra.nombre}</span>
                      <span className="num">
                        {formatearMonto(i.monto, mov.moneda)}
                        <span className="text-muted ml-2">({Number(i.porcentaje).toFixed(2)}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Obra ingreso (ingresos) */}
            {mov.obraIngreso && (
              <section>
                <Campo label="Obra" value={mov.obraIngreso.nombre} />
              </section>
            )}

            {/* Metadata */}
            <section className="text-[11px] text-muted border-t border-border pt-3">
              <div>
                Creado{mov.createdBy ? ` por ${mov.createdBy.nombre}` : ''} el{' '}
                {new Date(mov.createdAt).toLocaleString('es-AR')}
              </div>
              {mov.estado === 'ANULADO' && mov.anuladoAt && (
                <div className="text-danger mt-1 flex items-start gap-1">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div>
                    Anulado{mov.anuladoPor ? ` por ${mov.anuladoPor.nombre}` : ''} el{' '}
                    {new Date(mov.anuladoAt).toLocaleString('es-AR')}
                    {mov.motivoAnulacion && (
                      <div className="italic">Motivo: {mov.motivoAnulacion}</div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Modo anular: textarea de motivo inline */}
            {modoAnular && (
              <section className="rounded-lg border border-danger/40 bg-danger/5 p-3 space-y-2">
                <Label className="text-sm font-semibold text-danger">
                  Motivo de la anulación *
                </Label>
                <Textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={2}
                  placeholder="Ej: cargado por error, cliente devolvió el pago…"
                  autoFocus
                />
                <p className="text-[11px] text-muted">
                  La anulación crea un movimiento de REVERSA. El original queda en estado ANULADO
                  con el motivo y la fecha. No se borra nada.
                </p>
              </section>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {mov?.estado === 'CONFIRMADO' && !modoAnular && (
            <>
              <Button
                variant="outline"
                disabled
                title="Próximamente — por ahora anulá y volvé a cargar"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
              <Button variant="danger" onClick={() => setModoAnular(true)}>
                <XCircle className="h-4 w-4 mr-1" />
                Anular
              </Button>
            </>
          )}
          {modoAnular && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setModoAnular(false);
                  setMotivo('');
                }}
              >
                Cancelar anulación
              </Button>
              <Button
                variant="danger"
                disabled={motivo.trim().length < 3 || anularMut.isPending}
                onClick={() => anularMut.mutate()}
              >
                {anularMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Confirmar anulación'
                )}
              </Button>
            </>
          )}
          {!modoAnular && (
            <Button variant="outline" onClick={handleClose}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-xs text-muted uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm">
        {value}
        {hint && <span className="text-[11px] text-muted ml-2">· {hint}</span>}
      </div>
    </div>
  );
}
