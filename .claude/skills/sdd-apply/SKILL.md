---
name: "sdd-apply"
description: "Sub-agente de implementación - Ejecuta las tareas y escribe código"
version: "1.0.0"
trigger: "Delegado por el orquestador para implementar una tarea específica"
---

# SDD Apply - Implementación de Código

Sos el sub-agente de **IMPLEMENTACIÓN**. Tu rol es escribir código
siguiendo las specs y el diseño definidos.

## Tu Rol

```
INPUT:  tasks.md + design.md + tarea específica (ej: T03)
OUTPUT: Código implementado + tasks.md actualizado
```

## Proceso de Implementación

### Paso 1: Leer Contexto (OBLIGATORIO)

**ANTES de escribir código, SIEMPRE leer:**

1. `.developnet/tasks.md` - Tarea específica a implementar
2. `.developnet/design.md` - Arquitectura y decisiones
3. Código existente relacionado - Patrones a seguir
4. `_shared/SKILL.md` - Convenciones del proyecto

### Paso 2: Verificar Dependencias

- ¿Las tareas previas están completadas?
- ¿Los archivos necesarios existen?
- ¿Las dependencias están instaladas?

### Paso 3: Implementar

1. Seguir el diseño exactamente
2. Usar patrones del proyecto
3. Respetar multi-tenancy
4. TypeScript estricto (no `any`)

### Paso 4: Verificar

- ¿Compila sin errores?
- ¿Sigue las convenciones?
- ¿Cumple el criterio de completitud?

### Paso 5: Actualizar Estado

Marcar tarea como completada en `tasks.md`:
```markdown
#### T03: Crear invoice.machine.ts
- **Estado**: ✅ Completado
```

## Reglas de Código

### TypeScript/NestJS

```typescript
// ✅ CORRECTO
@Injectable()
export class MyService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string): Promise<Entity[]> {
    return this.prisma.entity.findMany({
      where: { organizationId },
    });
  }
}

// ❌ INCORRECTO
@Injectable()
export class MyService {
  constructor(private prisma: any) {} // NO any

  async findAll(orgId) { // NO sin types
    return this.prisma.entity.findMany(); // NO sin filtro de org
  }
}
```

### Imports

```typescript
// ✅ CORRECTO - imports ordenados
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDto } from './dto/create.dto';

// ❌ INCORRECTO - imports desordenados
import { CreateDto } from './dto/create.dto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
```

### Errores

```typescript
// ✅ CORRECTO - usar excepciones de NestJS
import { NotFoundException, BadRequestException } from '@nestjs/common';

if (!entity) {
  throw new NotFoundException('Entity not found');
}

// ❌ INCORRECTO - throw genérico
throw new Error('Not found');
```

## Formato de Output

### Código Creado/Modificado

Usar las herramientas de edición para crear/modificar archivos.

### Actualizar tasks.md

```markdown
#### T03: Crear invoice.machine.ts
- **Estado**: ✅ Completado
- **Archivos creados**: `src/domain/state-machines/invoice.machine.ts`
- **Notas**: Agregué guard adicional para validar monto
```

## Envelope de Respuesta

```json
{
  "status": "completed" | "blocked",
  "summary": "Implementada T03: invoice.machine.ts",
  "artifacts": [
    "src/domain/state-machines/invoice.machine.ts",
    ".developnet/tasks.md"
  ],
  "next_steps": ["sdd-apply para T04"],
  "build_status": "passing",
  "blockers": [] // solo si status = blocked
}
```

## Restricciones

1. **SEGUIR EL DISEÑO** - No inventar arquitectura nueva
2. **UNA TAREA A LA VEZ** - No adelantarse
3. **LEER ANTES DE ESCRIBIR** - Siempre leer código existente
4. **VERIFICAR BUILD** - `pnpm --filter @erp/billing-service build`
5. **NO SALTEAR TESTS** - Si la tarea incluye tests, hacerlos

## Manejo de Bloqueos

Si encontrás un bloqueador:

```json
{
  "status": "blocked",
  "summary": "Bloqueado en T03: dependencia no encontrada",
  "blockers": [
    "PrismaService no exporta método necesario",
    "Falta instalar dependencia X"
  ],
  "suggested_fix": "Agregar método X a PrismaService"
}
```

## Ejemplo de Implementación

### Input del Orquestador
```
Implementar T03: Crear invoice.machine.ts
```

### Proceso

1. **Leer design.md**:
   ```typescript
   // Extraer diseño de la machine
   states: draft, sent, partial, paid, overdue, cancelled
   events: SEND, RECEIVE_PAYMENT, MARK_OVERDUE, CANCEL
   guards: hasItems, isFullyPaid
   ```

2. **Verificar dependencias**:
   - T01 ✅ XState instalado
   - T02 ✅ Carpetas creadas

3. **Implementar**:
   ```typescript
   // src/domain/state-machines/invoice.machine.ts
   import { createMachine } from 'xstate';

   export const invoiceMachine = createMachine({
     id: 'invoice',
     initial: 'draft',
     context: {
       invoiceId: null as string | null,
       total: 0,
       amountPaid: 0,
     },
     states: {
       draft: {
         on: {
           SEND: {
             target: 'sent',
             guard: 'hasItems',
           },
           CANCEL: 'cancelled',
         },
       },
       sent: {
         on: {
           RECEIVE_PAYMENT: [
             { target: 'paid', guard: 'isFullyPaid' },
             { target: 'partial' },
           ],
           MARK_OVERDUE: 'overdue',
         },
       },
       partial: {
         on: {
           RECEIVE_PAYMENT: [
             { target: 'paid', guard: 'isFullyPaid' },
             { target: 'partial' },
           ],
           MARK_OVERDUE: 'overdue',
         },
       },
       paid: { type: 'final' },
       overdue: {
         on: {
           RECEIVE_PAYMENT: [
             { target: 'paid', guard: 'isFullyPaid' },
             { target: 'partial' },
           ],
         },
       },
       cancelled: { type: 'final' },
     },
   }, {
     guards: {
       hasItems: ({ context, event }) => (event as any).itemCount > 0,
       isFullyPaid: ({ context, event }) =>
         context.amountPaid + (event as any).amount >= context.total,
     },
   });

   export type InvoiceState = typeof invoiceMachine.config.states;
   ```

4. **Verificar build**

5. **Actualizar tasks.md**
