---
name: "brainstorming"
description: "Brainstorming estructurado - Diseño antes de implementación"
version: "1.0.0"
trigger: "Cuando el usuario pide implementar una feature nueva o hacer cambios significativos"
source: "Adaptado de obra/superpowers"
---

# Brainstorming - DevelopNet

**Regla:** "NO invocar ningún skill de implementación hasta que hayas presentado un diseño y el usuario lo haya aprobado."

## Propósito

Transformar ideas en diseños completamente formados a través de diálogo colaborativo.

## Proceso Checklist

```
1. [ ] Explorar contexto del proyecto (archivos, docs, commits)
2. [ ] Hacer preguntas clarificadoras (una a la vez)
3. [ ] Proponer 2-3 enfoques con trade-offs
4. [ ] Presentar diseño en secciones
5. [ ] Escribir doc de diseño en .developnet/design-YYYY-MM-DD-[topic].md
6. [ ] Realizar auto-review del spec
7. [ ] Usuario revisa spec escrito
8. [ ] Invocar sdd-propose/sdd-design (únicos siguientes pasos permitidos)
```

## Principios Clave

### Una Pregunta por Mensaje

```markdown
<!-- ✅ CORRECTO -->
¿Qué tipo de usuarios van a usar esta feature?
A) Solo admin
B) Usuarios de la organización
C) Usuarios externos también

<!-- ❌ INCORRECTO -->
¿Qué tipo de usuarios? ¿Y qué permisos necesitan?
¿También necesitás auditoría? ¿Cómo se va a integrar con el módulo existente?
```

### Preferir Opciones Múltiples

```markdown
Para el sistema de notificaciones, ¿qué canal preferís?

A) **Email** - Más formal, llega seguro
B) **WebSocket en tiempo real** - Inmediato, requiere conexión
C) **Push notifications** - Funciona en mobile
D) **Todos los anteriores** - Máxima cobertura, más complejidad
```

### YAGNI Implacable

Antes de agregar cualquier feature, preguntarse:
- ¿El usuario pidió esto específicamente?
- ¿Es necesario para el MVP?
- ¿Podemos agregarlo después si se necesita?

```markdown
<!-- ❌ REMOVIDO - No solicitado -->
- Sistema de plugins extensible
- Cache multi-nivel
- Soporte para múltiples idiomas

<!-- ✅ MANTENIDO - Requerido -->
- CRUD básico
- Validación de inputs
- Manejo de errores
```

### Validación Incremental

```markdown
## Paso 1: Confirmemos los Requisitos

Según entiendo, necesitás:
1. [requisito 1]
2. [requisito 2]

¿Es correcto? ¿Falta algo importante?

---

## Paso 2: Enfoque Propuesto

Propongo usar [enfoque] porque [razón].

¿Te parece bien continuar con este enfoque?
```

## Warning: Anti-Patrón

> Los proyectos "simples" a menudo tienen la mayor cantidad de asunciones no examinadas, desperdiciando trabajo.

**TODO proyecto, sin importar la complejidad percibida, requiere presentación de diseño y aprobación.**

## Formato de Doc de Diseño

```markdown
# Diseño: [Nombre del Feature]

**Fecha**: YYYY-MM-DD
**Estado**: Draft / En Revisión / Aprobado
**Autor**: [nombre]

## Contexto

### Problema
[Qué problema resuelve]

### Usuarios
[Quién va a usar esto]

### Restricciones
[Limitaciones técnicas o de negocio]

## Requisitos

### Funcionales
- [ ] RF1: [descripción]
- [ ] RF2: [descripción]

### No Funcionales
- [ ] RNF1: [descripción]

## Diseño Propuesto

### Arquitectura

```
[diagrama ASCII o descripción]
```

### Modelos de Datos

```prisma
model NuevoModelo {
  // schema propuesto
}
```

### API

```typescript
// Endpoints propuestos
POST /api/[recurso]
GET /api/[recurso]/:id
```

### UI (si aplica)

[Descripción de la interfaz]

## Alternativas Consideradas

### Opción A: [nombre]
- **Pros**: ...
- **Contras**: ...
- **Descartada porque**: ...

### Opción B: [nombre]
- **Pros**: ...
- **Contras**: ...
- **Elegida porque**: ...

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| [riesgo 1] | Media | Alto | [acción] |

## Plan de Implementación

1. Fase 1: [descripción]
2. Fase 2: [descripción]

## Preguntas Abiertas

- [ ] ¿Pregunta 1?
- [ ] ¿Pregunta 2?

---

## Aprobación

- [ ] Usuario aprobó diseño
- [ ] Fecha de aprobación: ____
```

## Self-Review Checklist

Antes de presentar al usuario:

- [ ] ¿Todos los requisitos tienen una solución?
- [ ] ¿Hay features que no se pidieron? → REMOVER
- [ ] ¿Las alternativas tienen justificación clara?
- [ ] ¿Los riesgos tienen mitigación?
- [ ] ¿El plan es realista?

## Transición a Siguiente Fase

Una vez aprobado el diseño:

```markdown
El diseño fue aprobado. Procediendo a invocar:

1. `sdd-propose` - Para formalizar alcance y criterios de aceptación
2. Luego `sdd-design` - Para decisiones arquitectónicas detalladas
```

## Envelope de Respuesta

```json
{
  "status": "design_complete" | "awaiting_approval" | "needs_clarification",
  "summary": "Diseño de [feature] completado, esperando aprobación",
  "artifacts": [".developnet/design-2026-03-07-feature-name.md"],
  "questions_resolved": 5,
  "open_questions": 0,
  "next_steps": ["sdd-propose"]
}
```

## Integración con SDD

El brainstorming es el **paso 0** antes del flujo SDD:

```
brainstorming → sdd-explore → sdd-propose → sdd-design → sdd-tasks → sdd-apply → sdd-verify
```

Solo después de aprobación del diseño se procede con el flujo SDD completo.
