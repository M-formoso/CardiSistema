---
name: "tdd"
description: "Test-Driven Development - Ciclo Red-Green-Refactor obligatorio"
version: "1.0.0"
trigger: "Cuando se implementa código nuevo, correcciones de bugs, o refactoring"
source: "Adaptado de obra/superpowers"
---

# Test-Driven Development - DevelopNet

**Regla de oro:** "Si no viste fallar la prueba, no sabés si prueba lo correcto"

## Principio Fundamental

```
NO HAY CÓDIGO DE PRODUCCIÓN SIN UNA PRUEBA FALLIDA PRIMERO
```

Si escribís código antes de la prueba, tenés que eliminarlo y empezar de nuevo.

## Ciclo Red-Green-Refactor

### 🔴 RED: Escribir Test que Falla

```typescript
// ✅ CORRECTO - Test primero
describe('InvoiceService', () => {
  it('should throw when trying to send invoice without items', async () => {
    const invoice = await createTestInvoice({ items: [] });

    await expect(service.send(invoice.id))
      .rejects.toThrow('Invoice must have at least one item');
  });
});
```

**Verificar RED:**
- Ejecutar el test
- Confirmar que falla por la razón correcta (funcionalidad faltante)
- NO por errores de tipeo o imports

### 🟢 GREEN: Código Mínimo para Pasar

```typescript
// ✅ CORRECTO - Código mínimo
async send(invoiceId: string): Promise<Invoice> {
  const invoice = await this.findOne(invoiceId);

  if (invoice.items.length === 0) {
    throw new BadRequestException('Invoice must have at least one item');
  }

  return this.updateStatus(invoiceId, 'SENT');
}
```

**Verificar GREEN:**
- Ejecutar TODOS los tests
- Confirmar que todos pasan
- Sin errores en output

### 🔵 REFACTOR: Limpiar (Solo en Verde)

- Eliminar duplicación
- Mejorar nombres
- Extraer funciones si es necesario
- **NUNCA** agregar funcionalidad nueva

## Cuándo Aplicar TDD

| Escenario | Aplicar TDD |
|-----------|-------------|
| Nueva funcionalidad | ✅ SIEMPRE |
| Bug fix | ✅ SIEMPRE (test que reproduce el bug primero) |
| Refactoring | ✅ SIEMPRE (tests de comportamiento existente) |
| Cambio de comportamiento | ✅ SIEMPRE |
| Prototipo exploratorio | ⚠️ Excepcional (con aprobación) |

## Características de Buenos Tests

### Minimalismo
```typescript
// ✅ Una sola conducta por test
it('should calculate total with tax', () => {
  const total = calculateTotal(100, 0.21);
  expect(total).toBe(121);
});

// ❌ Múltiples conductas
it('should calculate everything', () => {
  expect(calculateTotal(100, 0.21)).toBe(121);
  expect(calculateSubtotal(100)).toBe(100);
  expect(calculateTax(100, 0.21)).toBe(21);
});
```

### Claridad en Nombres
```typescript
// ✅ Nombres descriptivos
it('should throw when invoice total exceeds credit limit', () => {});

// ❌ Nombres vagos
it('should work correctly', () => {});
it('test invoice', () => {});
```

### Código Real sobre Mocks
```typescript
// ✅ Usar código real cuando sea posible
const prisma = new PrismaClient();
const service = new InvoiceService(prisma);

// ❌ Evitar mocks innecesarios
const mockPrisma = { invoice: { findMany: jest.fn() } };
```

## Racionalizaciones Rechazadas

| Excusa | Por Qué Está Mal |
|--------|------------------|
| "Lo pruebo después" | Tests posteriores pasan inmediatamente sin valor |
| "Ya lo probé manualmente" | Tests manuales no son reproducibles |
| "Es código simple" | El código simple también tiene bugs |
| "TDD es dogmático" | TDD es pragmático: evita bugs en producción |
| "No tengo tiempo" | Debuggear bugs es más lento que TDD |

## Estructura de Tests en DevelopNet

```
services/billing-service/src/modules/[modulo]/
├── [modulo].service.ts
├── [modulo].service.spec.ts      # Tests unitarios
├── [modulo].controller.ts
├── [modulo].controller.spec.ts   # Tests de controller
└── __tests__/
    └── [modulo].integration.spec.ts  # Tests de integración
```

## Comandos de Testing

```bash
# Ejecutar todos los tests
pnpm --filter @developnet/billing-service test

# Ejecutar tests de un módulo específico
pnpm --filter @developnet/billing-service test -- invoices

# Ejecutar tests en modo watch
pnpm --filter @developnet/billing-service test:watch

# Ejecutar con coverage
pnpm --filter @developnet/billing-service test:cov
```

## Checklist TDD

Antes de marcar una tarea como completada:

- [ ] Test escrito ANTES del código
- [ ] Test visto fallar (RED)
- [ ] Código mínimo implementado
- [ ] Test visto pasar (GREEN)
- [ ] Código refactorizado si necesario
- [ ] Todos los tests siguen pasando
- [ ] Sin `any` en tipos de test

## Envelope de Respuesta

```json
{
  "status": "completed",
  "summary": "Implementado [feature] con TDD. 3 tests agregados.",
  "artifacts": ["archivo.ts", "archivo.spec.ts"],
  "tdd_cycle": {
    "tests_written": 3,
    "tests_passing": 3,
    "red_green_verified": true
  }
}
```

## Integración con SDD

En el flujo SDD, TDD se aplica durante `sdd-apply`:

```
sdd-explore → sdd-propose → sdd-design → sdd-tasks → sdd-apply (con TDD) → sdd-verify
```

Cada tarea en `tasks.md` que involucra código DEBE seguir el ciclo Red-Green-Refactor.
