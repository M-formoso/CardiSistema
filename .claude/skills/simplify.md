# Skill: /simplify - Revisión y Simplificación de Código

## Comando
`/simplify`

## Descripción
Analiza los cambios recientes del código (git diff) y realiza una revisión automática en 3 dimensiones: **Reutilización**, **Calidad** y **Eficiencia**. Luego aplica las correcciones directamente y presenta un resumen listo para commit.

---

## Flujo de Ejecución

```
git diff (tus cambios)
        │
        ▼
┌───────────────────────────────────────────┐
│                                           │
▼               ▼               ▼           │
REUSE         QUALITY       EFFICIENCY      │
¿Ya existe    ¿Malas        ¿Ineficien-     │
esto en el    prácticas?    cias o memory   │
proyecto?                   leaks?          │
│               │               │           │
└───────────────┴───────────────┘           │
        │                                   │
        ▼                                   │
Agrega todos los hallazgos                  │
        │                                   │
        ▼                                   │
Aplica fixes en el código                   │
        │                                   │
        ▼                                   │
Resumen de cambios listos para el commit    │
└───────────────────────────────────────────┘
```

---

## Paso 1: Obtener los cambios

Ejecutar `git diff` para obtener todos los archivos modificados y los cambios realizados.

```bash
# Cambios staged (listos para commit)
git diff --cached --name-only

# Cambios no staged
git diff --name-only

# Si no hay diff, usar los últimos cambios del último commit
git diff HEAD~1 --name-only
```

Leer el contenido completo de cada archivo modificado para tener contexto total.

---

## Paso 2: Análisis en 3 Dimensiones

### 2.1 REUSE — ¿Ya existe esto en el proyecto?

Buscar en todo el proyecto si el código nuevo duplica funcionalidad existente.

**Verificar:**

- **Funciones/métodos duplicados:** ¿Ya existe una función que hace lo mismo o algo muy similar en otro archivo? Buscar por nombre y por lógica.
- **Componentes UI repetidos:** ¿Se está creando un componente que ya existe en `components/shared/` o `components/ui/`? Por ejemplo, un botón de confirmación, un modal, un campo de búsqueda, una tabla filtrable.
- **Hooks personalizados:** ¿Se está repitiendo lógica que ya está abstraída en un custom hook en `hooks/`?
- **Services/API calls:** ¿Se está haciendo una llamada API que ya está definida en `services/`?
- **Utils/Helpers:** ¿Se está escribiendo una función de formateo, validación o cálculo que ya existe en `utils/`?
- **Constantes:** ¿Se están hardcodeando valores que ya están en `constants/`?
- **Types/Interfaces:** ¿Se está redefiniendo un type que ya existe en `types/`?
- **Schemas Pydantic:** ¿Se está creando un schema que duplica uno existente en `schemas/`?
- **Queries SQL/ORM:** ¿Se está escribiendo una query que ya existe en un service?

**Acciones:**
- Si existe algo reutilizable → reemplazar el código nuevo por un import de lo existente.
- Si lo existente es casi igual pero no exactamente → proponer refactorizar lo existente para que sea más genérico y reutilizarlo.
- Si el código nuevo es mejor que el existente → proponer reemplazar el existente y actualizar todos los imports.

**Comandos de búsqueda:**
```bash
# Buscar funciones similares por nombre
grep -rn "def nombre_funcion\|function nombreFuncion\|const nombreFuncion" --include="*.py" --include="*.ts" --include="*.tsx" .

# Buscar imports similares
grep -rn "from.*import\|import.*from" --include="*.py" --include="*.ts" --include="*.tsx" . | grep "palabra_clave"

# Buscar componentes similares
find . -name "*.tsx" -path "*/components/*" | xargs grep -l "export.*function\|export default"

# Buscar hooks existentes
find . -name "use*.ts" -o -name "use*.tsx" | head -20

# Buscar utils existentes
find . -path "*/utils/*" -name "*.ts" -o -path "*/utils/*" -name "*.py" | head -20
```

---

### 2.2 QUALITY — ¿Malas prácticas?

Revisar el código buscando problemas de calidad y malas prácticas.

**Backend (Python/FastAPI):**

