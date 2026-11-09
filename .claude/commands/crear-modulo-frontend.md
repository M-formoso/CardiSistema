# Crear Módulo Frontend (React + TypeScript)

Crea un nuevo módulo frontend completo para AgroFácil usando React + TS + shadcn/ui + TanStack Query.

## Parámetros
- **$ARGUMENTS**: Nombre del módulo en singular (ej: `"lote"`, `"campania"`, `"labor"`)

## Instrucciones

1. **Tipos** en `frontend/src/types/{modulo}.ts`:
   - Interface principal (mismo shape que el backend response, en camelCase).
   - Form data (lo que va al backend para Crear/Actualizar).
   - Filtros y paginación.

2. **Servicio API** en `frontend/src/services/{modulo}Service.ts`:
   - Funciones tipadas: `listar`, `obtenerPorId`, `crear`, `actualizar`, `eliminar`.
   - Cliente Axios compartido (`@/lib/apiClient`).
   - Manejo de errores → mensaje legible para usuario.

3. **Hook** en `frontend/src/hooks/use{Modulo}.ts`:
   - TanStack Query (`useQuery` + `useMutation`).
   - `queryKey` consistente: `['{modulo}', filtros]`.
   - Invalidación de cache en mutations.

4. **Componentes** en `frontend/src/components/{modulo}/`:
   - `{Modulo}List.tsx` — tabla con TanStack Table + filtros + paginación.
   - `{Modulo}Form.tsx` — React Hook Form + Zod.
   - `{Modulo}Detail.tsx` — vista detalle.
   - `index.ts` — re-exports.

5. **Páginas** en `frontend/src/pages/{modulo}/`:
   - `index.tsx` — listado.
   - `nuevo.tsx` — crear.
   - `[id].tsx` — ver/editar (parametrizada).

6. **Ruta** en `frontend/src/router.tsx`:
   ```tsx
   { path: '/{modulo}s', element: <ListaPage /> },
   { path: '/{modulo}s/nuevo', element: <NuevoPage /> },
   { path: '/{modulo}s/:id', element: <DetallePage /> },
   ```

7. **Sidebar** en `frontend/src/components/layout/Sidebar.tsx`:
   - Agregar item con icono de lucide-react y link a `/{modulo}s`.

---

## Estilo y reglas
- **Tailwind + shadcn/ui**. No CSS custom salvo casos justificados.
- **Paleta AgroFácil** (verde campo + tierra) — referirse a `tailwind.config.js`.
- **Mobile-first**: el productor carga datos en el campo desde el celular.
- **Unidades**: cuando se muestre rinde, usar `formatearQqHa()`; dinero, `formatearUsd()`; superficie, `formatearHa()`. Todos viven en `frontend/src/utils/formatters.ts`.
- **Loading states**: skeleton mientras carga, mensaje de error claro si falla.
- **Sin `any`**. Si no se puede tipar, `unknown` + narrow.

---

## Ejemplo de uso
```
/crear-modulo-frontend lote
/crear-modulo-frontend resultado-lote
```

## Checklist de verificación
- [ ] Tipos completos (sin `any`)
- [ ] Service tipado con manejo de errores
- [ ] Hook con TanStack Query + invalidaciones
- [ ] Componentes con loading + error states
- [ ] Formulario con Zod validation
- [ ] Tabla con filtros y paginación
- [ ] Vista mobile probada
- [ ] Rutas y sidebar agregados
- [ ] Unidades formateadas con los helpers (qq/ha, USD, ha)
