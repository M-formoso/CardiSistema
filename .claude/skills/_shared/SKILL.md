---
name: "_shared"
description: "Convenciones compartidas entre todos los skills del proyecto DevelopNet"
version: "2.0.0"
author: "DevelopNet Team"
updated: "2026-04-13"
source: "Mejorado con prácticas de obra/superpowers"
---

# Convenciones Compartidas

Este skill define las convenciones y patrones que TODOS los demás skills deben seguir.

## Principios Fundamentales (De Superpowers)

### 1. Verificación Antes de Claims
```
NO hay claims de éxito sin ejecutar comandos de verificación
```

### 2. TDD Obligatorio
```
NO hay código de producción sin test fallido primero
```

### 3. Investigación Antes de Fixes
```
NO hay fixes sin investigación de causa raíz
```

### 4. Diseño Antes de Implementación
```
NO hay implementación sin diseño aprobado
```

## Envelope de Respuesta

Cada skill DEBE retornar un envelope estructurado:

```json
{
  "status": "completed" | "blocked" | "needs_review",
  "summary": "Resumen de 1-2 oraciones de lo realizado",
  "artifacts": ["lista", "de", "archivos", "creados/modificados"],
  "next_steps": ["siguientes", "acciones", "sugeridas"],
  "blockers": ["problemas", "encontrados"] // solo si status = blocked
}
```

## Nomenclatura de Archivos

### Documentos de Fase
```
.developnet/
├── exploration.md      # Output de sdd-explore
├── proposal.md         # Output de sdd-propose
├── design.md           # Output de sdd-design
├── tasks.md            # Output de sdd-tasks
├── verification.md     # Output de sdd-verify
└── session-log.md      # Historial de sesiones
```

### Convenciones de Naming
- **Archivos**: `kebab-case.extension`
- **Clases**: `PascalCase`
- **Variables/funciones**: `camelCase`
- **Constantes**: `SCREAMING_SNAKE_CASE`
- **Commits**: `type(scope): description` (Conventional Commits)

## Multi-Tenancy

**CRÍTICO**: Todo código en DevelopNet DEBE respetar multi-tenancy.

```typescript
// ✅ CORRECTO - Siempre filtrar por organizationId
const invoices = await prisma.invoice.findMany({
  where: { organizationId: user.organizationId }
});

// ❌ INCORRECTO - NUNCA queries sin filtro de org
const invoices = await prisma.invoice.findMany();
```

## Stack Técnico

| Capa | Tecnología |
|------|------------|
| Backend | NestJS + TypeScript + Prisma |
| Frontend | React + Vite + TailwindCSS |
| Database | PostgreSQL |
| AI | Anthropic Claude API |
| Deploy | Railway |

## Patrones de Código

### Services (NestJS)
```typescript
@Injectable()
export class EntityService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.entity.findMany({
      where: { organizationId },
    });
  }

  async create(dto: CreateDto, organizationId: string, userId: string) {
    return this.prisma.entity.create({
      data: { ...dto, organizationId, createdById: userId },
    });
  }
}
```

### Controllers (NestJS)
```typescript
@Controller('entities')
@UseGuards(JwtAuthGuard)
export class EntityController {
  @Get()
  async findAll(@Request() req) {
    return this.service.findAll(req.user.organizationId);
  }

  @Post()
  @RequirePermission('Entity', 'create')
  async create(@Body() dto: CreateDto, @Request() req) {
    return this.service.create(dto, req.user.organizationId, req.user.id);
  }
}
```

## Prohibiciones

1. **NUNCA** hacer queries sin `organizationId`
2. **NUNCA** exponer datos de una organización a otra
3. **NUNCA** usar `any` en TypeScript
4. **NUNCA** commitear secrets o credenciales
5. **NUNCA** modificar código sin leer el existente primero

## Prioridad de Lectura

Antes de implementar, SIEMPRE leer en este orden:

1. `prisma/schema.prisma` - Entender modelos
2. `src/modules/[modulo]/[modulo].service.ts` - Patrones existentes
3. `src/modules/[modulo]/[modulo].controller.ts` - Endpoints
4. `.claude/skills/` - Skills relevantes

## Criterios de Completitud

Un task está COMPLETO solo cuando:
- [ ] Código compila sin errores
- [ ] Multi-tenancy respetado
- [ ] Patrones del proyecto seguidos
- [ ] No hay `any` o types faltantes
- [ ] Build pasa: `pnpm --filter @developnet/billing-service build`
- [ ] Tests escritos con TDD (Red-Green-Refactor)
- [ ] Verificación ejecutada con evidencia en output

## Skills Disponibles

### Core Development
| Skill | Trigger | Descripción |
|-------|---------|-------------|
| `tdd` | Implementación de código | Ciclo Red-Green-Refactor obligatorio |
| `systematic-debugging` | Bugs/errores | Investigación de causa raíz primero |
| `verification-protocol` | Pre-commit/PR | Evidencia antes de claims |
| `code-review` | Post-implementación | Solicitar y recibir reviews |

### Planning & Design
| Skill | Trigger | Descripción |
|-------|---------|-------------|
| `brainstorming` | Features nuevas | Diseño antes de implementación |
| `parallel-agents` | 3+ problemas independientes | Dispatch paralelo |

### SDD Flow
| Skill | Trigger | Descripción |
|-------|---------|-------------|
| `sdd-orchestrator` | Features complejas | Coordina todo el flujo |
| `sdd-explore` | Análisis inicial | Investiga codebase |
| `sdd-propose` | Post-exploración | Define alcance |
| `sdd-design` | Post-propuesta | Arquitectura |
| `sdd-tasks` | Post-diseño | Desglose de tareas |
| `sdd-apply` | Implementación | Escribe código |
| `sdd-verify` | Post-implementación | Valida criterios |

### Support
| Skill | Trigger | Descripción |
|-------|---------|-------------|
| `memory-protocol` | Siempre | Persistencia entre sesiones |
| `frontend-design` | UI/UX | Interfaces distintivas |

## Flujo Recomendado

```
1. brainstorming     → Diseño aprobado
2. sdd-explore       → Análisis del codebase
3. sdd-propose       → Alcance definido
4. sdd-design        → Arquitectura decidida
5. sdd-tasks         → Tareas desglosadas
6. Por cada tarea:
   a. sdd-apply      → Implementación con TDD
   b. code-review    → Review del cambio
7. sdd-verify        → Verificación final
8. verification-protocol → Evidencia de completitud
```

## Comandos de Verificación

```bash
# Build (OBLIGATORIO antes de commit)
pnpm --filter @developnet/billing-service build

# Tests (OBLIGATORIO para código nuevo)
pnpm --filter @developnet/billing-service test

# Lint
pnpm lint

# Prisma
npx prisma validate
npx prisma generate

# Ver test específico
pnpm --filter @developnet/billing-service test -- [nombre-test]
```

## Red Flags Universales

Parar y revisar si detectás:

- ⚠️ Código sin test previo
- ⚠️ Fix sin investigación de causa raíz
- ⚠️ Claim de éxito sin ejecutar verificación
- ⚠️ Implementación sin diseño aprobado
- ⚠️ Lenguaje tentativo: "debería", "probablemente"
- ⚠️ Acuerdo performativo: "¡Tenés razón!"
- ⚠️ Saltear fases del flujo SDD