- ❌ Lógica de negocio en endpoints (debe estar en services/)
- ❌ Queries SQL sin paginación en listados
- ❌ Falta de type hints en funciones
- ❌ Uso de `any` o tipos genéricos en vez de específicos
- ❌ Falta de validación Pydantic en inputs
- ❌ Falta de manejo de errores (try/except con HTTPException)
- ❌ Queries N+1 (acceso a relaciones sin eager loading)
- ❌ Falta de transacciones en operaciones que modifican múltiples tablas
- ❌ Passwords o secrets hardcodeados
- ❌ Falta de soft delete (DELETE real en vez de `activo = False`)
- ❌ Falta de logs de auditoría en operaciones de escritura
- ❌ Falta de validación de permisos/rol en endpoints
- ❌ Endpoints sin docstring
- ❌ Variables o funciones con nombres poco descriptivos
- ❌ Imports no utilizados
- ❌ Código comentado que debería eliminarse
- ❌ Print statements en vez de logging
- ❌ Falta de `db.refresh()` después de commits
- ❌ No cerrar sesiones de BD (falta de `finally: db.close()`)

**Frontend (React/TypeScript):**

- ❌ Uso de `any` en TypeScript
- ❌ Componentes con más de 200 líneas (deben dividirse)
- ❌ Estado que debería estar en Zustand en vez de useState local
- ❌ Falta de loading/error states en llamadas API
- ❌ Falta de validación Zod en formularios
- ❌ Keys faltantes o incorrectos en listas/maps
- ❌ useEffect sin dependencias correctas
- ❌ useEffect que debería ser useMemo o useCallback
- ❌ Fetch directo en componentes en vez de usar TanStack Query
- ❌ Estilos inline en vez de Tailwind
- ❌ Colores hardcodeados que no siguen la paleta DUWHITE
- ❌ Textos hardcodeados que deberían ser constantes
- ❌ Falta de manejo de estados vacíos (empty states)
- ❌ Falta de confirmación en acciones destructivas (eliminar)
- ❌ Console.log que debería eliminarse
- ❌ Props drilling excesivo (más de 3 niveles)
- ❌ Componentes no tipados o con tipos incompletos
- ❌ Falta de accesibilidad (aria-labels, roles)
- ❌ Imports no utilizados

**General:**

- ❌ Archivos nuevos que no siguen la estructura de carpetas definida
- ❌ Falta de tests para funcionalidad nueva
- ❌ Formato argentino no aplicado (fechas DD/MM/YYYY, moneda $, separadores)
- ❌ Nombres en inglés cuando el proyecto usa español (o mezcla inconsistente)

---

### 2.3 EFFICIENCY — ¿Ineficiencias o memory leaks?

Revisar rendimiento y posibles fugas de memoria.

**Backend:**

- 🐌 Queries sin índices en campos frecuentemente filtrados
- 🐌 Queries N+1 (debería usar `joinedload` o `selectinload`)
- 🐌 Cálculos pesados que deberían ser tareas Celery
- 🐌 Falta de paginación en listados (devuelve todos los registros)
- 🐌 Serialización de relaciones anidadas innecesarias
- 🐌 Falta de caché en datos que se consultan frecuentemente
- 🐌 Transacciones que mantienen lock de BD por tiempo excesivo
- 🐌 Lectura completa de archivos grandes en memoria
- 🐌 Generación de PDFs/Excel de forma síncrona (debería ser async/Celery)

**Frontend:**

- 🐌 Re-renders innecesarios (falta de `React.memo`, `useMemo`, `useCallback`)
- 🐌 Listas grandes sin virtualización (debería usar `react-window` o similar si >100 items)
- 🐌 Imágenes sin lazy loading
- 🐌 Suscripciones/intervals que no se limpian en cleanup de useEffect
- 🐌 Event listeners que no se remueven
- 🐌 Zustand stores que causan re-renders por seleccionar todo el state
- 🐌 TanStack Query sin configurar `staleTime` apropiado (refetch excesivo)
- 🐌 Importaciones pesadas que deberían ser lazy (`React.lazy` + `Suspense`)
- 🐌 Bundle sin code splitting en rutas
- 🐌 Cálculos costosos dentro del render sin `useMemo`
- 🐌 Debounce faltante en inputs de búsqueda
- 🐌 Llamadas API duplicadas (mismo dato pedido múltiples veces)

---

## Paso 3: Agregar todos los hallazgos

Compilar todos los problemas encontrados en las 3 dimensiones en una lista organizada.

