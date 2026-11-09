---
name: "parallel-agents"
description: "Dispatch de agentes en paralelo para problemas independientes"
version: "1.0.0"
trigger: "Cuando hay 3+ problemas independientes que pueden resolverse concurrentemente"
source: "Adaptado de obra/superpowers"
---

# Parallel Agents - DevelopNet

**Concepto:** "Delegar tareas a agentes especializados con contexto aislado cuando hay múltiples problemas independientes."

## Cuándo Usar Este Patrón

### Escenarios Ideales

- ✅ 3+ tests fallando con causas diferentes
- ✅ Múltiples subsistemas rotos independientemente
- ✅ Problemas que se pueden entender sin cruzar dominios
- ✅ Sin estado compartido entre investigaciones

### Cuándo NO Usar

- ❌ Las fallas están relacionadas entre sí
- ❌ Se necesita entendimiento del sistema completo
- ❌ El debugging es exploratorio (no sabés qué buscar)
- ❌ Los agentes compartirían estado/recursos

## El Patrón de 4 Pasos

### 1. Identificación de Dominios

Agrupar fallas por QUÉ está roto, no por CÓMO se manifiesta.

```markdown
## Dominios Identificados

### Dominio A: Flujo de Aprobación de Facturas
- Test: `invoice.approve.spec.ts` ❌
- Test: `invoice.workflow.spec.ts` ❌
- Causa probable: Cambio en state machine

### Dominio B: Procesamiento Batch de Contactos
- Test: `contacts.import.spec.ts` ❌
- Test: `contacts.bulk.spec.ts` ❌
- Causa probable: Cambio en validación

### Dominio C: Cancelación de Pagos
- Test: `payments.cancel.spec.ts` ❌
- Causa probable: Cambio en transacciones
```

### 2. Creación de Tareas Focalizadas

Cada agente recibe:
- **Scope específico** (qué archivos/tests)
- **Criterio de éxito claro** (qué significa "resuelto")
- **Restricciones operacionales** (qué NO tocar)
- **Formato de output esperado**

```markdown
## Tarea para Agente A: Flujo de Aprobación

### Scope
- `src/modules/invoices/invoices.service.ts`
- `src/domain/state-machines/invoice.machine.ts`
- Tests: `invoice.approve.spec.ts`, `invoice.workflow.spec.ts`

### Criterio de Éxito
Los 2 tests deben pasar sin romper otros tests de invoices.

### Restricciones
- NO modificar `invoice.controller.ts`
- NO cambiar la API pública del service
- NO tocar otros módulos

### Output Esperado
```json
{
  "status": "fixed",
  "root_cause": "descripción",
  "files_modified": ["lista"],
  "tests_passing": true
}
```
```

### 3. Dispatch en Paralelo

```markdown
## Dispatching Agents

Ejecutando 3 agentes en paralelo:

| Agente | Dominio | Estado |
|--------|---------|--------|
| Agent-A | Flujo de Aprobación | 🔄 Running |
| Agent-B | Procesamiento Batch | 🔄 Running |
| Agent-C | Cancelación de Pagos | 🔄 Running |

*Esperando resultados...*
```

### 4. Integración y Verificación

1. **Revisar resúmenes** buscando conflictos
2. **Ejecutar test suite completo**
3. **Spot-check** para errores sistemáticos

```markdown
## Resultados de Agentes

### Agent-A: ✅ Resuelto
- Root cause: Guard `hasItems` no verificaba items vacíos
- Fix: Agregada validación `items.length > 0`
- Tests: 2/2 pasando

### Agent-B: ✅ Resuelto
- Root cause: Validación de email cambió regex
- Fix: Actualizado regex para aceptar formato válido
- Tests: 2/2 pasando

### Agent-C: ⚠️ Necesita Review
- Root cause: Transacción no cerraba correctamente
- Fix: Agregado `finally` block
- Tests: 1/1 pasando, pero toca área sensible

## Verificación de Integración

```bash
pnpm --filter @developnet/billing-service test
```
Output: 47/47 tests passing ✅

## Conflictos Detectados
Ninguno - los dominios eran realmente independientes.
```

## Prompts Efectivos para Agentes

### Incluir:

```markdown
### Contexto Completo
- Archivos relevantes y su propósito
- Estado esperado vs actual
- Historial reciente de cambios en esa área

### Scope Exacto
- Lista explícita de archivos permitidos
- Tests específicos a corregir
- Boundaries claros

### Formato de Output
- Estructura JSON esperada
- Campos requeridos
- Nivel de detalle

### Restricciones
- Qué NO modificar
- Patrones a seguir
- Límites de tiempo/complejidad
```

### NO Incluir:

- Contexto de otros dominios
- Información que pueda causar scope creep
- Sugerencias de solución (dejar que el agente investigue)

## Documentación de Sesión Paralela

```markdown
# Parallel Debug Session: [Descripción]

**Fecha**: YYYY-MM-DD
**Tests Fallando**: 5
**Dominios Identificados**: 3

## Pre-Analysis

### Test Failures
| Test | Dominio | Independiente |
|------|---------|---------------|
| test1 | A | ✅ |
| test2 | A | ✅ |
| test3 | B | ✅ |
| test4 | B | ✅ |
| test5 | C | ✅ |

### Dependency Check
- Dominio A ↔ Dominio B: Sin dependencias
- Dominio A ↔ Dominio C: Sin dependencias
- Dominio B ↔ Dominio C: Sin dependencias

## Agent Prompts

### Agent A
[prompt completo]

### Agent B
[prompt completo]

### Agent C
[prompt completo]

## Results

### Agent A
[resultado]

### Agent B
[resultado]

### Agent C
[resultado]

## Integration

### Full Test Suite
```
pnpm test
Output: X/X passing
```

### Conflicts Resolved
- [ninguno / lista de conflictos y resolución]

## Summary
- Total time: X minutes
- Tiempo estimado secuencial: Y minutes
- Savings: Z%
```

## Envelope de Respuesta

```json
{
  "status": "all_resolved" | "partial" | "blocked",
  "summary": "3 dominios resueltos en paralelo. 5 tests corregidos.",
  "agents_dispatched": 3,
  "results": {
    "agent_a": { "status": "fixed", "tests_fixed": 2 },
    "agent_b": { "status": "fixed", "tests_fixed": 2 },
    "agent_c": { "status": "fixed", "tests_fixed": 1 }
  },
  "integration": {
    "conflicts": 0,
    "full_suite_passing": true
  },
  "time_saved": "60%"
}
```

## Beneficios Documentados

| Aspecto | Secuencial | Paralelo |
|---------|------------|----------|
| Tiempo | 2-3 horas | 30-45 min |
| Contaminación de contexto | Alta | Ninguna |
| Interferencia entre fixes | Posible | Imposible |
| Checkpoints de calidad | Manual | Automatizado |
