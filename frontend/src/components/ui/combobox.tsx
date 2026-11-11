import * as React from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ComboboxOption = {
  value: string;
  label: string;
  hint?: string;
};

type Props = {
  options: ComboboxOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  size?: 'sm' | 'default';
  /** Si está, se muestra como primera opción y limpia el filtro. */
  allLabel?: string;
};

/**
 * Combobox buscable: botón → dropdown con input de búsqueda + lista filtrada.
 * Navegación completa con teclado.
 *   - ↑/↓: mover selección
 *   - Enter: elegir
 *   - Esc: cerrar
 *   - escribir: filtrar por `label` y `hint`
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Elegí…',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Sin resultados',
  className,
  size = 'default',
  allLabel,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [highlight, setHighlight] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const optionsAll = React.useMemo(() => {
    if (!allLabel) return options;
    return [{ value: '', label: allLabel } as ComboboxOption, ...options];
  }, [options, allLabel]);

  const filtered = React.useMemo(() => {
    if (!search) return optionsAll;
    const q = search.toLowerCase().trim();
    return optionsAll.filter((o) => {
      // "Todos" siempre visible
      if (o.value === '' && allLabel) return true;
      return (
        o.label.toLowerCase().includes(q) ||
        (o.hint && o.hint.toLowerCase().includes(q))
      );
    });
  }, [optionsAll, search, allLabel]);

  const selected = optionsAll.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;

  // Cerrar al click fuera
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Focus en el input cuando se abre + reset
  React.useEffect(() => {
    if (open) {
      setSearch('');
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Asegurar que el highlighted se vea
  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  // Reset highlight cuando cambia el filtro
  React.useEffect(() => {
    setHighlight(0);
  }, [search]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
      }
      return;
    }
  }

  const hasSelection = value !== '';

  const sizeClasses =
    size === 'sm'
      ? 'h-8 text-xs px-2.5'
      : 'h-10 text-sm px-3';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between rounded-md border border-input bg-background',
          'hover:bg-muted/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'transition-colors',
          sizeClasses,
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted')}>{displayLabel}</span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {hasSelection && allLabel && (
            <button
              type="button"
              aria-label="Limpiar"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="text-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted" />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-xl overflow-hidden">
          {/* Search */}
          <div className="relative border-b border-border">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-2 py-2 text-sm bg-transparent border-0 focus:outline-none placeholder:text-muted"
            />
          </div>

          {/* List */}
          <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted">{emptyText}</div>
            )}
            {filtered.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlight;
              return (
                <button
                  key={opt.value || '__all__'}
                  type="button"
                  data-idx={idx}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                    isHighlighted && 'bg-primary/10',
                    isSelected && 'font-medium text-primary',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{opt.label}</div>
                    {opt.hint && (
                      <div className="text-[11px] text-muted truncate">{opt.hint}</div>
                    )}
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
