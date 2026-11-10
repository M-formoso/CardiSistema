import { apiClient } from '@/lib/apiClient';

export type Recibo = {
  id: string;
  numero: number;
  fecha: string;
  beneficiarioId?: string | null;
  monto: string;
  moneda: 'ARS' | 'USD';
  concepto: string;
  pdfPath?: string | null;
  beneficiario?: { id: string; nombre: string; tipo: string } | null;
};

export const recibosService = {
  list: async (params: { beneficiarioId?: string; desde?: string; hasta?: string } = {}) =>
    (await apiClient.get<Recibo[]>('/recibos', { params })).data,
  get: async (id: string) => (await apiClient.get<Recibo>(`/recibos/${id}`)).data,
  pdfUrl: (id: string) => `${apiClient.defaults.baseURL}/recibos/${id}/pdf`,
  async downloadPdf(id: string) {
    const res = await apiClient.get(`/recibos/${id}/pdf`, { responseType: 'blob' });
    const blob = res.data as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recibo-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  async openPdfInNewTab(id: string) {
    const res = await apiClient.get(`/recibos/${id}/pdf`, { responseType: 'blob' });
    const blob = res.data as Blob;
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};
