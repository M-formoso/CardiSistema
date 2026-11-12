import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RutaProtegida } from '@/components/layout/RutaProtegida';
import { LoginPage } from '@/pages/LoginPage';
import { BilleteraPage } from '@/pages/billetera/BilleteraPage';
import { PagosPage } from '@/pages/PagosPage';
import { ConfiguracionPage } from '@/pages/ConfiguracionPage';
import { UsuariosPage } from '@/pages/UsuariosPage';
import { ReportesPage } from '@/pages/ReportesPage';
import { ObraDetallePage } from '@/pages/reportes/ObraDetallePage';
import { LiquidacionDetallePage } from '@/pages/liquidaciones/LiquidacionDetallePage';
import { EmpleadosPage } from '@/pages/EmpleadosPage';
import { EmpleadoDetallePage } from '@/pages/empleados/EmpleadoDetallePage';
import { CertificacionesPage } from '@/pages/CertificacionesPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RutaProtegida />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // Home: billetera
          { index: true, element: <BilleteraPage /> },

          // Hubs consolidados
          { path: 'pagos', element: <PagosPage /> },
          { path: 'configuracion', element: <ConfiguracionPage /> },

          // Secciones top-level nuevas
          { path: 'empleados', element: <EmpleadosPage /> },
          { path: 'empleados/:id', element: <EmpleadoDetallePage /> },
          { path: 'certificaciones', element: <CertificacionesPage /> },

          // Detalle que necesita ruta propia (link desde dentro de un tab)
          { path: 'liquidaciones/:id', element: <LiquidacionDetallePage /> },

          // Reportes
          { path: 'reportes', element: <ReportesPage /> },
          { path: 'reportes/obras/:id', element: <ObraDetallePage /> },

          // Usuarios (ABM, solo ADMIN)
          { path: 'usuarios', element: <UsuariosPage /> },

          // Redirects legacy — viejas rutas ahora viven dentro de los hubs
          { path: 'movimientos', element: <Navigate to="/" replace /> },
          { path: 'cheques', element: <Navigate to="/" replace /> },
          { path: 'cajas', element: <Navigate to="/" replace /> },
          { path: 'billetera', element: <Navigate to="/" replace /> },
          { path: 'obras', element: <Navigate to="/configuracion?tab=obras" replace /> },
          {
            path: 'beneficiarios',
            element: <Navigate to="/configuracion?tab=beneficiarios" replace />,
          },
          {
            path: 'categorias',
            element: <Navigate to="/configuracion?tab=categorias" replace />,
          },
          {
            path: 'liquidaciones',
            element: <Navigate to="/pagos?tab=liquidaciones" replace />,
          },
          { path: 'contratos', element: <Navigate to="/pagos?tab=cuotas" replace /> },
          { path: 'compromisos', element: <Navigate to="/pagos?tab=compromisos" replace /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
