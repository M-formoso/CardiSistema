import { apiClient } from '@/lib/apiClient';

export type ProveedorLista = {
  id: string;
  nombre: string;
  cuitCuil: string | null;
  contacto: string | null;
  condicionPago: string | null;
  activo: boolean;
  ultimoResumenFecha: string | null;
  ultimoResumenMonto: string | null;
  saldoTotal: string;
  cantidadPagos: number;
};

export type SaldoPorObra = {
  obraId: string;
  nombre: string;
  montoResumen: string;
  pagado: string;
  saldo: string;
};

export type PagoProveedor = {
  id: string;
  fecha: string;
  monto: string;
  moneda: 'ARS' | 'USD';
  medioPago: string;
  descripcion: string | null;
  caja: { nombre: string; moneda: 'ARS' | 'USD' };
  imputaciones: Array<{ obraId: string; obraNombre: string; monto: string }>;
  cheque: { numero: string; banco: string | null; estado: string } | null;
};

export type ResumenHistorico = {
  id: string;
  fecha: string;
  montoTotal: string;
  observaciones: string | null;
  items: Array<{ obraId: string; obraNombre: string; monto: string }>;
};

export type ProveedorDetalle = {
  proveedor: {
    id: string;
    nombre: string;
    cuitCuil: string | null;
    rubro: string | null;
    contacto: string | null;
    condicionPago: string | null;
    observaciones: string | null;
    activo: boolean;
  };
  saldoTotal: string;
  ultimoResumen: {
    id: string;
    fecha: string;
    montoTotal: string;
    observaciones: string | null;
  } | null;
  saldosPorObra: SaldoPorObra[];
  pagos: PagoProveedor[];
  resumenesHistoricos: ResumenHistorico[];
};

export type CrearResumenInput = {
  fecha: string;
  observaciones?: string;
  items: Array<{ obraId: string; monto: number }>;
};

export const proveedoresService = {
  list: async (params: { q?: string; activo?: boolean } = {}) =>
    (await apiClient.get<ProveedorLista[]>('/proveedores', { params })).data,
  get: async (id: string) =>
    (await apiClient.get<ProveedorDetalle>(`/proveedores/${id}`)).data,
  crearResumen: async (proveedorId: string, input: CrearResumenInput) =>
    (await apiClient.post(`/proveedores/${proveedorId}/resumenes`, input)).data,
  eliminarResumen: async (proveedorId: string, resumenId: string) =>
    (await apiClient.delete(`/proveedores/${proveedorId}/resumenes/${resumenId}`)).data,
};