**Formato de hallazgo:**
```
[DIMENSIÓN] [SEVERIDAD] archivo:línea — Descripción del problema
```

**Severidades:**
- 🔴 **CRÍTICO** — Debe corregirse antes del commit (bugs, seguridad, data loss)
- 🟡 **IMPORTANTE** — Debería corregirse (malas prácticas, ineficiencias claras)
- 🔵 **SUGERENCIA** — Mejora recomendada (reutilización, legibilidad)

---

## Paso 4: Aplicar fixes en el código

Para cada hallazgo con severidad CRÍTICO e IMPORTANTE:

1. Explicar brevemente qué se va a cambiar y por qué
2. Aplicar la corrección directamente en el archivo
3. Verificar que el fix no rompe nada:
   - Revisar imports afectados
   - Verificar que los tipos siguen siendo correctos
   - Si es backend: verificar que los tests existentes siguen pasando
   - Si es frontend: verificar que no hay errores de TypeScript

Para hallazgos de severidad SUGERENCIA:
- Listarlos al final como mejoras opcionales
- No aplicar automáticamente (dejar que el desarrollador decida)

---

## Paso 5: Resumen de cambios listos para commit

Presentar un resumen claro y conciso:

```
## 📋 Resumen de /simplify

### Archivos analizados: X
### Hallazgos totales: Y

#### 🔴 Críticos corregidos: N
- [archivo] Descripción de lo que se corrigió

#### 🟡 Importantes corregidos: N
- [archivo] Descripción de lo que se corrigió

#### 🔵 Sugerencias pendientes: N
- [archivo] Descripción de la mejora sugerida

### ✅ Cambios aplicados — Listos para commit

Mensaje de commit sugerido:
refactor: simplify [módulo] — fix [N] issues (reuse, quality, efficiency)
```

---

## Reglas Especiales para el Proyecto DUWHITE

### Paleta de colores (verificar siempre)
```
Primario:   #00BCD4 (turquesa)
Hover:      #00959F (turquesa oscuro)
Sidebar:    #3D3D3D (gris oscuro)
Fondo:      #F7F8FA (gris claro)
Texto:      #333333 (gris muy oscuro)
Secundario: #777777 (gris medio)
Bordes:     #E0E0E0 (gris suave)
Éxito:      #22C55E
Error:      #EF4444
Warning:    #F59E0B
Info:       #3B82F6
```

### Estructura obligatoria
- Backend: Endpoints → Services → Models (NUNCA lógica en endpoints)
- Frontend: Components / Pages / Services / Stores / Types
- Soft deletes siempre (campo `activo`)
- Formato argentino (fechas, moneda, CUIT)
- Type hints en Python, TypeScript estricto en frontend
- Logs de auditoría en operaciones de escritura

### Naming conventions
- Python: `snake_case` para todo, nombres en español
- TypeScript: `camelCase` para variables/funciones, `PascalCase` para componentes/types
- Archivos Python: `snake_case.py`
- Archivos React: `PascalCase.tsx` para componentes, `camelCase.ts` para utils/services
- Endpoints: `/api/v1/modulo/recurso` en español y kebab-case

---

## Ejemplo de Uso

```
Developer: /simplify

Agent:
Analizando cambios con git diff...

📂 Archivos modificados: 4
  - backend/app/api/v1/endpoints/pedidos.py
  - backend/app/services/pedido_service.py
  - frontend/src/components/pedidos/PedidoForm.tsx
  - frontend/src/pages/pedidos/create.tsx

🔍 Ejecutando análisis...

[REUSE] 🔵 PedidoForm.tsx:45 — El selector de cliente ya existe en
  components/shared/ClienteSelector.tsx. Reemplazar por import.

[QUALITY] 🔴 endpoints/pedidos.py:23 — Lógica de cálculo de total
  directamente en el endpoint. Mover a pedido_service.py

[QUALITY] 🟡 PedidoForm.tsx:112 — Falta validación Zod para el formulario.
  Solo tiene validación HTML nativa.

[EFFICIENCY] 🟡 pedido_service.py:67 — Query N+1 al acceder a
  cliente.lista_precios dentro de un loop. Usar joinedload.

Aplicando correcciones...
✅ 3 fixes aplicados
📝 1 sugerencia pendiente

Mensaje de commit sugerido:
refactor(pedidos): simplify form + fix N+1 query + move logic to service
```
