import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ObrasPage } from '@/pages/ObrasPage';
import { EmpleadosPage } from '@/pages/EmpleadosPage';
import { CategoriasEmpleadosPage } from '@/pages/CategoriasEmpleadosPage';
import { EmpresasPage } from '@/pages/EmpresasPage';
import { BeneficiariosPage } from '@/pages/BeneficiariosPage';
import { CategoriasPage } from '@/pages/CategoriasPage';

/**
 * Datos maestros del sistema: se configuran al principio y se ajustan
 * cuando aparece una obra, empleado, categoría o beneficiario nuevo.
 */
export function ConfiguracionPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'obras';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted">
          Obras, empleados, categorías, empresas, beneficiarios y categorías de gasto.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="obras">Obras</TabsTrigger>
          <TabsTrigger value="empleados">Empleados</TabsTrigger>
          <TabsTrigger value="categorias-empleados">Categorías empl.</TabsTrigger>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="beneficiarios">Otros benef.</TabsTrigger>
          <TabsTrigger value="categorias">Categorías gasto</TabsTrigger>
        </TabsList>

        <TabsContent value="obras">
          <ObrasPage />
        </TabsContent>
        <TabsContent value="empleados">
          <EmpleadosPage />
        </TabsContent>
        <TabsContent value="categorias-empleados">
          <CategoriasEmpleadosPage />
        </TabsContent>
        <TabsContent value="empresas">
          <EmpresasPage />
        </TabsContent>
        <TabsContent value="beneficiarios">
          <BeneficiariosPage />
        </TabsContent>
        <TabsContent value="categorias">
          <CategoriasPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
