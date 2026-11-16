import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { proveedoresService, type ResumenHistorico } from '@/services/proveedoresService';
import { NuevoEgresoDialog } from '@/pages/movimientos/NuevoEgresoDialog';
import { MovimientoDetalleDialog } from '@/pages/billetera/MovimientoDetalleDialog';
import { formatearFecha, formatearMonto } from '@/lib/formatters';
import { CargarResumenDialog } from './CargarResumenDialog';

/**
 * Detalle de proveedor + cuenta corriente. Tres secciones:
 * 1. Resumen actual con saldos por obra.
 * 2. Historial de pagos (reutiliza el MovimientoDetalleDialog existente).
 * 3. Resúmenes históricos (expandible) con opción de eliminar el más reciente.
 */
export function ProveedorDetallePage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [cargarResumenOpen, setCargarResumenOpen] = useState(false);
  const [nuevoPagoOpen, setNuevoPagoOpen] = useState(false);
  const [detalleMovId, setDetalleMovId] = useState<string | null>(null);
  const [resumenVerId, setResumenVerId] = useState<string | null>(null);
  const [resumenesHistOpen, setResumenesHistOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['proveedor', id],
    queryFn: () => proveedoresService.get(id!),
    enabled: !!id,
  });

  const eliminarResumenMut = useMutation({
    mutationFn: (resumenId: string) => proveedoresService.eliminarResumen(id!, resumenId),
    onSuccess: () => {
      toast.success('Resumen eliminado');
      qc.invalidateQueries({ queryKey: ['proveedor', id] });
      qc.invalidateQueries({ queryKey: ['proveedores'] });
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo eliminar',
      ),
  });

  if (!id) return null;
  if (isLoading || !data) {
    return (
      <div className="py-10 text-center text-muted">
        <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
        Cargando…
      </div>
    );
  }

  const saldoNum = Number(data.saldoTotal);
  const resumenVer = data.resumenesHistoricos.find((r) => r.id === resumenVerId) ?? null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link
          to="/proveedores"
          className="text-xs text-muted hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-3 w-3" />
          Proveedores
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Truck className="h-6 w-6" />
              {data.proveedor.nombre}
              {!data.proveedor.activo && <Badge variant="muted">INACTIVO</Badge>}
            </h1>
            <div className="text-xs text-muted mt-1 space-x-3">
              {data.proveedor.cuitCuil && <span>CUIT: {data.proveedor.cuitCuil}</span>}
              {data.proveedor.rubro && <span>· {data.proveedor.rubro}</span>}
              {data.proveedor.contacto && <span>· {data.proveedor.contacto}</span>}
              {data.proveedor.condicionPago && (
                <span>· Pago: {data.proveedor.condicionPago}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted uppercase tracking-wide">Saldo actual</div>
            <div
              className={`text-3xl font-bold num ${
                saldoNum > 0.01
                  ? 'text-danger'
                  : saldoNum < -0.01
                    ? 'text-success'
                    : 'text-muted'
              }`}
            >
              {formatearMonto(saldoNum, 'ARS')}
            </div>
            {data.ultimoResumen ? (
              <div className="text-[11px] text-muted">
                al {formatearFecha(data.ultimoResumen.fecha)} ·{' '}
                {formatearMonto(data.ultimoResumen.montoTotal, 'ARS')} − pagos posteriores
              </div>
            ) : (
              <div className="text-[11px] text-warning">
                Sin resumen cargado · el saldo es solo pagos hechos
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <Button onClick={() => setNuevoPagoOpen(true)}>
            <Wallet className="h-4 w-4 mr-1" />
            Nuevo pago
          </Button>
          <Button variant="outline" onClick={() => setCargarResumenOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Cargar nuevo resumen
          </Button>
        </div>
      </div>

      {/* Sección 1: Saldos por obra (del último resumen − pagos posteriores) */}
      {!data.ultimoResumen && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
          <strong>Sin resumen cargado.</strong> Para ver el saldo real por obra, cargá el primer
          resumen que te mande el proveedor con "Cargar nuevo resumen".
        </div>
      )}
      {data.ultimoResumen && (
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Saldo por obra
              </h2>
              <p className="text-xs text-muted">
                Último resumen al {formatearFecha(data.ultimoResumen.fecha)} · total{' '}
                {formatearMonto(data.ultimoResumen.montoTotal, 'ARS')}
              </p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obra</TableHead>
                <TableHead className="text-right">Resumen</TableHead>
                <TableHead className="text-right">Pagado posterior</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.saldosPorObra.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted py-6">
                    El resumen no tiene líneas.
                  </TableCell>
                </TableRow>
              )}
              {data.saldosPorObra.map((s) => {
                const sNum = Number(s.saldo);
                return (
                  <TableRow key={s.obraId}>
                    <TableCell className="text-sm">{s.nombre}</TableCell>
                    <TableCell className="text-right num">
                      {formatearMonto(s.montoResumen, 'ARS')}
                    </TableCell>
                    <TableCell className="text-right num text-muted">
                      {formatearMonto(s.pagado, 'ARS')}
                    </TableCell>
                    <TableCell
                      className={`text-right num font-semibold ${
                        sNum > 0.01
                          ? 'text-danger'
                          : sNum < -0.01
                            ? 'text-success'
                            : 'text-muted'
                      }`}
                    >
                      {formatearMonto(sNum, 'ARS')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      )}

      {/* Sección 2: Historial de pagos */}
      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Pagos a este proveedor
          </h2>
          <p className="text-xs text-muted">
            {data.pagos.length} pago{data.pagos.length === 1 ? '' : 's'} · click en una fila para
            ver el detalle y poder editar o anular
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Caja</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Obras</TableHead>
              <TableHead>Cheque</TableHead>
              <TableHead>Descripción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.pagos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted py-8 text-sm">
                  Sin pagos registrados. Usá "Nuevo pago" para empezar.
                </TableCell>
              </TableRow>
            )}
            {data.pagos.map((p) => {
              const obras = p.imputaciones.map((i) => i.obraNombre).join(' · ');
              return (
                <TableRow
                  key={p.id}
                  onClick={() => setDetalleMovId(p.id)}
                  className="cursor-pointer hover:bg-muted/5"
                >
                  <TableCell className="num text-xs">{formatearFecha(p.fecha)}</TableCell>
                  <TableCell className="text-xs">{p.caja.nombre}</TableCell>
                  <TableCell className="text-right num font-medium">
                    {formatearMonto(p.monto, p.moneda)}
                  </TableCell>
                  <TableCell className="text-xs max-w-[220px] truncate">{obras}</TableCell>
                  <TableCell className="text-xs">
                    {p.cheque ? (
                      <span className="font-mono text-primary">#{p.cheque.numero}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-xs truncate">
                    {p.descripcion ?? '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      {/* Sección 3: Resúmenes históricos (colapsable) */}
      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setResumenesHistOpen((v) => !v)}
          className="w-full px-4 py-3 border-b border-border flex items-center justify-between hover:bg-muted/5 text-left"
        >
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Resúmenes históricos
            </h2>
            <p className="text-xs text-muted">
              {data.resumenesHistoricos.length} resumen
              {data.resumenesHistoricos.length === 1 ? '' : 'es'} cargado
              {data.resumenesHistoricos.length === 1 ? '' : 's'}
            </p>
          </div>
          {resumenesHistOpen ? (
            <ChevronDown className="h-4 w-4 text-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted" />
          )}
        </button>
        {resumenesHistOpen && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Monto total</TableHead>
                <TableHead>Observaciones</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.resumenesHistoricos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted py-6 text-sm">
                    Sin resúmenes cargados.
                  </TableCell>
                </TableRow>
              )}
              {data.resumenesHistoricos.map((r, idx) => (
                <TableRow key={r.id}>
                  <TableCell className="num text-xs">{formatearFecha(r.fecha)}</TableCell>
                  <TableCell className="text-right num font-medium">
                    {formatearMonto(r.montoTotal, 'ARS')}
                  </TableCell>
                  <TableCell className="text-xs text-muted truncate max-w-xs">
                    {r.observaciones ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setResumenVerId(r.id)}
                    >
                      Ver desglose
                    </Button>
                    {idx === 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`¿Eliminar el resumen del ${formatearFecha(r.fecha)}?`))
                            eliminarResumenMut.mutate(r.id);
                        }}
                        title="Eliminar (solo el más reciente)"
                      >
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Dialogs */}
      {cargarResumenOpen && (
        <CargarResumenDialog
          proveedorId={id}
          onClose={() => setCargarResumenOpen(false)}
        />
      )}
      {nuevoPagoOpen && (
        <NuevoEgresoDialog
          open
          onOpenChange={(v) => !v && setNuevoPagoOpen(false)}
          onCreated={() => {
            setNuevoPagoOpen(false);
            qc.invalidateQueries({ queryKey: ['proveedor', id] });
            qc.invalidateQueries({ queryKey: ['proveedores'] });
            qc.invalidateQueries({ queryKey: ['movimientos'] });
            qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
          }}
          beneficiarioInicialId={id}
          ocultarCategoria
          imputacionesSugeridas={data.saldosPorObra.map((s) => ({
            obraId: s.obraId,
            nombre: s.nombre,
            saldoPendiente: Number(s.saldo),
          }))}
        />
      )}
      <MovimientoDetalleDialog
        movimientoId={detalleMovId}
        onClose={() => setDetalleMovId(null)}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ['proveedor', id] });
          qc.invalidateQueries({ queryKey: ['proveedores'] });
        }}
      />
      {resumenVer && (
        <ResumenHistoricoDialog resumen={resumenVer} onClose={() => setResumenVerId(null)} />
      )}
    </div>
  );
}

function ResumenHistoricoDialog({
  resumen,
  onClose,
}: {
  resumen: ResumenHistorico;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resumen al {formatearFecha(resumen.fecha)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm">
            Total: <span className="font-semibold num">{formatearMonto(resumen.montoTotal, 'ARS')}</span>
          </div>
          {resumen.observaciones && (
            <div className="text-xs text-muted border border-border rounded p-2 bg-muted/5">
              {resumen.observaciones}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obra</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumen.items.map((it) => (
                <TableRow key={it.obraId}>
                  <TableCell className="text-sm">{it.obraNombre}</TableCell>
                  <TableCell className="text-right num">
                    {formatearMonto(it.monto, 'ARS')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
