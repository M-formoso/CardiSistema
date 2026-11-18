import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Input de monto con formato argentino mientras se escribe:
 * - Separador de miles con "."
 * - Decimal con ","
 * - Max 2 decimales
 * - Acepta "." o "," como separador decimal en la entrada
 *
 * El componente guarda y devuelve el string "crudo" (ej: "1234567.89")
 * para que el back/los calculos sigan funcionando igual. Lo que se MUESTRA
 * es el formato "1.234.567,89".
 *
 * Reemplaza el típico `<Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />`:
 *
 *   <MoneyInput value={monto} onChange={setMonto} />
 *
 * Mantiene la posición del cursor correctamente al reformatear.
 */
export type MoneyInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  value: string;
  onChange: (v: string) => void;
};

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput({ value, onChange, className, ...rest }, forwardedRef) {
    const internalRef = React.useRef<HTMLInputElement>(null);
    const ref = (forwardedRef as React.RefObject<HTMLInputElement>) ?? internalRef;

    // Si el valor viene desde afuera (ej: autocompletado por cheque), se re-formatea.
    const display = formatDisplay(value);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const inputVal = e.target.value;
      const cursorBefore = e.target.selectionStart ?? inputVal.length;

      // Cantidad de dígitos a la izquierda del cursor en lo tipeado
      const digitsBeforeCursor = countDigits(inputVal.slice(0, cursorBefore));

      // Parsear: dejar solo dígitos y UN separador decimal (acepta "." y ",")
      const parsed = parseInputToRaw(inputVal);
      onChange(parsed);

      // Re-posicionar el cursor después del re-render en la posición que tenga
      // la misma cantidad de dígitos a la izquierda
      requestAnimationFrame(() => {
        const node = ref.current;
        if (!node) return;
        const newDisplay = formatDisplay(parsed);
        const newPos = posOfDigit(newDisplay, digitsBeforeCursor);
        node.setSelectionRange(newPos, newPos);
      });
    }

    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'num text-right tabular-nums',
          className,
        )}
        {...rest}
      />
    );
  },
);

// ========== helpers ==========

function countDigits(s: string): number {
  let n = 0;
  for (const c of s) if (c >= '0' && c <= '9') n++;
  return n;
}

/**
 * De lo tipeado al string crudo tipo "1234567.89".
 * Acepta que el usuario escriba tanto "," como "." como separador decimal.
 */
function parseInputToRaw(input: string): string {
  // Quitar todo menos dígitos y separadores
  const s = input.replace(/[^\d.,]/g, '');
  // Si hay varios separadores, solo el ÚLTIMO cuenta como decimal
  const commaIdx = s.lastIndexOf(',');
  const dotIdx = s.lastIndexOf('.');
  const decSep = Math.max(commaIdx, dotIdx);
  if (decSep === -1) {
    // Sin decimal
    return s.replace(/[.,]/g, '');
  }
  const intPart = s.slice(0, decSep).replace(/[.,]/g, '');
  const decPart = s
    .slice(decSep + 1)
    .replace(/[.,]/g, '')
    .slice(0, 2); // max 2 decimales
  if (!decPart) return intPart;
  return `${intPart}.${decPart}`;
}

/**
 * Del string crudo "1234567.89" a la visualización "1.234.567,89".
 * Mantiene coma final si el user acaba de tipearla ("1234567.") → "1.234.567,"
 */
function formatDisplay(raw: string): string {
  if (!raw) return '';
  const [intPart, decPart] = raw.split('.');
  const intFmt = intPart ? Number(intPart).toLocaleString('es-AR') : '';
  if (decPart !== undefined) return `${intFmt || '0'},${decPart}`;
  return intFmt;
}

/**
 * Dada una visualización ("1.234.567,89") y una cantidad de dígitos,
 * devuelve la posición (índice) donde está el N-ésimo dígito/coma desde la izquierda.
 */
function posOfDigit(display: string, digitsCount: number): number {
  if (digitsCount === 0) return 0;
  let count = 0;
  for (let i = 0; i < display.length; i++) {
    const c = display[i];
    if ((c >= '0' && c <= '9') || c === ',') count++;
    if (count === digitsCount) return i + 1;
  }
  return display.length;
}
