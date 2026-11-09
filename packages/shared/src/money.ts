import { Decimal } from 'decimal.js';

/**
 * Toda la aritmética de dinero del sistema Cardi.
 * Nunca usar `number` para plata o cotizaciones.
 *
 * Reglas:
 * - Dinero: 2 decimales (ARS y USD).
 * - Cotizaciones: 4 decimales.
 * - El redondeo que cierra siempre se aplica a la última línea
 *   para que la suma de imputaciones sea exacta.
 */

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type MontoInput = string | number | Decimal;

/**
 * Convierte cualquier input a Decimal, rechazando NaN/Infinity.
 */
export function toDecimal(value: MontoInput): Decimal {
  const d = new Decimal(value);
  if (!d.isFinite()) {
    throw new Error(`Monto inválido: ${String(value)}`);
  }
  return d;
}

/**
 * Redondea a 2 decimales, half-up. Usar para montos en ARS/USD.
 */
export function redondearMonto(value: MontoInput): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Redondea a 4 decimales, half-up. Usar para cotizaciones (ARS por 1 USD).
 */
export function redondearCotizacion(value: MontoInput): Decimal {
  return toDecimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

/**
 * Convierte un monto en USD a su equivalente en ARS usando la cotización dada.
 * cotizacion = ARS por 1 USD.
 */
export function usdAArs(montoUsd: MontoInput, cotizacion: MontoInput): Decimal {
  return redondearMonto(toDecimal(montoUsd).mul(toDecimal(cotizacion)));
}

/**
 * Convierte un monto en ARS a su equivalente en USD usando la cotización dada.
 * cotizacion = ARS por 1 USD.
 */
export function arsAUsd(montoArs: MontoInput, cotizacion: MontoInput): Decimal {
  const cot = toDecimal(cotizacion);
  if (cot.isZero()) {
    throw new Error('Cotización no puede ser cero');
  }
  return redondearMonto(toDecimal(montoArs).div(cot));
}

export type ImputacionInput = {
  obraId: string;
  monto?: MontoInput;
  porcentaje?: MontoInput;
};

export type ImputacionResultado = {
  obraId: string;
  monto: Decimal;
  porcentaje: Decimal;
};

/**
 * Reparte un monto entre varias imputaciones.
 *
 * Cada imputación puede venir con `monto` explícito o con `porcentaje` (0-100).
 * - Si todas tienen `monto`: suma exacta == total (sino lanza).
 * - Si todas tienen `porcentaje`: suma exacta == 100 (sino lanza). El redondeo
 *   residual del cálculo se acumula en la última línea para que la suma
 *   de los montos finales == total exacto.
 * - No se permite mezclar monto y porcentaje en la misma llamada.
 *
 * Devuelve siempre monto + porcentaje calculados.
 */
export function repartirMonto(
  total: MontoInput,
  imputaciones: ImputacionInput[],
): ImputacionResultado[] {
  if (imputaciones.length === 0) {
    throw new Error('Debe haber al menos una imputación');
  }

  const totalDec = redondearMonto(total);

  const tieneMonto = imputaciones.filter((i) => i.monto !== undefined && i.monto !== null).length;
  const tienePorcentaje = imputaciones.filter(
    (i) => i.porcentaje !== undefined && i.porcentaje !== null,
  ).length;

  if (tieneMonto > 0 && tienePorcentaje > 0) {
    throw new Error(
      'No se puede mezclar monto y porcentaje en la misma lista de imputaciones',
    );
  }

  if (tieneMonto === imputaciones.length) {
    // Modo monto: valido que cierre exacto.
    const resultados = imputaciones.map((i) => ({
      obraId: i.obraId,
      monto: redondearMonto(i.monto!),
      porcentaje: totalDec.isZero()
        ? new Decimal(0)
        : redondearCotizacion(toDecimal(i.monto!).div(totalDec).mul(100)),
    }));
    const sumaMontos = resultados.reduce((acc, r) => acc.add(r.monto), new Decimal(0));
    if (!sumaMontos.equals(totalDec)) {
      throw new Error(
        `Suma de imputaciones (${sumaMontos.toFixed(2)}) no coincide con el total (${totalDec.toFixed(2)})`,
      );
    }
    return resultados;
  }

  if (tienePorcentaje === imputaciones.length) {
    // Modo porcentaje: valido que sume 100, calculo montos y ajusto redondeo en la última línea.
    const porcentajes = imputaciones.map((i) => toDecimal(i.porcentaje!));
    const sumaPorcentajes = porcentajes.reduce((acc, p) => acc.add(p), new Decimal(0));
    if (!sumaPorcentajes.equals(100)) {
      throw new Error(
        `Suma de porcentajes (${sumaPorcentajes.toString()}) debe ser 100`,
      );
    }

    const montosProvisorios = porcentajes.map((p) =>
      redondearMonto(totalDec.mul(p).div(100)),
    );
    // Ajuste de redondeo: diferencia va a la última línea.
    const sumaProv = montosProvisorios.reduce((acc, m) => acc.add(m), new Decimal(0));
    const diferencia = totalDec.sub(sumaProv);
    const idxUltima = montosProvisorios.length - 1;
    montosProvisorios[idxUltima] = redondearMonto(
      montosProvisorios[idxUltima].add(diferencia),
    );

    return imputaciones.map((i, idx) => ({
      obraId: i.obraId,
      monto: montosProvisorios[idx],
      porcentaje: redondearCotizacion(porcentajes[idx]),
    }));
  }

  throw new Error(
    'Cada imputación debe tener monto o porcentaje, y todas del mismo tipo',
  );
}

/**
 * Valida que la suma de montos de imputaciones sea exactamente el total.
 * Lanza error si no coincide.
 */
export function validarSumaImputaciones(
  total: MontoInput,
  imputaciones: Array<{ monto: MontoInput }>,
): void {
  const totalDec = redondearMonto(total);
  const suma = imputaciones.reduce(
    (acc, i) => acc.add(toDecimal(i.monto)),
    new Decimal(0),
  );
  if (!suma.equals(totalDec)) {
    throw new Error(
      `Suma de imputaciones (${suma.toFixed(2)}) no coincide con el total (${totalDec.toFixed(2)})`,
    );
  }
}

/**
 * Formato argentino: "$ 1.234,56" (ARS) o "US$ 1.234,56" (USD).
 * Útil en PDFs / respuestas de API. El frontend usa Intl.NumberFormat.
 */
export function formatearMonto(value: MontoInput, moneda: 'ARS' | 'USD'): string {
  const d = redondearMonto(value);
  const absStr = d.abs().toFixed(2);
  const [entero, decimal] = absStr.split('.');
  const enteroFmt = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const signo = d.isNegative() ? '-' : '';
  const prefijo = moneda === 'ARS' ? '$' : 'US$';
  return `${signo}${prefijo} ${enteroFmt},${decimal}`;
}
