---
name: "systematic-debugging"
description: "Debugging sistemático - Investigación de causa raíz antes de cualquier fix"
version: "1.0.0"
trigger: "Ante cualquier bug, error de test, comportamiento inesperado, o falla de build"
source: "Adaptado de obra/superpowers"
---

# Systematic Debugging - DevelopNet

**Regla de oro:** "SIN FIXES SIN INVESTIGACIÓN DE CAUSA RAÍZ PRIMERO"

Las soluciones enfocadas en síntomas crean nuevos problemas en lugar de resolver los existentes.

## Cuándo Aplicar Este Skill

| Escenario | Aplicar |
|-----------|---------|
| Test fallando | ✅ |
| Bug en producción | ✅ |
| Comportamiento inesperado | ✅ |
| Problema de performance | ✅ |
| Falla de build | ✅ |
| Error de integración | ✅ |

**Especialmente crítico cuando:**
- Estás bajo presión de tiempo
- Un "quick fix" parece obvio
- Ya fallaron múltiples intentos
- El problema parece "simple"

## Las Cuatro Fases Obligatorias

### Fase 1: Investigación de Causa Raíz

```
1. LEER mensajes de error y stack traces COMPLETOS
2. REPRODUCIR el problema consistentemente
3. EXAMINAR cambios recientes (git log, git diff)
4. AGREGAR instrumentación diagnóstica
5. TRAZAR el flujo de datos hacia atrás
```

```bash
# Examinar cambios recientes
git log --oneline -20
git diff HEAD~5

# Ver qué archivos cambiaron
git diff --stat HEAD~5
```

```typescript
// Agregar instrumentación temporal
console.log('[DEBUG] invoiceService.send() called with:', { invoiceId, userId });
console.log('[DEBUG] invoice state before update:', invoice);
```

### Fase 2: Análisis de Patrones

1. **Localizar código similar que funciona**
   ```typescript
   // ¿Cómo se hace esto en otro service?
   // services/billing-service/src/modules/contacts/contacts.service.ts
   ```

2. **Estudiar implementaciones de referencia completamente**
   - No solo copiar, ENTENDER

3. **Comparar working vs broken**
   - Identificar CADA diferencia
   - No asumir - verificar

4. **Entender dependencias**
   - ¿Qué asume este código?
   - ¿Qué configuración necesita?

### Fase 3: Hipótesis y Testing

```markdown
## Hipótesis
El error ocurre porque [causa específica]

## Test
Cambio mínimo a realizar: [un solo cambio]

## Resultado Esperado
Si la hipótesis es correcta: [qué debería pasar]
Si no: [qué debería pasar]
```

**Reglas:**
- UNA variable a la vez
- Verificar resultado antes de continuar
- Si falla, nueva hipótesis (no apilar fixes)

### Fase 4: Implementación

1. **Test fallido primero** (que reproduce el bug)
2. **Fix único** que aborda la causa raíz
3. **Verificar** que el fix resuelve sin romper otros tests
4. **Si 3+ fixes fallan**: cuestionar la arquitectura

## Red Flags - Parar y Reiniciar Fase 1

Detente si te encontrás:

- ⚠️ Proponiendo fixes sin investigación
- ⚠️ Intentando múltiples cambios simultáneos
- ⚠️ Saltando tests
- ⚠️ Haciendo asunciones sin verificación
- ⚠️ Después de 3+ intentos fallidos

```markdown
## 🛑 PARAR

Han fallado 3 intentos de fix. Antes de continuar:

1. ¿Entiendo realmente la causa raíz?
2. ¿La arquitectura es correcta para este caso?
3. ¿Necesito pedir ayuda o más contexto?
```

## Formato de Debugging Session

```markdown
# Debug Session: [Descripción del Bug]

**Fecha**: YYYY-MM-DD
**Síntoma**: [Qué está pasando]
**Esperado**: [Qué debería pasar]

## Fase 1: Investigación

### Error Message
```
[copiar error completo]
```

### Stack Trace
```
[copiar stack trace]
```

### Reproducción
```bash
# Pasos para reproducir
1. ...
2. ...
```

### Cambios Recientes
- commit abc123: "mensaje"
- commit def456: "mensaje"

## Fase 2: Análisis

### Código Relacionado
- `archivo.ts:45` - función relevante
- `otro.ts:23` - dependencia

### Código Similar que Funciona
- `referencia.ts:67` - hace algo parecido

### Diferencias Identificadas
1. [diferencia 1]
2. [diferencia 2]

## Fase 3: Hipótesis

### Hipótesis 1
**Causa**: [descripción]
**Test**: [cambio mínimo]
**Resultado**: ✅ Funcionó / ❌ Falló → siguiente hipótesis

## Fase 4: Fix

### Fix Implementado
```typescript
// código del fix
```

### Verificación
- [ ] Test del bug pasa
- [ ] Otros tests siguen pasando
- [ ] Build funciona
```

## Envelope de Respuesta

```json
{
  "status": "completed" | "blocked",
  "summary": "Bug resuelto: [causa raíz]. Fix: [descripción]",
  "artifacts": ["archivos modificados"],
  "root_cause": "Descripción de la causa raíz",
  "fix_applied": "Descripción del fix",
  "tests_added": 1,
  "attempts": 2,
  "time_spent": "15 min"
}
```

## Impacto Real

| Método | Tiempo | Éxito Primera Vez | Bugs Nuevos |
|--------|--------|-------------------|-------------|
| Random/Quick Fix | 2-3 horas | ~20% | Muchos |
| Debugging Sistemático | 15-30 min | ~95% | Casi ninguno |

## Integración con DevelopNet

Cuando encuentres un bug durante cualquier fase SDD:

1. **Pausar** la tarea actual
2. **Documentar** el bug encontrado
3. **Aplicar** este skill de debugging
4. **Retomar** la tarea original

```json
{
  "status": "blocked",
  "blocker": "Bug encontrado durante implementación",
  "debug_session": ".developnet/debug-[fecha].md"
}
```
