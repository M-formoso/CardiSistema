import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Paginación compacta con selector de tamaño de página.
 * Diseñado para ir debajo de una tabla/lista grande.
 */
export function Pagination({
  total,
  page,
  pageSize,
  pageSizeOptions = [5, 10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  className,
}: {
  total: number;
  page: number; // 1-based
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  const goTo = (p: number) => onPageChange(Math.min(Math.max(1, p), totalPages));

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-3 py-1.5 text-sm',
        className,
      )}
    >
      {/* Selector de tamaño — en mobile compacto, en desktop con labels */}
      <div className="flex items-center gap-2 text-muted text-xs">
        <span className="hidden sm:inline">Mostrar</span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <span className="hidden sm:inline">por página</span>
      </div>

      {/* Info + navegación — en mobile sin labels de "Página X de Y" */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted tabular-nums whitespace-nowrap">
          {total === 0 ? 'Sin resultados' : `${start}–${end} de ${total}`}
        </span>
        <div className="flex items-center gap-0.5">
          <PageBtn aria="Primera" disabled={currentPage === 1} onClick={() => goTo(1)}>
            <ChevronsLeft className="h-4 w-4" />
          </PageBtn>
          <PageBtn
            aria="Anterior"
            disabled={currentPage === 1}
            onClick={() => goTo(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </PageBtn>
          <span className="px-1.5 text-xs tabular-nums whitespace-nowrap">
            <span className="hidden sm:inline">Página </span>
            <span className="font-medium text-foreground">{currentPage}</span>
            <span className="text-muted"> / {totalPages}</span>
          </span>
          <PageBtn
            aria="Siguiente"
            disabled={currentPage === totalPages}
            onClick={() => goTo(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </PageBtn>
          <PageBtn
            aria="Última"
            disabled={currentPage === totalPages}
            onClick={() => goTo(totalPages)}
          >
            <ChevronsRight className="h-4 w-4" />
          </PageBtn>
        </div>
      </div>
    </div>
  );
}

function PageBtn({
  children,
  disabled,
  onClick,
  aria,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  aria: string;
}) {
  return (
    <button
      type="button"
      aria-label={aria}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-7 w-7 flex items-center justify-center rounded-md',
        'text-foreground hover:bg-muted/10 transition-colors',
        'disabled:opacity-40 disabled:pointer-events-none',
      )}
    >
      {children}
    </button>
  );
}
