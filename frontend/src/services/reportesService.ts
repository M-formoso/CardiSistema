import { apiClient } from '@/lib/apiClient';

export type GastoPorObra = {
  obraId: string;
  nombre: string;
  tipo: string;
  estado: string;
  gastadoArs: string;
  gastadoUsd: string;
  contratado: string | null;
  monedaContrato: 'ARS' | 'USD' | null;
  restante: string | null;
  porcentajeConsumido: string | null;
};

export type GastoPorCategoria = {
  categoriaId: string;
  codigo: string;
  nombre: string;
  ars: string;
  usd: string;
  cantidad: number;
};

export type GastoPorMes = {
  mes: string; // "2026-11"
  ars: string;
  usd: string;
  cantidad: number;
};

export type DetalleObraItem = {
  fecha: string;
  descripcion: string | null;
  beneficiario: string | null;
  categoria: string | null;
  caja: string;
  moneda: 'ARS' | 'USD';
  monto: string;
  montoArs: string;
  montoUsd: string;
};

export type DetalleObra = {
  obra: {
    id: string;
    nombre: string;
    tipo: string;
    estado: string;
    comitente: string | null;
    constructora: string | null;
    ubicacion: string | null;
    montoContratado: string | null;
    monedaContrato: 'ARS' | 'USD' | null;
    activo: boolean;
  };
  totales: { ars: string; usd: string };
  items: DetalleObraItem[];
  totalItems: number;
};

export const reportesService = {
  gastoPorObra: async (params: { desde?: string; hasta?: string } = {}) =>
    (await apiClient.get<GastoPorObra[]>('/reportes/gasto-por-obra', { params })).data,
  gastoPorCategoria: async (params: { desde?: string; hasta?: string } = {}) =>
    (await apiClient.get<GastoPorCategoria[]>('/reportes/gasto-por-categoria', { params })).data,
  detalleObra: async (obraId: string, params: { desde?: string; hasta?: string } = {}) =>
    (await apiClient.get<DetalleObra>(`/reportes/obras/${obraId}/detalle`, { params })).data,
  obraPorCategoria: async (obraId: string, params: { desde?: string; hasta?: string } = {}) =>
    (
      await apiClient.get<GastoPorCategoria[]>(`/reportes/obras/${obraId}/por-categoria`, {
        params,
      })
    ).data,
  obraPorMes: async (obraId: string, params: { desde?: string; hasta?: string } = {}) =>
    (await apiClient.get<GastoPorMes[]>(`/reportes/obras/${obraId}/por-mes`, { params })).data,

  async downloadGastoPorObraExcel(params: { desde?: string; hasta?: string } = {}) {
    const res = await apiClient.get('/reportes/gasto-por-obra.xlsx', {
      params,
      responseType: 'blob',
    });
    this.triggerDownload(res.data as Blob, `gasto-por-obra-${hoyIso()}.xlsx`);
  },

  async downloadMovimientosExcel(params: {
    cajaId?: string;
    obraId?: string;
    beneficiarioId?: string;
    desde?: string;
    hasta?: string;
  } = {}) {
    const res = await apiClient.get('/reportes/movimientos.xlsx', {
      params,
      responseType: 'blob',
    });
    this.triggerDownload(res.data as Blob, `movimientos-${hoyIso()}.xlsx`);
  },

  triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}
