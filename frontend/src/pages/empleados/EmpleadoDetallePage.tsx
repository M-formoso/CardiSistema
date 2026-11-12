import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  Briefcase,
  Mail,
  Phone,
  Fingerprint,
  Building2,
  CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { empleadosService } from '@/services/empleadosService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

export function EmpleadoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [actualizarJornalOpen, setActualizarJornalOpen] = useState(false);

  const { data: emp, isLoading } = useQuery({
    queryKey: ['empleado', id],
    queryFn: () => empleadosService.get(id!),
    enabled: !!id,
  });

  const { data: jornales = [] } = useQuery({
    queryKey: ['empleado-jornales', id],
    queryFn: () => empleadosService.historialJornales(id!),
    enabled: !!id,
  });

  const { data: prestamos = [] } = useQuery({
    queryKey: ['empleado-prestamos', id],
    queryFn: () => empleadosService.prestamosDe(id!),
    enabled: !!id,
  });

  const { data: liquidaciones = [] } = useQuery({
    queryKey: ['empleado-liquidaciones', id],
    queryFn: () => empleadosService.liquidacionesDe(id!),
    enabled: !!id,
  });

  if (isLoading || !emp) {
    return (
      <div className="text-muted">
        <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
        Cargando ficha…
      </div>
    );
  }

  const legajo = emp.legajo;
  const totalCobrado = liquidaciones
    .filter((l) => l.pagado)
    .reduce((acc, l) => acc + Number(l.aPagar), 0);
  const totalPendiente = liquidaciones
    .filter((l) => !l.pagado)
    .reduce((acc, l) => acc + Number(l.aPagar), 0);
  const saldoPrestamos = prestamos
    .filter((p) => p.estado === 'VIGENTE')
    .reduce((acc, p) => acc + Number(p.saldoPendiente), 0);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => nav('/empleados')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{emp.nombre}</h1>
            <Badge variant={emp.activo ? 'success' : 'muted'}>
              {emp.activo ? 'Activo' : 'Inactivo'}
            </Badge>
            {legajo?.situacionFiscal && (
              <Badge variant={legajo.situacionFiscal === 'BLANCO' ? 'success' : 'muted'}>
                {legajo.situacionFiscal === 'BLANCO' ? 'Declarado' : 'No declarado'}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted mt-1">
            {legajo?.categoria?.nombre ?? 'Sin categoría'}
            {legajo?.empresa ? ` · ${legajo.empresa.nombre}` : ''}
          </p>
        </div>
        <Button variant="outline" onClick={() => setActualizarJornalOpen(true)}>
          <TrendingUp className="h-4 w-4 mr-1" />
          Jornales y actualizaciones
        </Button>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Jornal actual"
          valor={legajo?.jornal ? formatearMonto(legajo.jornal, 'ARS') : '—'}
          sub={
            legajo?.valorHoraExtra
              ? `Hora extra ${formatearMonto(legajo.valorHoraExtra, 'ARS')}`
              : undefined
          }
        />
        <StatCard
          label="Total cobrado"
          valor={formatearMonto(totalCobrado, 'ARS')}
          sub={`${liquidaciones.filter((l) => l.pagado).length} recibo(s)`}
        />
        <StatCard
          label="Pendiente de pago"
          valor={formatearMonto(totalPendiente, 'ARS')}
          sub={`${liquidaciones.filter((l) => !l.pagado).length} recibo(s)`}
          highlight={totalPendiente > 0 ? 'warning' : undefined}
        />
        <StatCard
          label="Saldo préstamos"
          valor={formatearMonto(saldoPrestamos, 'ARS')}
          sub={`${prestamos.filter((p) => p.estado === 'VIGENTE').length} vigente(s)`}
          highlight={saldoPrestamos > 0 ? 'warning' : undefined}
        />
      </div>

      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos del legajo</TabsTrigger>
          <TabsTrigger value="jornales">Historial de jornales</TabsTrigger>
          <TabsTrigger value="prestamos">Préstamos ({prestamos.length})</TabsTrigger>
          <TabsTrigger value="liquidaciones">Liquidaciones ({liquidaciones.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <Dato icon={Fingerprint} label="DNI" value={legajo?.dni} />
            <Dato icon={Fingerprint} label="CUIT / CUIL" value={emp.cuitCuil} />
            <Dato icon={Building2} label="Empresa" value={legajo?.empresa?.nombre} />
            <Dato icon={Briefcase} label="Categoría" value={legajo?.categoria?.nombre} />
            <Dato
              icon={CalendarDays}
              label="Fecha de ingreso"
              value={legajo?.fechaIngreso ? formatearFecha(legajo.fechaIngreso) : undefined}
            />
            <Dato icon={Briefcase} label="Obra actual" value={legajo?.obraActualId ?? '—'} />
            <Dato icon={Phone} label="Contacto" value={emp.cuitCuil /* TODO: cargar contacto */} />
            <Dato icon={Mail} label="Observaciones" value={undefined} />
          </div>
          {emp.aliases && emp.aliases.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs text-muted mb-2">
                Alias (nombres como aparecen en las planillas)
              </div>
              <div className="flex gap-2 flex-wrap">
                {emp.aliases.map((a) => (
                  <Badge key={a.id} variant="muted">
                    {a.alias}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="jornales">
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vigente desde</TableHead>
                  <TableHead className="text-right">Jornal</TableHead>
                  <TableHead className="text-right">Hora extra</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jornales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted py-6">
                      Sin cambios de jornal registrados.
                    </TableCell>
                  </TableRow>
                )}
                {jornales.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{formatearFecha(h.vigenteDesde)}</TableCell>
                    <TableCell className="num text-right font-medium">
                      {formatearMonto(h.jornal, 'ARS')}
                    </TableCell>
                    <TableCell className="num text-right text-xs">
                      {h.valorHoraExtra ? formatearMonto(h.valorHoraExtra, 'ARS') : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted">{h.motivo ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="prestamos">
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Saldo pendiente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prestamos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted py-6">
                      Sin préstamos registrados.
                    </TableCell>
                  </TableRow>
                )}
                {prestamos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatearFecha(p.fecha)}</TableCell>
                    <TableCell className="num text-right">
                      {formatearMonto(p.monto, 'ARS')}
                    </TableCell>
                    <TableCell className="num text-right font-medium">
                      {formatearMonto(p.saldoPendiente, 'ARS')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.estado === 'VIGENTE'
                            ? 'warning'
                            : p.estado === 'SALDADO'
                              ? 'success'
                              : 'muted'
                        }
                      >
                        {p.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted">{p.observaciones ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="liquidaciones">
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">A pagar</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidaciones.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted py-6">
                      Sin liquidaciones.
                    </TableCell>
                  </TableRow>
                )}
                {liquidaciones.map((li) => (
                  <TableRow key={li.id}>
                    <TableCell className="text-sm">
                      {formatearFecha(li.liquidacion.semanaInicio)} →{' '}
                      {formatearFecha(li.liquidacion.semanaFin)}
                    </TableCell>
                    <TableCell className="text-sm">{li.liquidacion.obra.nombre}</TableCell>
                    <TableCell className="num text-right text-xs">
                      {formatearMonto(li.subtotal, 'ARS')}
                    </TableCell>
                    <TableCell className="num text-right font-medium">
                      {formatearMonto(li.aPagar, 'ARS')}
                    </TableCell>
                    <TableCell>
                      {li.pagado ? (
                        <Badge variant="success">Pagado</Badge>
                      ) : (
                        <Badge variant="warning">Pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link to={`/liquidaciones/${li.liquidacion.id}`}>
                        <Button variant="outline" size="sm">
                          Abrir
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {actualizarJornalOpen && (
        <ActualizarJornalDialog
          empleadoId={emp.id}
          jornalActual={legajo?.jornal ?? null}
          valorHoraExtraActual={legajo?.valorHoraExtra ?? null}
          onClose={() => setActualizarJornalOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['empleado', id] });
            qc.invalidateQueries({ queryKey: ['empleado-jornales', id] });
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  valor,
  sub,
  highlight,
}: {
  label: string;
  valor: string;
  sub?: string;
  highlight?: 'warning';
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-lg font-bold num ${highlight === 'warning' ? 'text-warning' : ''}`}>
        {valor}
      </div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

function Dato({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-muted">{label}</div>
        <div className="truncate">{value && value.trim() ? value : '—'}</div>
      </div>
    </div>
  );
}

function ActualizarJornalDialog({
  empleadoId,
  jornalActual,
  valorHoraExtraActual,
  onClose,
  onSaved,
}: {
  empleadoId: string;
  jornalActual: string | null;
  valorHoraExtraActual: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [jornal, setJornal] = useState(jornalActual ?? '');
  const [horaExtra, setHoraExtra] = useState(valorHoraExtraActual ?? '');
  const [vigenteDesde, setVigenteDesde] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [motivo, setMotivo] = useState('');

  const { data: historial = [], refetch: refetchHistorial, isLoading: cargandoHistorial } =
    useQuery({
      queryKey: ['empleado-jornales', empleadoId],
      queryFn: () => empleadosService.historialJornales(empleadoId),
    });

  const m = useMutation({
    mutationFn: () =>
      empleadosService.actualizarJornal(empleadoId, {
        jornal: Number(jornal),
        valorHoraExtra: horaExtra ? Number(horaExtra) : undefined,
        vigenteDesde,
        motivo: motivo.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Jornal actualizado y registrado en el historial');
      setMotivo('');
      void refetchHistorial();
      onSaved();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo actualizar',
      ),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Jornales y actualizaciones</DialogTitle>
          <DialogDescription>
            Registrá un nuevo jornal y revisá el historial completo de cambios. Cada actualización
            queda con fecha y motivo. Para actualizar a todo un grupo, usá Configuración →
            Categorías empleado.
          </DialogDescription>
        </DialogHeader>

        {/* Formulario de nuevo cambio */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!jornal || Number(jornal) <= 0) return toast.error('Jornal inválido');
            m.mutate();
          }}
          className="space-y-4 border-b border-border pb-5"
        >
          <h3 className="text-sm font-semibold">Nueva actualización</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Nuevo jornal *</Label>
              <Input
                type="number"
                step="0.01"
                value={jornal}
                onChange={(e) => setJornal(e.target.value)}
                required
              />
              {jornalActual && (
                <p className="text-xs text-muted">
                  Actual: {formatearMonto(jornalActual, 'ARS')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Valor hora extra</Label>
              <Input
                type="number"
                step="0.01"
                value={horaExtra}
                onChange={(e) => setHoraExtra(e.target.value)}
              />
              <p className="text-xs text-muted">
                Sugerido: {((Number(jornal) / 8) * 1.5 || 0).toFixed(2)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Vigente desde *</Label>
              <Input
                type="date"
                value={vigenteDesde}
                onChange={(e) => setVigenteDesde(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Paritarias, ajuste noviembre, promoción…"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Registrar actualización'
              )}
            </Button>
          </div>
        </form>

        {/* Historial completo */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold">
            Historial de actualizaciones ({historial.length})
          </h3>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha vigencia</TableHead>
                  <TableHead className="text-right">Jornal</TableHead>
                  <TableHead className="text-right">Hora extra</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargandoHistorial && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted py-6">
                      <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                      Cargando…
                    </TableCell>
                  </TableRow>
                )}
                {!cargandoHistorial && historial.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted py-6">
                      Sin cambios registrados. Al guardar arriba aparece acá.
                    </TableCell>
                  </TableRow>
                )}
                {historial.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm">
                      {formatearFecha(h.vigenteDesde)}
                    </TableCell>
                    <TableCell className="num text-right font-medium">
                      {formatearMonto(h.jornal, 'ARS')}
                    </TableCell>
                    <TableCell className="num text-right text-xs">
                      {h.valorHoraExtra
                        ? formatearMonto(h.valorHoraExtra, 'ARS')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted">{h.motivo ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
