import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  chequesService,
  type CreateChequeInput,
  type TipoCheque,
} from '@/services/chequesService';
import { beneficiariosService } from '@/services/beneficiariosService';

/**
 * Alta rápida de cheque desde la billetera.
 * Mismo contenido que /cheques pero embebido en el flujo nuevo.
 */
export function NuevoChequeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [tipo, setTipo] = useState<TipoCheque>('TERCERO');
  const [numero, setNumero] = useState('');
  const [banco, setBanco] = useState('');
  const [titular, setTitular] = useState('');
  const [cuit, setCuit] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [fechaEmision, setFechaEmision] = useState(() => new Date().toISOString().slice(0, 10));
  const [fechaPago, setFechaPago] = useState(() => new Date().toISOString().slice(0, 10));
  const [beneficiarioId, setBeneficiarioId] = useState('');

  const { data: benes = [] } = useQuery({
    queryKey: ['beneficiarios', { activo: true }],
    queryFn: () => beneficiariosService.list({ activo: true }),
  });

  const m = useMutation({
    mutationFn: (input: CreateChequeInput) => chequesService.create(input),
    onSuccess: () => {
      toast.success('Cheque creado');
      setNumero('');
      setBanco('');
      setTitular('');
      setCuit('');
      setMonto('');
      setBeneficiarioId('');
      onCreated();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo crear',
      ),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo cheque</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!numero.trim() || !monto)
              return toast.error('Número y monto son obligatorios');
            m.mutate({
              tipo,
              numero: numero.trim(),
              banco: banco.trim() || undefined,
              titular: titular.trim() || undefined,
              cuit: cuit.trim() || undefined,
              monto: Number(monto),
              moneda,
              fechaEmision,
              fechaPago,
              beneficiarioId: beneficiarioId || undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCheque)}>
                <option value="TERCERO">De tercero (recibido)</option>
                <option value="PROPIO">Propio (emitido)</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número *</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Banco</Label>
              <Input value={banco} onChange={(e) => setBanco(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Titular / Librador</Label>
              <Input value={titular} onChange={(e) => setTitular(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>CUIT</Label>
              <Input value={cuit} onChange={(e) => setCuit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Monto *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select value={moneda} onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD')}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha emisión *</Label>
              <Input
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha pago *</Label>
              <Input
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Beneficiario (opcional)</Label>
            <Select value={beneficiarioId} onChange={(e) => setBeneficiarioId(e.target.value)}>
              <option value="">Sin asignar</option>
              {benes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre} · {b.tipo}
                </option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear cheque'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
