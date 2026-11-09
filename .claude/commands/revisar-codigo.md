# Revisar Código AgroFácil

Realiza una revisión de código siguiendo los estándares del proyecto AgroFácil.

## Parámetros
- **$ARGUMENTS**: Ruta del archivo o directorio a revisar

## Checklist de Revisión

### Backend (NestJS + Prisma + TypeScript)

#### Arquitectura
- [ ] Lógica de negocio en **services**, NO en controllers
- [ ] DTOs con **Zod** (no class-validator)
- [ ] Type hints en todas las funciones (sin `any`)
- [ ] PrismaService inyectado vía constructor (no `new PrismaClient()`)
- [ ] Transacciones (`$transaction`) si toca > 1 tabla

#### Seguridad
- [ ] `@UseGuards(JwtAuthGuard)` a nivel controller (excepto endpoints `@Public()`)
- [ ] **Multi-tenant**: el middleware filtra por `cuentaId` — verificar que no haya queries que lo bypassen
- [ ] **Soft delete** con `activo: false` (nunca `delete` físico)
- [ ] Sin hardcoded secrets — todo en `.env`
- [ ] Logs sin info sensible (passwords, tokens, datos personales)
- [ ] Validación Zod en todo input

#### Base de Datos
- [ ] `Decimal(14,4)` para dinero, `Decimal(12,4)` para superficies, `Decimal(10,4)` para rindes
- [ ] Índices en `cuentaId` y en campos de búsqueda frecuente
- [ ] FKs con `ON DELETE` apropiado
- [ ] Timestamps (`createdAt`, `updatedAt`)

#### Código
- [ ] Sin código comentado innecesario
- [ ] Manejo de excepciones con `NotFoundException`, `BadRequestException`, etc.
- [ ] Sin `console.log` — usar `Logger` de pino
- [ ] Nombres descriptivos en **español argentino**

### Frontend (React + TypeScript)

#### TypeScript
- [ ] Sin `any` (si no se puede tipar, `unknown` + narrow con guard)
- [ ] Interfaces definidas para todos los tipos de dominio
- [ ] Props tipadas correctamente
- [ ] Retornos de funciones públicas tipados

#### Componentes
- [ ] Componentes pequeños y reutilizables
- [ ] **Loading states** (Skeleton) en toda query
- [ ] **Error handling** explícito (mensaje + retry si aplica)
- [ ] Keys únicas en listas (`key={item.id}`, no `key={index}` salvo lista estática)
- [ ] Sin re-renders innecesarios (memoización donde corresponda)

#### Formularios
- [ ] Validación con **Zod**
- [ ] Mensajes de error claros y en español
- [ ] Feedback de submit (Loader + disabled durante mutation)
- [ ] Campos requeridos marcados con `*`

#### Estilos
- [ ] Solo **Tailwind** (no CSS custom salvo casos justificados)
- [ ] **Paleta AgroFácil** respetada (`primary`, `accent`, `sidebar`, etc.)
- [ ] **Mobile-first** — probar en viewport chico
- [ ] Componentes shadcn/ui (no reinventar dropdowns, modals, etc.)

#### Performance
- [ ] Memoización donde sea necesario (`useMemo`, `useCallback`)
- [ ] Lazy loading en rutas pesadas
- [ ] Imágenes optimizadas (formato webp si es estática)
- [ ] TanStack Query con `staleTime` razonable

### Dominio AgroFácil (CRÍTICO)

- [ ] **Unidades coherentes**: superficie en ha, rinde en qq/ha, precio en USD/tn (interno: USD/qq).
- [ ] **Conversiones canónicas** se usan desde el util compartido, NO se reescriben inline.
- [ ] **Dinero en Decimal**, no `number` ni `Float` (ni en BD ni en cálculos).
- [ ] **Agregaciones**: por hectárea se recalcula sobre superficie agregada, NUNCA se promedian los promedios.
- [ ] **Rinde**: usar `rinde_real ?? rinde_estimado` y marcar resultado como "proyectado"/"definitivo".
- [ ] **Voz/foto**: nunca persiste automático, siempre confirma usuario.
- [ ] Copy en **español argentino**: "campaña", "lote", "rinde", "cosecha", "siembra".

### Formato Argentino (UI)
- [ ] Fechas: `DD/MM/YYYY` (`formatearFecha`)
- [ ] Moneda: `USD` con separador AR (punto miles, coma decimal)
- [ ] Superficie: `XX,X ha`
- [ ] Rinde: `XX,X qq/ha`

---

## Template de Reporte

```markdown
# Code Review: {archivo}

## Resumen
- **Estado**: Aprobado / Cambios menores / Requiere revisión
- **Archivos revisados**: X
- **Issues encontrados**: X

## Issues

### Crítico
1. [Descripción]
   - Archivo:línea
   - Sugerencia: [código sugerido]

### Mejora
1. [Descripción]

### Nitpick
1. [Descripción menor]

## Aspectos Positivos
- [Qué está bien]

## Recomendaciones
- [Sugerencias generales]
```

## Ejemplo de uso
```
/revisar-codigo backend/src/modules/lotes/lotes.service.ts
/revisar-codigo frontend/src/components/lotes/
```
