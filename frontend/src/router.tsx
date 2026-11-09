import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RutaProtegida } from '@/components/layout/RutaProtegida';
import { LoginPage } from '@/pages/LoginPage';
import { InicioPage } from '@/pages/InicioPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RutaProtegida />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <InicioPage /> },
          {
            path: 'movimientos',
            element: <PlaceholderPage titulo="Movimientos" etapa="Etapa 2 (billetera)" />,
          },
          {
            path: 'obras',
            element: <PlaceholderPage titulo="Obras" etapa="Etapa 2" />,
          },
          {
            path: 'beneficiarios',
            element: <PlaceholderPage titulo="Beneficiarios" etapa="Etapa 2" />,
          },
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
