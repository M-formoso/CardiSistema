import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Texto que achica el fontSize hasta que entre en el ancho del padre.
 * Útil para números grandes en stat cards que no se pueden truncar.
 *
 * Mide con ResizeObserver, re-ajusta si cambia el contenido o el padre.
 * Si ni al tamaño mínimo entra, deja el mínimo (preferible a truncar: la
 * card es un indicador clave, no debe ocultar dígitos).
 */
export function FitText({
  children,
  maxSize = 30,
  minSize = 14,
  className,
}: {
  children: React.ReactNode;
  /** Font-size en px cuando sobra lugar */
  maxSize?: number;
  /** Font-size en px mínimo — nunca baja de acá */
  minSize?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(maxSize);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const fit = () => {
      // Arranco del máximo y bajo 1px por vez hasta que entre
      let s = maxSize;
      el.style.fontSize = `${s}px`;
      // scrollWidth incluye el overflow; clientWidth del padre es el disponible
      while (el.scrollWidth > parent.clientWidth && s > minSize) {
        s -= 1;
        el.style.fontSize = `${s}px`;
      }
      setSize(s);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [children, maxSize, minSize]);

  return (
    <span
      ref={ref}
      className={cn('whitespace-nowrap tabular-nums', className)}
      style={{ fontSize: size, lineHeight: 1.1 }}
    >
      {children}
    </span>
  );
}
