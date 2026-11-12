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
        'flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-2.5 text-sm',
        className,
      )}
    >
      {/* Selector de tamaño */}
      <div className="flex items-center gap-2 text-muted">
        <span>Mostrar</span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1); // reset a página 1 al cambiar size
          }}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <span>por página</span>
      </div>

      {/* Info + navegación */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted tabular-nums">
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
          <span className="px-2 text-xs tabular-nums">
            Página <span className="font-medium text-foreground">{currentPage}</span> de{' '}
            {totalPages}
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
        'h-8 w-8 flex items-center justify-center rounded-md',
        'text-foreground hover:bg-muted/10 transition-colors',
        'disabled:opacity-40 disabled:pointer-events-none',
      )}
    >
      {children}
    </button>
  );
}
