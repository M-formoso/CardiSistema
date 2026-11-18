import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Car, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { vehiculosService } from '@/services/vehiculosService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

/**
 * Detalle de un vehículo con su historial de gastos.
 * Cada pago muestra el monto imputado (puede ser parcial de un movimiento
 * repartido entre varios vehículos) y los datos del movimiento original.
 */
export function VehiculoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['vehiculo', id],
    queryFn: () => vehiculosService.get(id!),
    enabled: !!id,
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

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/vehiculos"
          className="text-xs text-muted hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-3 w-3" />
          Vehículos
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Car className="h-6 w-6" />
              {data.vehiculo.nombre}
              {!data.vehiculo.activo && <Badge variant="muted">INACTIVO</Badge>}
            </h1>
            <div className="text-xs text-muted mt-1 space-x-3">
              {data.vehiculo.modelo && <span>Modelo: {data.vehiculo.modelo}</span>}
              <span>Patente: <span className="font-mono">{data.vehiculo.patente}</span></span>
              {data.vehiculo.observaciones && <span>· {data.vehiculo.observaciones}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted uppercase tracking-wide">Gasto total</div>
            <div className="text-3xl font-bold num">
              {formatearMonto(data.gastoTotal, 'ARS')}
            </div>
            <div className="text-[11px] text-muted">
              {data.pagos.length} pago{data.pagos.length === 1 ? '' : 's'} imputado
              {data.pagos.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Historial de pagos
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Caja</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Beneficiario</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Imputado</TableHead>
              <TableHead className="text-right">Monto mov.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.pagos.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted py-8 text-sm">
                  Sin pagos registrados. Los gastos vinculados a este vehículo van a aparecer acá
                  cuando se cargue un egreso con una categoría "vinculada a vehículos" (Seguro,
                  Patentes, Rentas Automotor, Mecánica general).
                </TableCell>
              </TableRow>
            )}
            {data.pagos.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="num text-xs">{formatearFecha(p.fecha)}</TableCell>
                <TableCell className="text-xs">{p.caja.nombre}</TableCell>
                <TableCell className="text-xs">{p.categoria?.nombre ?? '—'}</TableCell>
                <TableCell className="text-xs">{p.beneficiario?.nombre ?? '—'}</TableCell>
                <TableCell className="text-xs max-w-xs truncate">{p.descripcion ?? '—'}</TableCell>
                <TableCell className="text-right num font-medium">
                  {formatearMonto(p.montoImputado, p.moneda)}
                </TableCell>
                <TableCell className="text-right num text-xs text-muted">
                  {formatearMonto(p.montoTotalMovimiento, p.moneda)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
