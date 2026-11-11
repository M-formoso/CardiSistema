import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { reportesService } from '@/services/reportesService';
import { formatearMonto } from '@/lib/formatters';

export function ReportesPage() {
  const nav = useNavigate();
  const [desde, setDesde] = useState('2026-01-01');
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: porObra = [], isLoading } = useQuery({
    queryKey: ['reportes', 'gasto-por-obra', { desde, hasta }],
    queryFn: () => reportesService.gastoPorObra({ desde, hasta }),
  });

  const { data: porCategoria = [] } = useQuery({
    queryKey: ['reportes', 'gasto-por-categoria', { desde, hasta }],
    queryFn: () => reportesService.gastoPorCategoria({ desde, hasta }),
  });

  const totalArs = porObra.reduce((acc, r) => acc + Number(r.gastadoArs), 0);
  const totalUsd = porObra.reduce((acc, r) => acc + Number(r.gastadoUsd), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted">
          Gasto por obra contra lo contratado, y por categoría. Exportable a Excel.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="space-y-1">
          <Label>Desde</Label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Hasta</Label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            onClick={() => reportesService.downloadGastoPorObraExcel({ desde, hasta })}
          >
            <Download className="h-4 w-4 mr-1" />
            Gasto por obra (Excel)
          </Button>
          <Button
            variant="outline"
            onClick={() => reportesService.downloadMovimientosExcel({ desde, hasta })}
          >
            <Download className="h-4 w-4 mr-1" />
            Movimientos (Excel)
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between mb-2 gap-2">
          <h2 className="text-lg font-semibold">Gasto por obra</h2>
          <span className="text-xs text-muted">Clic en una obra para ver detalle con gráficos</span>
        </div>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obra</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Gastado ARS</TableHead>
                <TableHead>Gastado USD</TableHead>
                <TableHead>Contratado</TableHead>
                <TableHead>Restante</TableHead>
                <TableHead>% Consumido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted py-8">
                    <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                    Calculando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && porObra.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted py-8">
                    No hay datos en el período.
                  </TableCell>
                </TableRow>
              )}
              {porObra.map((o) => {
                const pct = o.porcentajeConsumido ? Number(o.porcentajeConsumido) : null;
                return (
                  <TableRow
                    key={o.obraId}
                    className="cursor-pointer"
                    onClick={() => nav(`/reportes/obras/${o.obraId}?desde=${desde}&hasta=${hasta}`)}
                  >
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1 group">
                        {o.nombre}
                        <ArrowRight className="h-3 w-3 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{o.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted">{o.estado}</TableCell>
                    <TableCell className="num">{formatearMonto(o.gastadoArs, 'ARS')}</TableCell>
                    <TableCell className="num">{formatearMonto(o.gastadoUsd, 'USD')}</TableCell>
                    <TableCell className="num">
                      {o.contratado && o.monedaContrato
                        ? formatearMonto(o.contratado, o.monedaContrato)
                        : '—'}
                    </TableCell>
                    <TableCell className="num">
                      {o.restante && o.monedaContrato
                        ? formatearMonto(o.restante, o.monedaContrato)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {pct != null ? (
                        <Badge variant={pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'default'}>
                          {pct.toFixed(1)}%
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {porObra.length > 0 && (
                <TableRow className="font-bold">
                  <TableCell colSpan={3}>Totales</TableCell>
                  <TableCell className="num">{formatearMonto(totalArs, 'ARS')}</TableCell>
                  <TableCell className="num">{formatearMonto(totalUsd, 'USD')}</TableCell>
                  <TableCell colSpan={3}></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Gasto por categoría</h2>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead>Movimientos</TableHead>
                <TableHead>Total ARS</TableHead>
                <TableHead>Total USD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porCategoria.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted py-6">
                    Sin datos.
                  </TableCell>
                </TableRow>
              )}
              {porCategoria.map((c) => (
                <TableRow key={c.categoriaId}>
                  <TableCell>
                    <span className="font-mono text-xs text-muted mr-2">{c.codigo}</span>
                    {c.nombre}
                  </TableCell>
                  <TableCell className="num">{c.cantidad}</TableCell>
                  <TableCell className="num">{formatearMonto(c.ars, 'ARS')}</TableCell>
                  <TableCell className="num">{formatearMonto(c.usd, 'USD')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
