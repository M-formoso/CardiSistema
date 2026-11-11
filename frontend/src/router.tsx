import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RutaProtegida } from '@/components/layout/RutaProtegida';
import { LoginPage } from '@/pages/LoginPage';
import { BilleteraPage } from '@/pages/billetera/BilleteraPage';
import { ObrasPage } from '@/pages/ObrasPage';
import { BeneficiariosPage } from '@/pages/BeneficiariosPage';
import { CategoriasPage } from '@/pages/CategoriasPage';
import { LiquidacionesPage } from '@/pages/liquidaciones/LiquidacionesPage';
import { LiquidacionDetallePage } from '@/pages/liquidaciones/LiquidacionDetallePage';
import { CertificacionesPage } from '@/pages/CertificacionesPage';
import { ContratosCuotasPage } from '@/pages/ContratosCuotasPage';
import { CompromisosPage } from '@/pages/CompromisosPage';
import { ReportesPage } from '@/pages/ReportesPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RutaProtegida />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // Billetera es el home: cajas + movimientos + cheques + cotización
          { index: true, element: <BilleteraPage /> },
          // Rutas viejas → redirigen a billetera
          { path: 'movimientos', element: <Navigate to="/" replace /> },
          { path: 'cheques', element: <Navigate to="/" replace /> },
          { path: 'cajas', element: <Navigate to="/" replace /> },
          { path: 'billetera', element: <Navigate to="/" replace /> },
          // Maestros
          { path: 'obras', element: <ObrasPage /> },
          { path: 'beneficiarios', element: <BeneficiariosPage /> },
          { path: 'categorias', element: <CategoriasPage /> },
          // Personas y compromisos
          { path: 'liquidaciones', element: <LiquidacionesPage /> },
          { path: 'liquidaciones/:id', element: <LiquidacionDetallePage /> },
          { path: 'certificaciones', element: <CertificacionesPage /> },
          { path: 'contratos', element: <ContratosCuotasPage /> },
          { path: 'compromisos', element: <CompromisosPage /> },
          { path: 'reportes', element: <ReportesPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
