import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ObrasPage } from '@/pages/ObrasPage';
import { BeneficiariosPage } from '@/pages/BeneficiariosPage';
import { CategoriasPage } from '@/pages/CategoriasPage';

/**
 * Datos maestros del sistema: se configuran al principio y se ajustan
 * cuando aparece una obra, un beneficiario o una categoría nueva.
 */
export function ConfiguracionPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'obras';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted">
          Obras, beneficiarios y categorías. Se actualizan a medida que aparecen cosas nuevas.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="obras">Obras</TabsTrigger>
          <TabsTrigger value="beneficiarios">Beneficiarios</TabsTrigger>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
        </TabsList>

        <TabsContent value="obras">
          <ObrasPage />
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
