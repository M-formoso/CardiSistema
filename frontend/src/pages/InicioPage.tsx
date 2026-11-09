import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';

export function InicioPage() {
  const { usuario } = useAuthStore();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hola, {usuario?.nombre?.split(' ')[0]}</h1>
        <p className="text-muted mt-1">
          Este es el panel inicial del Sistema Cardi. Los módulos se van habilitando por etapa.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Etapa 0 — Setup</CardTitle>
            <CardDescription>Base del sistema lista.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted">
            Monorepo, auth, permisos, schema y seed configurados.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Etapa 1 — Relevamiento</CardTitle>
            <CardDescription>En curso con Cardi.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted">
            Obras, cajas, categorías y definiciones pendientes (Fase 4).
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Etapa 2 — Billetera</CardTitle>
            <CardDescription>Próxima.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted">
            Ingresos, egresos con imputación, transferencias y cambio USD→ARS.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
