import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RutaProtegida } from '@/components/layout/RutaProtegida';
import { LoginPage } from '@/pages/LoginPage';
import { InicioPage } from '@/pages/InicioPage';
import { ObrasPage } from '@/pages/ObrasPage';
import { BeneficiariosPage } from '@/pages/BeneficiariosPage';
import { CategoriasPage } from '@/pages/CategoriasPage';
import { CajasPage } from '@/pages/CajasPage';
import { ChequesPage } from '@/pages/ChequesPage';
import { MovimientosPage } from '@/pages/movimientos/MovimientosPage';
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
          { index: true, element: <InicioPage /> },
          { path: 'movimientos', element: <MovimientosPage /> },
          { path: 'cheques', element: <ChequesPage /> },
          { path: 'cajas', element: <CajasPage /> },
          { path: 'obras', element: <ObrasPage /> },
          { path: 'beneficiarios', element: <BeneficiariosPage /> },
          { path: 'categorias', element: <CategoriasPage /> },
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
