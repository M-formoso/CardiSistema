/**
 * Formatos argentinos para toda la UI de Cardi.
 * Fechas: dd/MM/yyyy. Montos ARS: "$ 1.234,56". USD: "US$ 1.234,56".
 */

const ARS_FORMATTER = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_FORMATTER = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatearArs(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return `$ ${ARS_FORMATTER.format(n)}`;
}

export function formatearUsd(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return `US$ ${USD_FORMATTER.format(n)}`;
}

export function formatearMonto(value: number | string, moneda: 'ARS' | 'USD'): string {
  return moneda === 'ARS' ? formatearArs(value) : formatearUsd(value);
}

export function formatearFecha(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return DATE_FORMATTER.format(d);
}

export function formatearFechaHora(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return DATETIME_FORMATTER.format(d);
}
