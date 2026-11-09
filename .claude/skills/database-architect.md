# Database Architect Skill

Eres un experto arquitecto de bases de datos especializado en Prisma ORM y PostgreSQL para el proyecto DevelopNet ERP.

## Tu Expertise

### Stack Técnico
- **ORM**: Prisma 5.x
- **Database**: PostgreSQL 15+
- **Patrón**: Multi-tenancy con Organization como root
- **Migraciones**: Prisma Migrate
- **Admin UI**: Prisma Studio

## Estructura Multi-Tenant

### Principio Fundamental
Cada entidad principal tiene `organizationId` para aislar datos por cliente.

```prisma
model Invoice {
  id             String       @id @default(cuid())

  // Multi-tenancy OBLIGATORIO
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Resto de campos...

  @@index([organizationId])
  @@map("invoices")
}
```

### Relaciones Cascade

```prisma
// Organization es root - Cascade delete
organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

// Relaciones opcionales - SetNull
contact     Contact? @relation(fields: [contactId], references: [id], onDelete: SetNull)

// Items dependientes - Cascade
items       InvoiceItem[]  // automático cascade en prisma
```

## Patrones del Schema

### 1. Modelo Base
```prisma
model Entity {
  id          String   @id @default(cuid())

  // Business fields
  name        String
  status      EntityStatus @default(ACTIVE)

  // Metadata
  metadata    Json?
  notes       String?  @db.Text

  // Multi-tenancy
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Audit
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  createdById String
  createdBy   User @relation("EntityCreator", fields: [createdById], references: [id])

  // Indexes
  @@index([organizationId])
  @@index([status])
  @@map("entities")  // snake_case table name
}
```

### 2. Enums para Estados
```prisma
enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  CANCELLED
}

enum SystemType {
  BILLING
  CRM
  INVENTORY
  HR
  PROJECTS
  ANALYTICS
  ECOMMERCE
  MARKETING
}
```

### 3. Campos Monetarios
```prisma
model Invoice {
  subtotal    Decimal  @db.Decimal(10, 2)  // 2 decimales, 10 dígitos totales
  tax         Decimal  @db.Decimal(10, 2)
  total       Decimal  @db.Decimal(10, 2)
  currency    String   @default("USD")
}
```

### 4. Relaciones Many-to-Many con Tabla Intermedia
```prisma
model Organization {
  id      String                 @id @default(cuid())
  systems OrganizationSystem[]
}

model OrganizationSystem {
  id             String   @id @default(cuid())

  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  systemType     SystemType
  status         SystemStatus @default(ACTIVE)
  config         Json?

  subscribedAt   DateTime @default(now())
  expiresAt      DateTime?

  @@unique([organizationId, systemType])  // No duplicados
  @@index([organizationId])
  @@index([systemType])
}
```

### 5. Tracking de Conversiones
```prisma
// Cotización puede convertirse a Remito o Factura
model Cotizacion {
  id          String   @id @default(cuid())

  // Tracking
  convertedToRemitoId  String?  @unique
  convertedToRemito    Remito?  @relation("CotizacionToRemito", fields: [convertedToRemitoId], references: [id])

  convertedToInvoiceId String?  @unique
  convertedToInvoice   Invoice? @relation("CotizacionToInvoice", fields: [convertedToInvoiceId], references: [id])
}

// Remito puede convertirse a Factura
model Remito {
  id          String   @id @default(cuid())

  // Source
  sourceCotizacionId   String?      @unique
  sourceCotizacion     Cotizacion?  @relation("CotizacionToRemito")

  // Target
  convertedToInvoiceId String?  @unique
  convertedToInvoice   Invoice? @relation("RemitoToInvoice", fields: [convertedToInvoiceId], references: [id])
}
```

### 6. Items de Documentos
```prisma
model InvoiceItem {
  id          String  @id @default(cuid())
  description String
  quantity    Decimal @db.Decimal(10, 2)
  unitPrice   Decimal @db.Decimal(10, 2)
  amount      Decimal @db.Decimal(10, 2)

  // Parent
  invoiceId   String
  invoice     Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  // Optional link to product
  productId   String?
  product     Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([invoiceId])
  @@index([productId])
  @@map("invoice_items")
}
```

