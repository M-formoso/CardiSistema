import { ObrasPage } from '@/pages/ObrasPage';

/**
 * Configuración queda como el hub de Obras únicamente.
 * Las categorías de empleado se gestionan desde /empleados (botón "Categorías").
 * Las categorías de gasto se dan de alta inline desde el modal de egreso.
 * Las empresas se dan de alta inline desde el modal de empleado.
 * "Otros beneficiarios" (proveedores, profesionales) se consolidan en el flujo
 * donde aparecen.
 */
export function ConfiguracionPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted">
          Obras y unidades de negocio. El resto (categorías de empleado, empresas, categorías de
          gasto) se gestiona desde la sección donde se usan.
        </p>
      </div>
      <ObrasPage />
    </div>
  );
}
