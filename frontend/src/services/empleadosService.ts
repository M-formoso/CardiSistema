import { apiClient } from '@/lib/apiClient';
import type { TipoBeneficiario } from './beneficiariosService';

export type SituacionFiscal = 'BLANCO' | 'NEGRO';

export type EmpleadoJornalHistorico = {
  id: string;
  jornal: string;
  valorHoraExtra?: string | null;
  vigenteDesde: string;
  motivo?: string | null;
  createdAt: string;
};

export type EmpleadoLegajoExtendido = {
  id: string;
  beneficiarioId: string;
  fechaIngreso: string;
  dni?: string | null;
  empresaId?: string | null;
  categoriaId?: string | null;
  situacionFiscal: SituacionFiscal;
  jornal?: string | null;
  valorHoraExtra?: string | null;
  montoSemanal?: string | null;
  moneda: 'ARS' | 'USD';
  obraActualId?: string | null;
  observaciones?: string | null;
  empresa?: { id: string; nombre: string } | null;
  categoria?: { id: string; codigo: string; nombre: string; jornal?: string | null } | null;
  historialJornales?: EmpleadoJornalHistorico[];
};

export type Empleado = {
  id: string;
  tipo: TipoBeneficiario;
  nombre: string;
  cuitCuil?: string | null;
  activo: boolean;
  createdAt: string;
  legajo?: EmpleadoLegajoExtendido | null;
  aliases?: Array<{ id: string; alias: string }>;
};

export type CreateEmpleadoInput = {
  nombre: string;
  dni?: string;
  cuitCuil?: string;
  empresaId?: string;
  categoriaId?: string;
  situacionFiscal?: SituacionFiscal;
  fechaIngreso: string;
  jornal?: number;
  valorHoraExtra?: number;
  obraActualId?: string;
  contacto?: string;
  observaciones?: string;
  aliases?: string[];
};

export type UpdateEmpleadoInput = Partial<{
  nombre: string;
  dni: string | null;
  cuitCuil: string | null;
  empresaId: string | null;
  categoriaId: string | null;
  situacionFiscal: SituacionFiscal;
  fechaIngreso: string;
  obraActualId: string | null;
  contacto: string | null;
  observaciones: string | null;
  activo: boolean;
}>;

export type FiltrosEmpleado = {
  activo?: boolean;
  empresaId?: string;
  categoriaId?: string;
  obraId?: string;
  situacionFiscal?: SituacionFiscal;
  q?: string;
};

export const empleadosService = {
  list: async (filtros: FiltrosEmpleado = {}) =>
    (await apiClient.get<Empleado[]>('/empleados', { params: filtros })).data,
  get: async (id: string) => (await apiClient.get<Empleado>(`/empleados/${id}`)).data,
  create: async (input: CreateEmpleadoInput) =>
    (await apiClient.post<Empleado>('/empleados', input)).data,
  update: async (id: string, input: UpdateEmpleadoInput) =>
    (await apiClient.patch<Empleado>(`/empleados/${id}`, input)).data,
  desactivar: async (id: string) => (await apiClient.delete<Empleado>(`/empleados/${id}`)).data,
  historialJornales: async (id: string) =>
    (await apiClient.get<EmpleadoJornalHistorico[]>(`/empleados/${id}/jornales`)).data,
  actualizarJornal: async (
    id: string,
    input: { jornal: number; valorHoraExtra?: number; vigenteDesde?: string; motivo?: string },
  ) =>
    (await apiClient.put<EmpleadoJornalHistorico>(`/empleados/${id}/jornal`, input)).data,
  liquidacionesDe: async (id: string) =>
    (
      await apiClient.get<
        Array<{
          id: string;
          nombreLibre: string;
          subtotal: string;
          aPagar: string;
          pagado: boolean;
          liquidacion: {
            id: string;
            semanaInicio: string;
            semanaFin: string;
            estado: string;
            obra: { id: string; nombre: string };
          };
        }>
      >(`/empleados/${id}/liquidaciones`)
    ).data,
  prestamosDe: async (id: string) =>
    (
      await apiClient.get<
        Array<{
          id: string;
          fecha: string;
          monto: string;
          saldoPendiente: string;
          estado: 'VIGENTE' | 'SALDADO' | 'ANULADO';
          observaciones?: string | null;
        }>
      >(`/empleados/${id}/prestamos`)
    ).data,
};