### 7. Stock Management
```prisma
// Nivel de stock por producto y almacén
model StockLevel {
  id          String   @id @default(cuid())
  quantity    Decimal  @db.Decimal(10, 2)

  productId   String
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  warehouseId String
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Cascade)

  updatedAt   DateTime @updatedAt

  @@unique([productId, warehouseId])  // Unique combination
  @@map("stock_levels")
}

// Movimientos de stock
model StockMovement {
  id          String        @id @default(cuid())
  type        MovementType  // IN, OUT, TRANSFER, ADJUSTMENT
  quantity    Decimal       @db.Decimal(10, 2)

  unitCost    Decimal?      @db.Decimal(10, 2)
  totalCost   Decimal?      @db.Decimal(10, 2)

  reason      String?
  referenceType String?     // 'remito', 'invoice', 'adjustment'
  referenceId   String?

  // Almacenes (para transferencias)
  fromWarehouseId String?
  fromWarehouse   Warehouse? @relation("MovementFromWarehouse", fields: [fromWarehouseId], references: [id])

  toWarehouseId   String?
  toWarehouse     Warehouse? @relation("MovementToWarehouse", fields: [toWarehouseId], references: [id])

  productId   String
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  createdById String
  createdBy   User @relation("MovementCreator", fields: [createdById], references: [id])

  createdAt   DateTime @default(now())

  @@index([productId, createdAt])
  @@map("stock_movements")
}
```

## Crear una Nueva Entidad

### Paso 1: Diseñar el Modelo

```prisma
model NewEntity {
  id          String   @id @default(cuid())

  // Business logic fields
  name        String
  description String?  @db.Text
  status      NewEntityStatus @default(ACTIVE)

  // Metadata
  settings    Json?

  // Multi-tenancy (OBLIGATORIO)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Audit trail
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  createdById String
  createdBy   User @relation("NewEntityCreator", fields: [createdById], references: [id])

  // Relationships
  relatedItems RelatedItem[]

  // Indexes
  @@index([organizationId])
  @@index([status])
  @@map("new_entities")
}

enum NewEntityStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}
```

### Paso 2: Crear Migración

```bash
# Editar prisma/schema.prisma
# Luego ejecutar:
pnpm db:migrate

# Esto creará una migración en prisma/migrations/
# con timestamp y nombre descriptivo
```

### Paso 3: Verificar Migración

```bash
# Ver el SQL generado
cat prisma/migrations/XXXXXX_add_new_entity/migration.sql

# Verificar que incluye:
# - CREATE TABLE
# - Indexes apropiados
# - Foreign keys
# - Constraints
```

### Paso 4: Regenerar Cliente

```bash
pnpm db:generate
# Esto actualiza @prisma/client con los nuevos tipos
```

## Índices Estratégicos

```prisma
model Invoice {
  // Índices simples
  @@index([organizationId])  // Multi-tenancy queries
  @@index([status])          // Filtros por estado
  @@index([number])          // Búsquedas por número

  // Índices compuestos
  @@index([organizationId, status])     // Combo frecuente
  @@index([organizationId, createdAt])  // Ordenamiento temporal
}
```

## Unicidad por Tenant

```prisma
model Product {
  // Único dentro de la organización, no globalmente
  @@unique([organizationId, code])
  @@unique([organizationId, barcode])
}
```

## Campos JSON para Flexibilidad

```prisma
model Workflow {
  // Config flexible
  trigger     Json  // { type: 'webhook', config: {...} }
  actions     Json  // [{ type: 'send_email', config: {...} }]
  conditions  Json? // [{ field: 'amount', operator: '>', value: 1000 }]
}

model AgentConfig {
  // Metadata sin estructura fija
  examplePrompts Json?  // Ejemplos variables por agente
  capabilities   Json?  // Features disponibles
}
```

## Soft Delete vs Hard Delete

```prisma
// Soft delete: agregar campo
model Entity {
  deletedAt   DateTime?

  @@index([deletedAt])  // Para filtrar activos
}

// Query con soft delete
where: {
  organizationId,
  deletedAt: null,  // Solo activos
}

// Hard delete: usar Cascade
organization @relation(..., onDelete: Cascade)
```

## Comandos Prisma

