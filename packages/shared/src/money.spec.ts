import { Decimal } from 'decimal.js';
import {
  arsAUsd,
  formatearMonto,
  redondearCotizacion,
  redondearMonto,
  repartirMonto,
  toDecimal,
  usdAArs,
  validarSumaImputaciones,
} from './money';

describe('toDecimal', () => {
  it('acepta string, number y Decimal', () => {
    expect(toDecimal('123.45').toString()).toBe('123.45');
    expect(toDecimal(123.45).toString()).toBe('123.45');
    expect(toDecimal(new Decimal('123.45')).toString()).toBe('123.45');
  });

  it('rechaza NaN', () => {
    expect(() => toDecimal(NaN)).toThrow(/inválido/);
  });

  it('rechaza Infinity', () => {
    expect(() => toDecimal(Infinity)).toThrow(/inválido/);
  });
});

describe('redondearMonto', () => {
  it('redondea a 2 decimales con half-up', () => {
    expect(redondearMonto('1.234').toString()).toBe('1.23');
    expect(redondearMonto('1.235').toString()).toBe('1.24');
    expect(redondearMonto('1.236').toString()).toBe('1.24');
  });

  it('mantiene precisión en montos grandes', () => {
    expect(redondearMonto('1234567890.12').toString()).toBe('1234567890.12');
  });
});

describe('redondearCotizacion', () => {
  it('redondea a 4 decimales', () => {
    expect(redondearCotizacion('1234.56789').toString()).toBe('1234.5679');
  });
});

describe('usdAArs', () => {
  it('multiplica y redondea a 2', () => {
    // 100 USD * 1234.56 = 123456.00
    expect(usdAArs('100', '1234.56').toString()).toBe('123456');
    // 1.5 USD * 1234.5678 = 1851.8517 → redondeo 1851.85
    expect(usdAArs('1.5', '1234.5678').toString()).toBe('1851.85');
  });

  it('maneja ceros', () => {
    expect(usdAArs('0', '1234.56').toString()).toBe('0');
  });
});

describe('arsAUsd', () => {
  it('divide y redondea a 2', () => {
    expect(arsAUsd('123456', '1234.56').toString()).toBe('100');
    // 1234.56 / 1234.56 = 1.00
    expect(arsAUsd('1234.56', '1234.56').toString()).toBe('1');
  });

  it('rechaza cotización cero', () => {
    expect(() => arsAUsd('100', '0')).toThrow(/cero/);
  });
});

describe('repartirMonto — modo monto explícito', () => {
  it('reparte entre 2 obras con montos exactos', () => {
    const r = repartirMonto('1000', [
      { obraId: 'o1', monto: '600' },
      { obraId: 'o2', monto: '400' },
    ]);
    expect(r[0].monto.toString()).toBe('600');
    expect(r[1].monto.toString()).toBe('400');
    expect(r[0].porcentaje.toString()).toBe('60');
    expect(r[1].porcentaje.toString()).toBe('40');
  });

  it('acepta 1 sola imputación por el total', () => {
    const r = repartirMonto('1000', [{ obraId: 'o1', monto: '1000' }]);
    expect(r).toHaveLength(1);
    expect(r[0].monto.toString()).toBe('1000');
    expect(r[0].porcentaje.toString()).toBe('100');
  });

  it('rechaza si la suma de montos no coincide con el total', () => {
    expect(() =>
      repartirMonto('1000', [
        { obraId: 'o1', monto: '600' },
        { obraId: 'o2', monto: '300' },
      ]),
    ).toThrow(/no coincide/);
  });
});

describe('repartirMonto — modo porcentaje', () => {
  it('reparte 50/50 exacto', () => {
    const r = repartirMonto('1000', [
      { obraId: 'o1', porcentaje: '50' },
      { obraId: 'o2', porcentaje: '50' },
    ]);
    expect(r[0].monto.toString()).toBe('500');
    expect(r[1].monto.toString()).toBe('500');
  });

  it('ajusta el redondeo en la última línea para que la suma sea exacta', () => {
    // 100.00 / 3 = 33.33333... → 33.33 + 33.33 + 33.34 = 100.00
    const r = repartirMonto('100', [
      { obraId: 'o1', porcentaje: '33.3333' },
      { obraId: 'o2', porcentaje: '33.3333' },
      { obraId: 'o3', porcentaje: '33.3334' },
    ]);
    const suma = r.reduce((acc, i) => acc.add(i.monto), new Decimal(0));
    expect(suma.toString()).toBe('100');
    // La última línea absorbe la diferencia.
    expect(r[0].monto.toString()).toBe('33.33');
    expect(r[1].monto.toString()).toBe('33.33');
    expect(r[2].monto.toString()).toBe('33.34');
  });

  it('rechaza si los porcentajes no suman 100', () => {
    expect(() =>
      repartirMonto('1000', [
        { obraId: 'o1', porcentaje: '50' },
        { obraId: 'o2', porcentaje: '40' },
      ]),
    ).toThrow(/debe ser 100/);
  });

  it('cubre el caso típico de 70/30', () => {
    const r = repartirMonto('12345.67', [
      { obraId: 'o1', porcentaje: '70' },
      { obraId: 'o2', porcentaje: '30' },
    ]);
    const suma = r.reduce((acc, i) => acc.add(i.monto), new Decimal(0));
    expect(suma.toString()).toBe('12345.67');
  });
});

describe('repartirMonto — validaciones', () => {
  it('rechaza lista vacía', () => {
    expect(() => repartirMonto('1000', [])).toThrow(/al menos una/);
  });

  it('rechaza mezcla de monto y porcentaje', () => {
    expect(() =>
      repartirMonto('1000', [
        { obraId: 'o1', monto: '500' },
        { obraId: 'o2', porcentaje: '50' },
      ]),
    ).toThrow(/mezclar/);
  });

  it('rechaza imputaciones sin monto ni porcentaje', () => {
    expect(() => repartirMonto('1000', [{ obraId: 'o1' }])).toThrow();
  });
});

describe('validarSumaImputaciones', () => {
  it('pasa cuando suma coincide', () => {
    expect(() =>
      validarSumaImputaciones('1000', [{ monto: '600' }, { monto: '400' }]),
    ).not.toThrow();
  });

  it('lanza cuando suma no coincide', () => {
    expect(() =>
      validarSumaImputaciones('1000', [{ monto: '600' }, { monto: '300' }]),
    ).toThrow(/no coincide/);
  });
});

describe('formatearMonto', () => {
  it('formatea ARS con separador de miles y coma decimal', () => {
    expect(formatearMonto('1234567.89', 'ARS')).toBe('$ 1.234.567,89');
    expect(formatearMonto('1234.5', 'ARS')).toBe('$ 1.234,50');
    expect(formatearMonto('0', 'ARS')).toBe('$ 0,00');
  });

  it('formatea USD con prefijo US$', () => {
    expect(formatearMonto('1800', 'USD')).toBe('US$ 1.800,00');
    expect(formatearMonto('1234.56', 'USD')).toBe('US$ 1.234,56');
  });

  it('maneja negativos con signo antes del prefijo', () => {
    expect(formatearMonto('-1234.56', 'ARS')).toBe('-$ 1.234,56');
    expect(formatearMonto('-1800', 'USD')).toBe('-US$ 1.800,00');
  });
});
