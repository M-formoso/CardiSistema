import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LiquidacionesPage } from '@/pages/liquidaciones/LiquidacionesPage';
import { CertificacionesPage } from '@/pages/CertificacionesPage';
import { ContratosCuotasPage } from '@/pages/ContratosCuotasPage';
import { CompromisosPage } from '@/pages/CompromisosPage';

/**
 * Hub de todos los desembolsos programados / recurrentes.
 * - Liquidaciones semanales (empleados propios)
 * - Certificaciones (contratistas, por avance)
 * - Contratos en cuotas (profesionales)
 * - Compromisos / vencimientos (servicios, impuestos)
 *
 * Los pagos "sueltos" (ad hoc) se cargan desde la Billetera.
 */
export function PagosPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'liquidaciones';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pagos programados</h1>
        <p className="text-sm text-muted">
          Semanales, por avance, en cuotas y recurrentes — todo en un solo lugar.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="liquidaciones">Liquidaciones</TabsTrigger>
          <TabsTrigger value="certificaciones">Certificaciones</TabsTrigger>
          <TabsTrigger value="cuotas">Contratos en cuotas</TabsTrigger>
          <TabsTrigger value="compromisos">Compromisos</TabsTrigger>
        </TabsList>

        <TabsContent value="liquidaciones">
          <LiquidacionesPage />
        </TabsContent>
        <TabsContent value="certificaciones">
          <CertificacionesPage />
        </TabsContent>
        <TabsContent value="cuotas">
          <ContratosCuotasPage />
        </TabsContent>
        <TabsContent value="compromisos">
          <CompromisosPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
