import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cajasService } from '@/services/cajasService';
import { cotizacionesService } from '@/services/cotizacionesService';
import { formatearMonto, formatearFechaHora } from '@/lib/formatters';

export function CajasPage() {
  const { data: saldos = [], isLoading } = useQuery({
    queryKey: ['cajas', 'saldos'],
    queryFn: cajasService.saldos,
  });
  const { data: cot } = useQuery({
    queryKey: ['cotizacion', 'hoy'],
    queryFn: cotizacionesService.hoy,
    retry: false,
  });

  const totalArs = saldos
    .filter((s) => s.moneda === 'ARS')
    .reduce((acc, s) => acc + Number(s.saldo), 0);
  const totalUsd = saldos
    .filter((s) => s.moneda === 'USD')
    .reduce((acc, s) => acc + Number(s.saldo), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cajas</h1>
        <p className="text-sm text-muted">Saldos calculados a partir de los movimientos confirmados.</p>
      </div>

      {cot && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dólar blue</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-6">
            <div>
              <div className="text-xs text-muted">Compra</div>
              <div className="text-2xl font-bold num">
                {formatearMonto(cot.cotizaciones[0]?.compra ?? 0, 'ARS')}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">Venta</div>
              <div className="text-2xl font-bold num text-primary">
                {formatearMonto(cot.cotizaciones[0]?.venta ?? 0, 'ARS')}
              </div>
            </div>
            <div className="ml-auto text-xs text-muted">
              <Badge variant="muted">{cot.fuentePrimaria}</Badge>
              <div className="mt-1">Actualizado {formatearFechaHora(cot.actualizadoAt)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted">Total ARS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold num">{formatearMonto(totalArs, 'ARS')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted">Total USD</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold num text-primary">
              {formatearMonto(totalUsd, 'USD')}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Saldos por caja</h2>
        {isLoading ? (
          <div className="text-muted">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
            Calculando…
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {saldos.map((s) => (
              <Card key={s.cajaId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{s.nombre}</span>
                    <Badge variant="muted">{s.moneda}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold num">
                    {formatearMonto(s.saldo, s.moneda)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
