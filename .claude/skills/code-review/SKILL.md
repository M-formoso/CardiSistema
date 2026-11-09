---
name: "code-review"
description: "Code Review bidireccional - Solicitar y recibir revisiones de código"
version: "1.0.0"
trigger: "Después de implementar features, antes de merge, o cuando se recibe feedback"
source: "Adaptado de obra/superpowers"
---

# Code Review - DevelopNet

Este skill cubre dos flujos: **solicitar** revisiones y **recibir** feedback.

---

## Parte 1: Solicitar Code Review

### Cuándo Solicitar Revisión

| Escenario | Obligatorio |
|-----------|-------------|
| Después de cada tarea en desarrollo con subagentes | ✅ |
| Al completar una feature importante | ✅ |
| Antes de merge a develop/main | ✅ |
| Cuando estás bloqueado (perspectiva fresca) | Opcional |
| Antes de refactorizar (verificar base) | Opcional |
| Después de fixes de bugs complejos | Recomendado |

### Proceso de Solicitud

#### 1. Obtener Commits para Review

```bash
# Commits desde el branch base
BASE_SHA=$(git merge-base origin/develop HEAD)
HEAD_SHA=$(git rev-parse HEAD)

# Ver qué cambios se van a revisar
git diff $BASE_SHA..$HEAD_SHA --stat
```

#### 2. Preparar Contexto

```markdown
## Review Request: [Nombre de Feature/Fix]

### Qué se implementó
[Descripción breve de los cambios]

### Archivos principales
- `path/to/file1.ts` - [qué hace]
- `path/to/file2.ts` - [qué hace]

### Commits incluidos
```
git log $BASE_SHA..$HEAD_SHA --oneline
```

### Áreas de concern
- [Área donde querés feedback específico]
- [Decisión de la que no estás seguro]

### Tests
- Tests nuevos: X
- Tests existentes: todos pasando
```

#### 3. Actuar sobre Feedback

| Severidad | Acción |
|-----------|--------|
| **Crítico** | Corregir inmediatamente antes de continuar |
| **Importante** | Corregir antes de merge |
| **Menor** | Registrar para después |
| **Cuestionable** | Responder con fundamento técnico |

### Red Flags

- ❌ NUNCA omitir revisión
- ❌ NUNCA ignorar issues Críticos
- ❌ NUNCA proceder sin corregir issues Importantes

---

## Parte 2: Recibir Code Review

**Principio:** "Verificar antes de implementar. Preguntar antes de asumir. Corrección técnica sobre comodidad social."

### Patrón de Respuesta (5 Pasos)

1. **LEER** sin reaccionar
2. **REFORMULAR** el requisito con tus palabras
3. **VERIFICAR** contra la realidad del código
4. **EVALUAR** solidez técnica
5. **RESPONDER** con acknowledgment técnico u objeción razonada

### Respuestas Prohibidas

```markdown
<!-- ❌ INCORRECTO - Acuerdo performativo -->
"¡Tenés razón!"
"¡Excelente feedback!"
"¡Gran observación!"

<!-- ✅ CORRECTO - Técnico y conciso -->
"Fixed. Agregué validación en línea 45."
"Entiendo el concern. Sin embargo, [razón técnica para no cambiar]."
```

### Gestión de Feedback Poco Claro

> "Items may be related. Partial understanding = wrong implementation."

Si hay ambigüedad, **PARAR** y pedir clarificación:

```markdown
Antes de implementar, necesito clarificar:

1. ¿[pregunta sobre alcance]?
2. ¿[pregunta sobre comportamiento esperado]?
```

### Cuándo Aceptar vs Objetar

#### Aceptar Cuando:

- El feedback es técnicamente correcto
- Mejora la calidad del código
- Sigue los patrones del proyecto
- No rompe funcionalidad existente

```markdown
<!-- Respuesta de aceptación -->
Fixed. [Descripción breve del cambio]
```

#### Objetar Cuando:

- La sugerencia rompe funcionalidad existente
- El reviewer no tiene contexto completo
- Viola YAGNI (agrega complejidad innecesaria)
- Es técnicamente incorrecta
- Conflictúa con decisiones arquitectónicas previas

```markdown
<!-- Respuesta de objeción -->
No voy a implementar esto porque:
1. [Razón técnica 1]
2. [Razón técnica 2]

Contexto que puede faltar: [explicación]
```

### Verificación YAGNI

Cuando sugieren "implementar properly":

```bash
# Buscar si la feature sugerida se usa realmente
grep -r "featureSugerida" src/
```

Si no se usa → proponer remover en lugar de "mejorar".

### Manejo por Fuente de Feedback

| Fuente | Enfoque |
|--------|---------|
| Partner humano | Implementar tras entender; aún así preguntar si hay ambigüedad |
| Reviewer externo | Verificar contexto y corrección técnica primero |
| Linter/Tool automático | Generalmente aceptar, pero cuestionar false positives |

### Errores Comunes

- ❌ Acuerdo performativo ("¡Tenés razón!")
- ❌ Implementación ciega sin entender
- ❌ Implementar en lotes sin probar cada cambio
- ❌ Asumir que el reviewer tiene razón
- ❌ Evitar objeciones necesarias por comodidad social
- ❌ Implementación parcial

---

## Formato de Review Session

```markdown
# Code Review: [Feature/PR Name]

**Fecha**: YYYY-MM-DD
**Reviewer**: [nombre]
**Author**: [nombre]

## Resumen de Cambios

- X archivos modificados
- Y líneas agregadas
- Z líneas removidas

## Feedback Recibido

### Crítico
- [ ] Issue 1: [descripción] → [acción tomada]

### Importante
- [ ] Issue 2: [descripción] → [acción tomada]

### Menor
- [ ] Issue 3: [descripción] → [para después]

### Objeciones Planteadas
- Sugerencia X: No implementada porque [razón técnica]

## Verificación Post-Review

- [ ] Todos los issues críticos resueltos
- [ ] Todos los issues importantes resueltos
- [ ] Build pasa
- [ ] Tests pasan
```

## Envelope de Respuesta

```json
{
  "status": "review_complete" | "changes_requested" | "approved",
  "summary": "Review completado. 3 issues resueltos, 1 objeción planteada.",
  "issues": {
    "critical": { "found": 1, "resolved": 1 },
    "important": { "found": 2, "resolved": 2 },
    "minor": { "found": 1, "deferred": 1 }
  },
  "objections_raised": 1,
  "next_steps": ["merge to develop"]
}
```

## Integración con SDD

El code review se aplica:

1. **Durante sdd-apply**: Después de cada tarea
2. **En sdd-verify**: Como parte de la verificación final
3. **Antes de merge**: Como gate final

```
sdd-tasks → sdd-apply → [code-review] → siguiente tarea
                              ↓
                        sdd-verify → [code-review final] → merge
```
