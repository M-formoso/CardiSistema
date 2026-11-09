import { apiClient } from '@/lib/apiClient';

export type CotizacionHoy = {
  cotizaciones: Array<{
    tipo: 'BLUE' | 'OFICIAL';
    fuente: 'DOLARAPI' | 'AMBITO' | 'ARGENTINADATOS' | 'MANUAL';
    compra: number;
    venta: number;
    fecha: string;
  }>;
  actualizadoAt: string;
  fuentePrimaria: string;
};

export type CotizacionHistorica = {
  id: string;
  fecha: string;
  tipo: 'BLUE' | 'OFICIAL';
  fuente: string;
  compra: string;
  venta: string;
};

export const cotizacionesService = {
  hoy: async () => {
    const { data } = await apiClient.get<CotizacionHoy>('/cotizaciones/dolar');
    return data;
  },
  ultima: async () => {
    const { data } = await apiClient.get<CotizacionHistorica | null>('/cotizaciones/ultima');
    return data;
  },
  historicas: async (params?: { desde?: string; hasta?: string; limit?: number }) => {
    const { data } = await apiClient.get<CotizacionHistorica[]>('/cotizaciones/historicas', {
      params,
    });
    return data;
  },
};