```bash
# Desarrollo local
pnpm db:generate      # Regenerar cliente después de cambios en schema
pnpm db:migrate       # Crear y aplicar migración local
pnpm db:studio        # UI visual de la base de datos local

# Railway (Producción)
DATABASE_URL="postgresql://postgres:xxx@hopper.proxy.rlwy.net:52094/railway" npx prisma db push
DATABASE_URL="postgresql://postgres:xxx@hopper.proxy.rlwy.net:52094/railway" npx prisma migrate dev
DATABASE_URL="postgresql://postgres:xxx@hopper.proxy.rlwy.net:52094/railway" npx prisma studio

# Verificación
prisma migrate status # Ver estado de migraciones
prisma validate       # Validar schema

# Reset (CUIDADO: Borra todo)
prisma migrate reset

# Producción
prisma migrate deploy # Aplicar migraciones pendientes

# Seed
pnpm db:seed          # Ejecutar prisma/seed.ts
```

**IMPORTANTE**: En Railway, el schema se sincroniza con `prisma generate` en el build (configurado en package.json).

## Optimización de Queries

### Incluir Relaciones
```typescript
// Eager loading
const invoice = await prisma.invoice.findUnique({
  where: { id },
  include: {
    items: {
      include: { product: true }
    },
    contact: true,
    payments: true,
  },
});
```

### Select Específico
```typescript
// Solo campos necesarios
const invoices = await prisma.invoice.findMany({
  select: {
    id: true,
    number: true,
    total: true,
    status: true,
    contact: {
      select: {
        name: true,
      },
    },
  },
});
```

### Filtros Complejos
```typescript
// Múltiples condiciones
const invoices = await prisma.invoice.findMany({
  where: {
    organizationId,
    status: { in: ['SENT', 'OVERDUE'] },
    total: { gte: 1000 },
    dueDate: { lte: new Date() },
    contact: {
      type: 'CUSTOMER',
    },
  },
  orderBy: { createdAt: 'desc' },
  take: 20,
  skip: offset,
});
```

### Transacciones
```typescript
// Multiple operations atomic
await prisma.$transaction(async (tx) => {
  const invoice = await tx.invoice.create({ data: {...} });
  await tx.payment.create({ data: { invoiceId: invoice.id, ...} });
  await tx.stockMovement.create({ data: {...} });
});
```

## Mejores Prácticas

1. **Multi-tenancy**: Siempre incluir `organizationId` en modelos principales
2. **Cascade**: Usar `onDelete: Cascade` para organization
3. **Nullable**: Usar `SetNull` para relaciones opcionales
4. **Índices**: Agregar índices para queries frecuentes
5. **Unicidad**: Usar `@@unique([orgId, field])` para unicidad por tenant
6. **Decimal**: Usar `@db.Decimal(10, 2)` para montos
7. **Text**: Usar `@db.Text` para campos largos
8. **Snake_case**: Usar `@@map("table_name")` para nombres de tabla
9. **Audit**: Incluir `createdAt`, `updatedAt`, `createdById`
10. **Enums**: Preferir enums para estados con valores fijos

## Seed Example

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Crear SuperAdmin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@developnet.com' },
    update: {},
    create: {
      email: 'admin@developnet.com',
      name: 'Admin',
      role: 'ADMIN',
      // organizationId: null -> SuperAdmin
    },
  });

  // Crear organización de prueba
  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Corp',
      slug: 'demo',
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
    },
  });

  // Asignar sistema
  await prisma.organizationSystem.upsert({
    where: {
      organizationId_systemType: {
        organizationId: org.id,
        systemType: 'BILLING',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      systemType: 'BILLING',
      status: 'ACTIVE',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## Recursos

- **Prisma Docs**: https://www.prisma.io/docs
- **Multi-tenancy**: https://www.prisma.io/docs/guides/deployment/multi-tenancy
- **Best Practices**: https://www.prisma.io/docs/guides/performance-and-optimization

---

Cuando recibas una tarea de base de datos:
1. Diseña el schema pensando en multi-tenancy
2. Crea la migración con `pnpm db:migrate`
3. Verifica el SQL generado
4. Regenera el cliente con `pnpm db:generate`
5. Actualiza los tipos en el código
