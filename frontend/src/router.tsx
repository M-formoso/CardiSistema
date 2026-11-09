import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RutaProtegida } from '@/components/layout/RutaProtegida';
import { LoginPage } from '@/pages/LoginPage';
import { InicioPage } from '@/pages/InicioPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { ObrasPage } from '@/pages/ObrasPage';
import { BeneficiariosPage } from '@/pages/BeneficiariosPage';
import { CategoriasPage } from '@/pages/CategoriasPage';
import { CajasPage } from '@/pages/CajasPage';
import { MovimientosPage } from '@/pages/movimientos/MovimientosPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RutaProtegida />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <InicioPage /> },
          { path: 'movimientos', element: <MovimientosPage /> },
          { path: 'obras', element: <ObrasPage /> },
          { path: 'beneficiarios', element: <BeneficiariosPage /> },
          { path: 'categorias', element: <CategoriasPage /> },
          { path: 'cajas', element: <CajasPage /> },
          {
            path: 'liquidaciones',
            element: <PlaceholderPage titulo="Liquidaciones semanales" etapa="Etapa 3" />,
          },
          {
            path: 'compromisos',
            element: <PlaceholderPage titulo="Compromisos y vencimientos" etapa="Etapa 3" />,
          },
          {
            path: 'reportes',
            element: <PlaceholderPage titulo="Reportes y consultas" etapa="Etapa 3" />,
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
