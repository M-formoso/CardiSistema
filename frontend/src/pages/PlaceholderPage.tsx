import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PlaceholderPage({ titulo, etapa }: { titulo: string; etapa: string }) {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted">
        Este módulo se desarrolla en la <strong>{etapa}</strong>. Por ahora, sin funcionalidad.
      </CardContent>
    </Card>
  );
}
