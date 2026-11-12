import { useEffect, useMemo, useState } from 'react';

/**
 * Hook de paginación client-side.
 * Recibe el array completo + el tamaño de página inicial y devuelve el slice
 * actual, el total y los controles para cambiar página y tamaño.
 *
 * Al cambiar el total (ej. filtros aplicados), si la página actual queda
 * fuera de rango, se resetea a la última página válida.
 */
export function usePagination<T>(items: T[], initialPageSize = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Si cambia el total (ej. nuevo filtro reduce resultados), asegurar que la
  // página siga siendo válida.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const paginados = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return {
    paginados,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
  };
}
