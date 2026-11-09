import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeftRight, Loader2, Minus, Plus, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { movimientosService, type Movimiento } from '@/services/movimientosService';
import { cajasService } from '@/services/cajasService';
import { formatearFecha, formatearMonto } from '@/lib/formatters';
import { NuevoEgresoDialog } from './NuevoEgresoDialog';
import { NuevoIngresoDialog } from './NuevoIngresoDialog';
import { TransferirDialog } from './TransferirDialog';
import { CambioMonedaDialog } from './CambioMonedaDialog';

const estadoVariante: Record<Movimiento['estado'], 'success' | 'danger' | 'muted'> = {
  CONFIRMADO: 'success',
  ANULADO: 'danger',
  REVERSA: 'muted',
};

export function MovimientosPage() {
  const qc = useQueryClient();
  const [filtros, setFiltros] = useState<{ cajaId?: string; q?: string; page: number }>({ page: 1 });
  const [openEgreso, setOpenEgreso] = useState(false);
  const [openIngreso, setOpenIngreso] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [openCambio, setOpenCambio] = useState(false);

  const { data: cajas = [] } = useQuery({
    queryKey: ['cajas', 'activas'],
    queryFn: () => cajasService.list(true),
  });

  const { data: listado, isLoading } = useQuery({
    queryKey: ['movimientos', filtros],
    queryFn: () => movimientosService.list({ ...filtros, pageSize: 50 }),
  });

  const anularMut = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      movimientosService.anular(id, motivo),
    onSuccess: () => {
      toast.success('Movimiento anulado (reversa generada)');
      qc.invalidateQueries({ queryKey: ['movimientos'] });
      qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
    },
    onError: (e) => {
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo anular',
      );
    },
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['movimientos'] });
    qc.invalidateQueries({ queryKey: ['cajas', 'saldos'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Movimientos</h1>
          <p className="text-sm text-muted">
            Libro único: ingresos, egresos con imputación, transferencias y cambios de moneda.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setOpenEgreso(true)}>
            <Minus className="h-4 w-4 mr-1" />
            Nuevo egreso
          </Button>
          <Button variant="outline" onClick={() => setOpenIngreso(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Ingreso
          </Button>
          <Button variant="outline" onClick={() => setOpenTransfer(true)}>
            <ArrowLeftRight className="h-4 w-4 mr-1" />
            Transferir
          </Button>
          <Button variant="outline" onClick={() => setOpenCambio(true)}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Cambio USD↔ARS
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <Select
          value={filtros.cajaId ?? ''}
          onChange={(e) => setFiltros({ ...filtros, cajaId: e.target.value || undefined, page: 1 })}
          className="max-w-xs"
        >
          <option value="">Todas las cajas</option>
          {cajas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} ({c.moneda})
            </option>
          ))}
        </Select>
        <Input
          placeholder="Buscar en descripción…"
          value={filtros.q ?? ''}
          onChange={(e) => setFiltros({ ...filtros, q: e.target.value || undefined, page: 1 })}
          className="max-w-sm"
        />
        <div className="text-xs text-muted ml-auto">
          {listado ? `${listado.total} movimiento${listado.total === 1 ? '' : 's'}` : ''}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Caja</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Equiv.</TableHead>
              <TableHead>Beneficiario</TableHead>
              <TableHead>Obra(s)</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted py-8">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && listado?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted py-8">
                  Sin movimientos todavía. Cargá el primero con los botones de arriba.
                </TableCell>
              </TableRow>
            )}
            {listado?.data.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="num">{formatearFecha(m.fecha)}</TableCell>
                <TableCell>
                  <Badge variant={m.tipo === 'INGRESO' ? 'success' : m.tipo === 'EGRESO' ? 'danger' : 'muted'}>
                    {m.tipo}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{m.caja?.nombre}</TableCell>
                <TableCell className="num font-medium">
                  {formatearMonto(m.monto, m.moneda)}
                </TableCell>
                <TableCell className="num text-xs text-muted">
                  {m.moneda === 'ARS' ? formatearMonto(m.montoUsd, 'USD') : formatearMonto(m.montoArs, 'ARS')}
                </TableCell>
                <TableCell className="text-xs">{m.beneficiario?.nombre ?? '—'}</TableCell>
                <TableCell className="text-xs">
                  {m.imputaciones?.length
                    ? m.imputaciones.map((i) => i.obra.nombre).join(', ')
                    : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={estadoVariante[m.estado]}>{m.estado}</Badge>
                </TableCell>
                <TableCell>
                  {m.estado === 'CONFIRMADO' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const motivo = prompt('Motivo de la anulación:');
                        if (motivo && motivo.trim().length >= 3) {
                          anularMut.mutate({ id: m.id, motivo: motivo.trim() });
                        }
                      }}
                      title="Anular"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NuevoEgresoDialog
        open={openEgreso}
        onOpenChange={setOpenEgreso}
        onCreated={() => {
          setOpenEgreso(false);
          refrescar();
        }}
      />
      <NuevoIngresoDialog
        open={openIngreso}
        onOpenChange={setOpenIngreso}
        onCreated={() => {
          setOpenIngreso(false);
          refrescar();
        }}
      />
      <TransferirDialog
        open={openTransfer}
        onOpenChange={setOpenTransfer}
        onCreated={() => {
          setOpenTransfer(false);
          refrescar();
        }}
      />
      <CambioMonedaDialog
        open={openCambio}
        onOpenChange={setOpenCambio}
        onCreated={() => {
          setOpenCambio(false);
          refrescar();
        }}
      />
    </div>
  );
}
