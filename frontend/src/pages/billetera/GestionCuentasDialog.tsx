import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ChevronLeft, TrendingUp, History } from 'lucide-react';
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
import { cajasService, type Caja, type SaldoCaja } from '@/services/cajasService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';

/**
 * Modal con CRUD completo de cuentas/cajas + ajuste manual del saldo con
 * historial. Mismo patrón que GestionCategoriasDialog / GestionEmpresasDialog.
 */
export function GestionCuentasDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [vista, setVista] = useState<
    | { tipo: 'lista' }
    | { tipo: 'form'; caja?: Caja }
    | { tipo: 'ajustar'; caja: Caja; saldoActual: string }
    | { tipo: 'historial'; caja: Caja }
  >({ tipo: 'lista' });

  const { data: cajas = [], isLoading } = useQuery({
    queryKey: ['cajas'],
    queryFn: () => cajasService.list(false),
  });
  const { data: saldos = [] } = useQuery({
    queryKey: ['cajas', 'saldos'],
    queryFn: cajasService.saldos,
  });

  const saldoPorCaja = new Map(saldos.map((s: SaldoCaja) => [s.cajaId, s.saldo]));

  const desactivarMut = useMutation({
    mutationFn: (id: string) => cajasService.desactivar(id),
    onSuccess: () => {
      toast.success('Cuenta desactivada');
      qc.invalidateQueries({ queryKey: ['cajas'] });
      qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
    },
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        {vista.tipo === 'lista' && (
          <>
            <DialogHeader>
              <DialogTitle>Cuentas</DialogTitle>
              <DialogDescription>
                Cajas en las que entra y sale la plata. El saldo se calcula automático desde los
                movimientos. Si el físico no coincide, podés ajustarlo acá (queda el historial).
              </DialogDescription>
            </DialogHeader>

            <div className="flex justify-end">
              <Button size="sm" onClick={() => setVista({ tipo: 'form' })}>
                <Plus className="h-4 w-4 mr-1" />
                Nueva cuenta
              </Button>
            </div>

            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Saldo actual</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted py-6">
                        <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                        Cargando…
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && cajas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted py-6">
                        Sin cuentas. Creá la primera.
                      </TableCell>
                    </TableRow>
                  )}
                  {cajas.map((c) => {
                    const saldo = saldoPorCaja.get(c.id) ?? '0';
                    const saldoNum = Number(saldo);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.nombre}
                          {!c.activo && (
                            <Badge variant="muted" className="ml-2 text-xs">
                              Inactiva
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="muted">{tipoLabel(c.tipo)}</Badge>
                        </TableCell>
                        <TableCell>{c.moneda}</TableCell>
                        <TableCell
                          className={`num text-right whitespace-nowrap font-medium ${
                            saldoNum < 0 ? 'text-danger' : ''
                          }`}
                        >
                          {formatearMonto(saldo, c.moneda)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setVista({ tipo: 'ajustar', caja: c, saldoActual: saldo })
                              }
                              title="Ajustar saldo manualmente"
                            >
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Ajustar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setVista({ tipo: 'historial', caja: c })}
                              title="Historial de ajustes"
                            >
                              <History className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setVista({ tipo: 'form', caja: c })}
                            >
                              Editar
                            </Button>
                            {c.activo && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `¿Desactivar "${c.nombre}"? Queda oculta en los selectores pero no se pierden los movimientos.`,
                                    )
                                  )
                                    desactivarMut.mutate(c.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        )}

        {vista.tipo === 'form' && (
          <FormCuenta
            caja={vista.caja}
            onBack={() => setVista({ tipo: 'lista' })}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ['cajas'] });
              qc.invalidateQueries({ queryKey: ['cajas', 'activas'] });
              qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
              setVista({ tipo: 'lista' });
            }}
          />
        )}

        {vista.tipo === 'ajustar' && (
          <FormAjustarSaldo
            caja={vista.caja}
            saldoActual={vista.saldoActual}
            onBack={() => setVista({ tipo: 'lista' })}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
              qc.invalidateQueries({ queryKey: ['movimientos'] });
              setVista({ tipo: 'historial', caja: vista.caja });
            }}
          />
        )}

        {vista.tipo === 'historial' && (
          <VistaHistorial caja={vista.caja} onBack={() => setVista({ tipo: 'lista' })} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function tipoLabel(t: Caja['tipo']): string {
  switch (t) {
    case 'EFECTIVO':
      return 'Efectivo';
    case 'BANCO':
      return 'Banco';
    case 'CHEQUES_TERCEROS':
      return 'Cheques de terceros';
    case 'OTRO':
      return 'Otro';
  }
}

function FormCuenta({
  caja,
  onBack,
  onSaved,
}: {
  caja?: Caja;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(caja?.nombre ?? '');
  const [tipo, setTipo] = useState<Caja['tipo']>(caja?.tipo ?? 'EFECTIVO');
  const [moneda, setMoneda] = useState<Caja['moneda']>(caja?.moneda ?? 'ARS');
  const [saldoInicial, setSaldoInicial] = useState(caja?.saldoInicial ?? '0');
  const [fechaSaldoInicial, setFechaSaldoInicial] = useState(
    caja?.fechaSaldoInicial?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );

  const m = useMutation({
    mutationFn: () =>
      caja
        ? cajasService.update(caja.id, {
            nombre: nombre.trim(),
          })
        : cajasService.create({
            nombre: nombre.trim(),
            tipo,
            moneda,
            saldoInicial,
            fechaSaldoInicial,
          }),
    onSuccess: () => {
      toast.success(caja ? 'Cuenta actualizada' : 'Cuenta creada');
      onSaved();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo guardar',
      ),
  });

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <DialogTitle>{caja ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
        </div>
        {caja && (
          <DialogDescription>
            Solo se puede cambiar el nombre. Para modificar el saldo actual usá "Ajustar"
            (queda en el historial).
          </DialogDescription>
        )}
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nombre.trim()) return toast.error('El nombre es obligatorio');
          m.mutate();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label>Nombre *</Label>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Efectivo ARS, Banco Nación, Cheques terceros…"
            required
          />
        </div>
        {!caja && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as Caja['tipo'])}
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="BANCO">Banco</option>
                  <option value="CHEQUES_TERCEROS">Cheques de terceros</option>
                  <option value="OTRO">Otro</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Moneda *</Label>
                <Select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value as Caja['moneda'])}
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Saldo inicial</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={saldoInicial}
                  onChange={(e) => setSaldoInicial(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha del saldo inicial *</Label>
                <Input
                  type="date"
                  value={fechaSaldoInicial}
                  onChange={(e) => setFechaSaldoInicial(e.target.value)}
                  required
                />
              </div>
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onBack}>
            Volver
          </Button>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function FormAjustarSaldo({
  caja,
  saldoActual,
  onBack,
  onSaved,
}: {
  caja: Caja;
  saldoActual: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [saldoObjetivo, setSaldoObjetivo] = useState(saldoActual);
  const [motivo, setMotivo] = useState('');

  const diferencia = Number(saldoObjetivo) - Number(saldoActual);

  const m = useMutation({
    mutationFn: () =>
      cajasService.ajustarSaldo(caja.id, {
        saldoObjetivo: Number(saldoObjetivo),
        motivo: motivo.trim(),
      }),
    onSuccess: (r) => {
      toast.success(
        `Saldo ajustado (${r.tipo === 'INGRESO' ? '+' : '-'}${formatearMonto(
          r.diferencia.replace('-', ''),
          caja.moneda,
        )}). Queda en el historial.`,
      );
      onSaved();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo ajustar',
      ),
  });

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <DialogTitle>Ajustar saldo de "{caja.nombre}"</DialogTitle>
        </div>
        <DialogDescription>
          Si el físico no coincide con el calculado, ingresá el saldo real. El sistema crea un
          movimiento con la diferencia (ingreso o egreso) y queda registrado quién lo hizo y por
          qué.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (motivo.trim().length < 3) return toast.error('Explicá el motivo del ajuste');
          if (Math.abs(diferencia) < 0.01)
            return toast.error('El saldo objetivo coincide con el actual');
          m.mutate();
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Saldo actual calculado</Label>
            <div className="h-10 flex items-center px-3 rounded-md border border-border bg-muted/5 num">
              {formatearMonto(saldoActual, caja.moneda)}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Saldo real (objetivo) *</Label>
            <Input
              type="number"
              step="0.01"
              value={saldoObjetivo}
              onChange={(e) => setSaldoObjetivo(e.target.value)}
              required
            />
          </div>
        </div>
        {Math.abs(diferencia) >= 0.01 && (
          <div
            className={`rounded-md border p-3 text-sm ${
              diferencia > 0
                ? 'border-success/40 bg-success/5 text-success'
                : 'border-warning/40 bg-warning/5 text-warning'
            }`}
          >
            Diferencia: <span className="font-bold num">
              {diferencia > 0 ? '+' : '−'}
              {formatearMonto(Math.abs(diferencia).toString(), caja.moneda)}
            </span>{' '}
            · Se va a crear un {diferencia > 0 ? 'INGRESO' : 'EGRESO'} de ajuste.
          </div>
        )}
        <div className="space-y-2">
          <Label>Motivo *</Label>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Arqueo del viernes, faltante detectado…"
            required
          />
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onBack}>
            Volver
          </Button>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar ajuste'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function VistaHistorial({ caja, onBack }: { caja: Caja; onBack: () => void }) {
  const { data: historial = [], isLoading } = useQuery({
    queryKey: ['cajas', caja.id, 'ajustes'],
    queryFn: () => cajasService.historialAjustes(caja.id),
  });

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <DialogTitle>Historial de ajustes — "{caja.nombre}"</DialogTitle>
        </div>
      </DialogHeader>
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right whitespace-nowrap">Monto</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Hecho por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted py-6">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && historial.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted py-6">
                  Sin ajustes registrados en esta cuenta.
                </TableCell>
              </TableRow>
            )}
            {historial.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-sm whitespace-nowrap">
                  {formatearFecha(a.fecha)}
                </TableCell>
                <TableCell>
                  <Badge variant={a.tipo === 'INGRESO' ? 'success' : 'warning'}>
                    {a.tipo === 'INGRESO' ? '+ Ingreso' : '− Egreso'}
                  </Badge>
                </TableCell>
                <TableCell
                  className={`num text-right whitespace-nowrap font-medium ${
                    a.tipo === 'EGRESO' ? 'text-warning' : 'text-success'
                  }`}
                >
                  {a.tipo === 'EGRESO' ? '−' : '+'}
                  {formatearMonto(a.monto, a.moneda)}
                </TableCell>
                <TableCell className="text-sm">{a.motivo}</TableCell>
                <TableCell className="text-sm text-muted">
                  {a.hechoPor?.nombre ?? a.hechoPor?.username ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onBack}>
          Volver
        </Button>
      </DialogFooter>
    </>
  );
}
