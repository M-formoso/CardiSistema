import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  Download,
  Loader2,
  MapPin,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  reportesService,
  type DetalleObraItem,
  type GastoPorCategoria,
} from '@/services/reportesService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

// Paleta de colores para los gráficos, basada en la identidad Cardi
const COLORES = [
  '#4390B6', // primary
  '#2E6E8F',
  '#7AB2CF',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

export function ObraDetallePage() {
  const { id = '' } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const desde = params.get('desde') ?? '2026-01-01';
  const hasta = params.get('hasta') ?? new Date().toISOString().slice(0, 10);

  const setDesde = (v: string) => setParams((p) => { p.set('desde', v); return p; }, { replace: true });
  const setHasta = (v: string) => setParams((p) => { p.set('hasta', v); return p; }, { replace: true });

  const { data: detalle, isLoading } = useQuery({
    queryKey: ['reportes', 'obra-detalle', id, { desde, hasta }],
    queryFn: () => reportesService.detalleObra(id, { desde, hasta }),
    enabled: !!id,
  });

  const { data: porCategoria = [] } = useQuery({
    queryKey: ['reportes', 'obra-cat', id, { desde, hasta }],
    queryFn: () => reportesService.obraPorCategoria(id, { desde, hasta }),
    enabled: !!id,
  });

  const { data: porMes = [] } = useQuery({
    queryKey: ['reportes', 'obra-mes', id, { desde, hasta }],
    queryFn: () => reportesService.obraPorMes(id, { desde, hasta }),
    enabled: !!id,
  });

  const dataPie = useMemo(
    () =>
      porCategoria
        .filter((c) => Number(c.ars) > 0)
        .map((c, i) => ({
          name: c.nombre,
          value: Number(c.ars),
          color: COLORES[i % COLORES.length],
        })),
    [porCategoria],
  );

  const dataBar = useMemo(
    () =>
      porMes.map((m) => ({
        mes: formatearMesCorto(m.mes),
        ARS: Number(m.ars),
        USD: Number(m.usd),
      })),
    [porMes],
  );

  if (isLoading || !detalle) {
    return (
      <div className="text-muted py-20 text-center">
        <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
        Cargando reporte de la obra…
      </div>
    );
  }

  const { obra, totales, items } = detalle;
  const contratado = obra.montoContratado ? Number(obra.montoContratado) : null;
  const gastadoEnMonedaContrato =
    obra.monedaContrato === 'USD' ? Number(totales.usd) : Number(totales.ars);
  const restante = contratado != null ? contratado - gastadoEnMonedaContrato : null;
  const porcentaje =
    contratado && contratado > 0 ? (gastadoEnMonedaContrato / contratado) * 100 : null;

  return (
    <div className="space-y-6">
      {/* ================ Header ================ */}
      <Link to="/reportes">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a reportes
        </Button>
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{obra.nombre}</h1>
            <Badge
              variant={
                obra.estado === 'ACTIVA'
                  ? 'success'
                  : obra.estado === 'EN_LICITACION'
                    ? 'warning'
                    : 'muted'
              }
            >
              {obra.estado}
            </Badge>
            <Badge variant="muted">{obra.tipo}</Badge>
          </div>
          <div className="text-sm text-muted mt-1 flex items-center gap-4 flex-wrap">
            {obra.comitente && <span>Comitente: {obra.comitente}</span>}
            {obra.constructora && <span>Constructora: {obra.constructora}</span>}
            {obra.ubicacion && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {obra.ubicacion}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => reportesService.downloadMovimientosExcel({ obraId: id, desde, hasta })}
        >
          <Download className="h-4 w-4 mr-1" />
          Exportar movimientos
        </Button>
      </div>

      {/* ================ Filtros de período ================ */}
      <div className="flex gap-3 items-end flex-wrap">
        <div className="space-y-1">
          <Label>Desde</Label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Hasta</Label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      {/* ================ KPIs ================ */}
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard
          titulo="Contratado"
          valor={
            contratado != null && obra.monedaContrato
              ? formatearMonto(contratado, obra.monedaContrato)
              : '—'
          }
          icon={<Wallet className="h-4 w-4 text-muted" />}
        />
        <KpiCard
          titulo="Gastado ARS"
          valor={formatearMonto(totales.ars, 'ARS')}
          icon={<TrendingDown className="h-4 w-4 text-danger" />}
        />
        <KpiCard
          titulo="Gastado USD"
          valor={formatearMonto(totales.usd, 'USD')}
          icon={<TrendingDown className="h-4 w-4 text-danger" />}
        />
        <KpiCard
          titulo={restante != null && restante < 0 ? 'Sobre-ejecutado' : 'Restante'}
          valor={
            restante != null && obra.monedaContrato
              ? formatearMonto(restante, obra.monedaContrato)
              : '—'
          }
          badge={
            porcentaje != null
              ? {
                  text: `${porcentaje.toFixed(1)}%`,
                  variant:
                    porcentaje >= 100
                      ? 'danger'
                      : porcentaje >= 80
                        ? 'warning'
                        : 'success',
                }
              : undefined
          }
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
        />
      </div>

      {/* ================ Barra de progreso ================ */}
      {porcentaje != null && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">Consumo del presupuesto</span>
              <span className="num">
                {formatearMonto(gastadoEnMonedaContrato, obra.monedaContrato!)} /{' '}
                {formatearMonto(contratado!, obra.monedaContrato!)}
              </span>
            </div>
            <div className="h-3 bg-muted/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  porcentaje >= 100
                    ? 'bg-danger'
                    : porcentaje >= 80
                      ? 'bg-warning'
                      : 'bg-primary'
                }`}
                style={{ width: `${Math.min(porcentaje, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================ Gráficos ================ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gasto por categoría (ARS)</CardTitle>
          </CardHeader>
          <CardContent>
            {dataPie.length === 0 ? (
              <div className="text-muted text-sm text-center py-16">
                Sin gastos en el período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={dataPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={55}
                    paddingAngle={2}
                    label={(entry: { value?: number }) => {
                      const total = dataPie.reduce((acc: number, b) => acc + b.value, 0);
                      return `${(((entry.value ?? 0) / total) * 100).toFixed(0)}%`;
                    }}
                    labelLine={false}
                  >
                    {dataPie.map((entry, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatearMonto(v, 'ARS')}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolución mensual (ARS)</CardTitle>
          </CardHeader>
          <CardContent>
            {dataBar.length === 0 ? (
              <div className="text-muted text-sm text-center py-16">
                Sin datos mensuales.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dataBar}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted))" fontSize={11} />
                  <YAxis
                    stroke="hsl(var(--muted))"
                    fontSize={11}
                    tickFormatter={(v) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1_000
                          ? `${(v / 1_000).toFixed(0)}k`
                          : String(v)
                    }
                  />
                  <Tooltip
                    formatter={(v: number) => formatearMonto(v, 'ARS')}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="ARS" fill="#4390B6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ================ Tabla por categoría ================ */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">
          Desglose por categoría
        </h2>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Movimientos</TableHead>
                <TableHead className="text-right">Total ARS</TableHead>
                <TableHead className="text-right">Total USD</TableHead>
                <TableHead className="text-right">% del total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porCategoria.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted py-6">
                    Sin datos.
                  </TableCell>
                </TableRow>
              )}
              {porCategoria.map((c: GastoPorCategoria) => {
                const totalArs = Number(totales.ars);
                const pct = totalArs > 0 ? (Number(c.ars) / totalArs) * 100 : 0;
                return (
                  <TableRow key={c.categoriaId}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted mr-2">{c.codigo}</span>
                      {c.nombre}
                    </TableCell>
                    <TableCell className="num text-right">{c.cantidad}</TableCell>
                    <TableCell className="num text-right font-medium">
                      {formatearMonto(c.ars, 'ARS')}
                    </TableCell>
                    <TableCell className="num text-right text-muted">
                      {formatearMonto(c.usd, 'USD')}
                    </TableCell>
                    <TableCell className="num text-right text-muted">
                      {pct.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ================ Últimos movimientos ================ */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">
          Movimientos de la obra ({items.length}
          {items.length >= 1000 ? '+' : ''})
        </h2>
        <div className="rounded-lg border border-border bg-card max-h-96 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Beneficiario</TableHead>
                <TableHead>Caja</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted py-6">
                    Sin movimientos imputados a esta obra en el período.
                  </TableCell>
                </TableRow>
              )}
              {items.slice(0, 200).map((it: DetalleObraItem, i: number) => (
                <TableRow key={i}>
                  <TableCell className="num text-xs">{formatearFecha(it.fecha)}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate">
                    {it.descripcion ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted">{it.categoria ?? '—'}</TableCell>
                  <TableCell className="text-xs">{it.beneficiario ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted">{it.caja}</TableCell>
                  <TableCell className="num font-medium text-right">
                    {formatearMonto(it.monto, it.moneda)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {items.length > 200 && (
          <p className="text-xs text-muted mt-2">
            Mostrando los primeros 200 de {items.length}. Exportá a Excel para la lista completa.
          </p>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  titulo,
  valor,
  icon,
  badge,
}: {
  titulo: string;
  valor: string;
  icon?: React.ReactNode;
  badge?: { text: string; variant: 'success' | 'warning' | 'danger' | 'muted' | 'default' };
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-muted uppercase tracking-wider">
          {titulo}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2">
          <div className="text-2xl font-bold num truncate">{valor}</div>
          {badge && <Badge variant={badge.variant}>{badge.text}</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

function formatearMesCorto(iso: string): string {
  // "2026-11" → "Nov 26"
  const [yy, mm] = iso.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${meses[Number(mm) - 1] ?? mm} ${yy.slice(-2)}`;
}
