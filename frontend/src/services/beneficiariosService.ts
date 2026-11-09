import { apiClient } from '@/lib/apiClient';

export type TipoBeneficiario = 'EMPLEADO' | 'CONTRATISTA' | 'PROVEEDOR' | 'PROFESIONAL' | 'OTRO';

export type Beneficiario = {
  id: string;
  tipo: TipoBeneficiario;
  nombre: string;
  cuitCuil?: string | null;
  rubro?: string | null;
  contacto?: string | null;
  condicionPago?: string | null;
  observaciones?: string | null;
  activo: boolean;
  createdAt: string;
  legajo?: EmpleadoLegajo | null;
  aliases?: Array<{ id: string; alias: string }>;
};

export type EmpleadoLegajo = {
  id: string;
  beneficiarioId: string;
  fechaIngreso: string;
  jornal?: string | null;
  montoSemanal?: string | null;
  moneda: 'ARS' | 'USD';
  obraActualId?: string | null;
  observaciones?: string | null;
};

export const beneficiariosService = {
  list: async (params?: { tipo?: TipoBeneficiario; q?: string; activo?: boolean }) => {
    const { data } = await apiClient.get<Beneficiario[]>('/beneficiarios', { params });
    return data;
  },
  get: async (id: string) => {
    const { data } = await apiClient.get<Beneficiario>(`/beneficiarios/${id}`);
    return data;
  },
  create: async (input: Partial<Beneficiario> & { tipo: TipoBeneficiario; nombre: string }) => {
    const { data } = await apiClient.post<Beneficiario>('/beneficiarios', input);
    return data;
  },
  update: async (id: string, input: Partial<Beneficiario>) => {
    const { data } = await apiClient.patch<Beneficiario>(`/beneficiarios/${id}`, input);
    return data;
  },
  desactivar: async (id: string) => {
    const { data } = await apiClient.delete<Beneficiario>(`/beneficiarios/${id}`);
    return data;
  },
};
