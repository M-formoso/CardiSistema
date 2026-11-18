import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Input de monto para pesos argentinos. Pedido Mateo 18/11 (segunda tanda):
 * - Solo enteros (sin decimales).
 * - Separador de miles con ".".
 * - Prefix "$" afuera del campo.
 * - Formato mientras se escribe, sin ambigüedad: todo lo que no sea dígito
 *   se ignora.
 *
 * El valor que guarda y devuelve el componente es el string "crudo" solo
 * con dígitos (ej: "1234567"). Si el padre lo setea con decimales desde
 * el backend (ej: "200000.00"), se trunca la parte decimal al mostrar.
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

    const display = formatDisplay(value);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const inputVal = e.target.value;
      const cursorBefore = e.target.selectionStart ?? inputVal.length;
      const digitsBeforeCursor = countDigits(inputVal.slice(0, cursorBefore));

      const parsed = parseInputToRaw(inputVal);
      onChange(parsed);

      // Reposicionar el cursor después del re-render en la posición que tenga
      // la misma cantidad de dígitos a la izquierda.
      requestAnimationFrame(() => {
        const node = ref.current;
        if (!node) return;
        const newDisplay = formatDisplay(parsed);
        const newPos = posOfDigit(newDisplay, digitsBeforeCursor);
        node.setSelectionRange(newPos, newPos);
      });
    }

    return (
      <div className="relative w-full">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
          aria-hidden
        >
          $
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-sm',
            'ring-offset-background placeholder:text-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'num text-right tabular-nums',
            className,
          )}
          {...rest}
        />
      </div>
    );
  },
);

// ========== helpers ==========

function countDigits(s: string): number {
  let n = 0;
  for (const c of s) if (c >= '0' && c <= '9') n++;
  return n;
}

/** Del input a solo dígitos. Ignora todo lo demás ($, puntos, comas, espacios). */
function parseInputToRaw(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Del string crudo "1234567" al display "1.234.567" con separador de miles.
 * Si viene con decimales desde el padre ("200000.00"), se trunca la parte
 * decimal (solo mostramos enteros).
 */
function formatDisplay(raw: string): string {
  if (!raw) return '';
  // Truncar decimales si el value viene con "."
  const intOnly = raw.split('.')[0].replace(/\D/g, '');
  if (!intOnly) return '';
  return Number(intOnly).toLocaleString('es-AR');
}

/**
 * Dado un display "1.234.567" y una cantidad de dígitos, devuelve el índice
 * donde poner el cursor para que haya esa cantidad de dígitos a su izquierda.
 */
function posOfDigit(display: string, digitsCount: number): number {
  if (digitsCount === 0) return 0;
  let count = 0;
  for (let i = 0; i < display.length; i++) {
    const c = display[i];
    if (c >= '0' && c <= '9') count++;
    if (count === digitsCount) return i + 1;
  }
  return display.length;
}
