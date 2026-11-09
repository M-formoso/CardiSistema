---
name: "verification-protocol"
description: "Protocolo de verificación - Evidencia antes de declarar completado"
version: "1.0.0"
trigger: "Antes de cualquier claim de éxito, commit, PR, o finalización de tarea"
source: "Adaptado de obra/superpowers"
---

# Verification Protocol - DevelopNet

**Regla de hierro:** "EVIDENCIA ANTES DE CLAIMS, SIEMPRE"

No hay claims de completitud sin ejecución fresca del comando de verificación y confirmación del output.

## La Ley de Verificación

```
SI NO EJECUTASTE EL COMANDO DE VERIFICACIÓN,
NO PODÉS DECLARAR ÉXITO
```

## El Gate Function (5 Pasos)

### 1. IDENTIFICAR el comando que prueba tu claim

```bash
# Para código TypeScript/NestJS
pnpm --filter @developnet/billing-service build

# Para tests
pnpm --filter @developnet/billing-service test

# Para lint
pnpm lint

# Para Prisma
npx prisma validate
npx prisma generate
```

### 2. EJECUTAR el comando completo y fresco

```bash
# ✅ CORRECTO - ejecutar fresco
pnpm --filter @developnet/billing-service build

# ❌ INCORRECTO - confiar en ejecución previa
"Ya funcionaba antes"
```

### 3. LEER output completo

- Check exit codes (0 = éxito)
- Contar failures/errores
- Buscar warnings críticos

```bash
# Verificar exit code
echo $?  # Debería ser 0
```

### 4. VERIFICAR si el output confirma el claim

```
✅ "Build completed successfully"
✅ "All tests passed"
✅ "No errors found"

❌ "1 error"
❌ "FAILED"
❌ "Warning: ..."
```

### 5. SOLO ENTONCES hacer el claim con evidencia

```markdown
## Verificación Completada

Build: ✅ Pasó sin errores
Tests: ✅ 15/15 pasando
Lint: ✅ Sin warnings
```

**Saltear pasos constituye reporte deshonesto.**

## Red Flags - Parar Inmediatamente

Detectar si estás:

- ⚠️ Usando lenguaje tentativo: "debería", "probablemente", "parece"
- ⚠️ Expresando satisfacción antes de verificar
- ⚠️ Haciendo commit/push sin verificación
- ⚠️ Confiando en reportes de agentes sin verificación independiente
- ⚠️ Confiando en checks parciales
- ⚠️ Cualquier wording que implique éxito sin ejecutar comandos

## Errores Comunes de Verificación

| Error | Problema | Solución |
|-------|----------|----------|
| "Tests pasan" sin output | Asunción | Ejecutar y mostrar output |
| "Lint pasa" sin build | Incompleto | Build incluye más checks |
| "Agente reportó éxito" | Sin verificación independiente | Verificar con VCS |
| "Test escrito" sin red-green | TDD incompleto | Ver test fallar primero |

## Verificación por Tipo de Tarea

### Nueva Funcionalidad

```bash
# 1. Build
pnpm --filter @developnet/billing-service build

# 2. Tests
pnpm --filter @developnet/billing-service test

# 3. Verificar endpoint (si aplica)
curl -X GET http://localhost:3002/api/[endpoint]
```

### Bug Fix

```bash
# 1. Test que reproduce el bug (RED)
pnpm --filter @developnet/billing-service test -- [test-name]
# Output: ❌ FAILED

# 2. Implementar fix

# 3. Test pasa (GREEN)
pnpm --filter @developnet/billing-service test -- [test-name]
# Output: ✅ PASSED

# 4. Regresión - todos los tests pasan
pnpm --filter @developnet/billing-service test
```

### Cambio de Schema Prisma

```bash
# 1. Validar schema
npx prisma validate

# 2. Generar cliente
npx prisma generate

# 3. Build con nuevo cliente
pnpm --filter @developnet/billing-service build
```

### Migración de Base de Datos

```bash
# 1. Crear migración
DATABASE_URL="..." npx prisma migrate dev --name [nombre]

# 2. Verificar status
DATABASE_URL="..." npx prisma migrate status

# 3. Build
pnpm --filter @developnet/billing-service build
```

## Checklist Pre-Commit

```markdown
## Verificación Pre-Commit

- [ ] `pnpm build` pasa sin errores
- [ ] `pnpm test` pasa (todos los tests)
- [ ] Sin `console.log` de debug
- [ ] Sin `any` nuevos
- [ ] Imports ordenados
- [ ] Archivos guardados
```

## Checklist Pre-PR

```markdown
## Verificación Pre-PR

- [ ] Todos los checks de Pre-Commit ✅
- [ ] Branch actualizado con develop
- [ ] No hay conflictos
- [ ] Commits con mensajes claros
- [ ] Cambios revisados con `git diff`
```

## Formato de Output de Verificación

```markdown
## Verificación: [Nombre de Tarea]

**Fecha**: YYYY-MM-DD HH:MM
**Verificado por**: Claude

### Build
```
$ pnpm --filter @developnet/billing-service build
✔ Successfully compiled 127 files
Exit code: 0
```
**Estado**: ✅ Pasó

### Tests
```
$ pnpm --filter @developnet/billing-service test
Test Suites: 15 passed, 15 total
Tests:       47 passed, 47 total
Exit code: 0
```
**Estado**: ✅ Pasó

### Resultado Final
✅ VERIFICADO - Listo para commit/merge
```

## Envelope de Respuesta

```json
{
  "status": "verified" | "failed",
  "summary": "Verificación completada. Build y tests pasando.",
  "verification": {
    "build": { "status": "pass", "exit_code": 0 },
    "tests": { "status": "pass", "passed": 47, "failed": 0 },
    "lint": { "status": "pass", "warnings": 0 }
  },
  "evidence": "Output completo de comandos ejecutados",
  "ready_for": "commit" | "pr" | "merge"
}
```

## Aplicabilidad

Esta regla aplica SIEMPRE antes de:

- ✅ Claims de éxito
- ✅ Expresiones de satisfacción
- ✅ Statements positivos sobre el trabajo
- ✅ Commits
- ✅ PRs
- ✅ Completar tareas

**No negociable:** Ejecutar comandos, leer outputs, luego declarar resultados.
