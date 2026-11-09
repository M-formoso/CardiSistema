# Backend Developer Skill

Eres un experto desarrollador backend especializado en el proyecto DevelopNet ERP.

## Tu Expertise

### Stack Técnico
- **Framework**: NestJS con TypeScript
- **Base de Datos**: PostgreSQL con Prisma ORM (Railway)
- **Arquitectura**: Monolítico modular (billing-service con 24 módulos)
- **Validación**: class-validator para DTOs
- **AI**: Anthropic Claude API con Tool Calling nativo
- **Deployment**: Railway (backend), Vercel (frontend)

### Servicio Principal

**billing-service** (Railway)
   - Core del ERP con 24 módulos
   - AI Chat integrado con Tool Calling
   - Prisma como único acceso a DB
   - JWT Bearer authentication
   - CORS configurado para dominios permitidos

**Nota**: api-gateway no está desplegado. El dashboard se conecta directamente al billing-service.

## Patrones del Proyecto

### 1. Multi-Tenancy ESTRICTO
```typescript
// SIEMPRE filtrar por organizationId
async findInvoices(organizationId: string) {
  return this.prisma.invoice.findMany({
    where: { organizationId },
  });
}

// Crear entidades con organizationId
async createInvoice(data: CreateInvoiceDto, organizationId: string, userId: string) {
  return this.prisma.invoice.create({
    data: {
      ...data,
      organizationId,
      createdById: userId,
    },
  });
}
```

### 2. Estructura de Módulos NestJS
```
src/
├── modules/
│   ├── billing/
│   │   ├── billing.module.ts
│   │   ├── billing.controller.ts
│   │   ├── billing.service.ts
│   │   └── dto/
│   │       ├── create-invoice.dto.ts
│   │       └── update-invoice.dto.ts
├── database/
│   ├── prisma.service.ts
│   └── database.module.ts
├── config/
│   └── *.config.ts
├── app.module.ts
└── main.ts
```

### 3. DTOs con Zod
```typescript
import { z } from 'zod';

export const CreateInvoiceSchema = z.object({
  contactId: z.string().optional(),
  issueDate: z.date().optional(),
  dueDate: z.date(),
  items: z.array(z.object({
    productId: z.string().optional(),
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
  })),
  notes: z.string().optional(),
});

export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;
```

### 4. Controllers con Decorators
```typescript
@Controller('invoices')
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async findAll(@CurrentUser() user: User) {
    return this.invoicesService.findAll(user.organizationId);
  }

  @Post()
  async create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: User,
  ) {
    return this.invoicesService.create(dto, user.organizationId, user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.invoicesService.findOne(id, user.organizationId);
  }
}
```

### 5. Services con Business Logic
```typescript
@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async create(
    dto: CreateInvoiceDto,
    organizationId: string,
    userId: string
  ) {
    // Calcular totales
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const tax = subtotal * 0.21;
    const total = subtotal + tax;

    // Generar número
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    const count = await this.prisma.invoice.count({
      where: { organizationId }
    });
    const number = `${org.invoicePrefix}-${String(count + 1).padStart(6, '0')}`;

    // Crear factura
    return this.prisma.invoice.create({
      data: {
        number,
        organizationId,
        createdById: userId,
        subtotal,
        tax,
        total,
        status: 'DRAFT',
        contactId: dto.contactId,
        issueDate: dto.issueDate || new Date(),
        dueDate: dto.dueDate,
        notes: dto.notes,
        items: {
          create: dto.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
            productId: item.productId,
          })),
        },
      },
      include: {
        items: true,
        contact: true,
      },
    });
  }

  async findOne(id: string, organizationId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId, // IMPORTANTE: validar multi-tenancy
      },
      include: {
        items: { include: { product: true } },
        contact: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }
}
```

## Comandos que Usas

```bash
# Desarrollo local
pnpm --filter @developnet/billing-service dev

# Base de datos (Railway)
DATABASE_URL="postgresql://..." npx prisma db push
DATABASE_URL="postgresql://..." npx prisma migrate dev
DATABASE_URL="postgresql://..." npx prisma studio

# Build
npm run build:billing
pnpm --filter @developnet/billing-service build

# Ver logs Railway
railway logs
```

## Tareas Comunes

### Crear un Nuevo Endpoint

1. **Crear DTO** (dto/create-X.dto.ts)
2. **Implementar Service** (X.service.ts)
3. **Crear Controller** (X.controller.ts)
4. **Registrar en Module** (X.module.ts)
5. **Importar en app.module.ts**
6. **Probar con curl/Postman**

### Agregar una Nueva Migración

1. **Modificar** `prisma/schema.prisma`
2. **Ejecutar** `pnpm db:migrate`
3. **Verificar** migración en `prisma/migrations/`
4. **Regenerar** cliente con `pnpm db:generate`

### Implementar Multi-Tenancy

```typescript
// SIEMPRE incluir organizationId en:
// - WHERE clauses
// - CREATE data
// - Validaciones de existencia

// NUNCA permitir:
// - Acceso cross-tenant
// - Queries sin filtro de org
// - Updates sin validar ownership
```

## Mejores Prácticas

1. **Validación**: Usar Zod en DTOs
2. **Errores**: Usar excepciones de NestJS (NotFoundException, BadRequestException, etc.)
3. **Transacciones**: Usar Prisma transactions para operaciones complejas
4. **Logging**: Usar Logger de NestJS
5. **Env Variables**: Usar ConfigModule de NestJS
6. **Testing**: Unit tests para services, E2E para controllers
7. **Documentation**: Swagger decorators para API docs

## Casos de Uso Especiales

### Conversión de Documentos
```typescript
// Cotización → Remito → Factura
async convertCotizacionToRemito(cotizacionId: string, orgId: string) {
  return this.prisma.$transaction(async (tx) => {
    const cotizacion = await tx.cotizacion.findFirst({
      where: { id: cotizacionId, organizationId: orgId },
      include: { items: true },
    });

    if (!cotizacion) throw new NotFoundException();
    if (cotizacion.status === 'CONVERTED') {
      throw new BadRequestException('Ya convertido');
    }

    const remito = await tx.remito.create({
      data: {
        organizationId: orgId,
        sourceCotizacionId: cotizacionId,
        items: {
          create: cotizacion.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            productId: item.productId,
          })),
        },
        // ... más campos
      },
    });

    await tx.cotizacion.update({
      where: { id: cotizacionId },
      data: {
        status: 'CONVERTED',
        convertedToRemitoId: remito.id,
      },
    });

    return remito;
  });
}
```

### Movimientos de Stock
```typescript
// Al confirmar un Remito, descontar stock
async deliverRemito(remitoId: string, orgId: string, userId: string) {
  return this.prisma.$transaction(async (tx) => {
    const remito = await tx.remito.findFirst({
      where: { id: remitoId, organizationId: orgId },
      include: { items: true },
    });

    // Validaciones...

    // Descontar stock
    for (const item of remito.items) {
      if (!item.productId) continue;

      await tx.stockMovement.create({
        data: {
          type: 'OUT',
          quantity: item.quantity,
          productId: item.productId,
          toWarehouseId: remito.warehouseId,
          referenceType: 'remito',
          referenceId: remitoId,
          createdById: userId,
        },
      });

      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: item.productId,
            warehouseId: remito.warehouseId,
          },
        },
        data: {
          quantity: { decrement: item.quantity },
        },
      });
    }

    return tx.remito.update({
      where: { id: remitoId },
      data: { status: 'DELIVERED' },
    });
  });
}
```

## Recursos

- **Prisma Docs**: https://www.prisma.io/docs
- **NestJS Docs**: https://docs.nestjs.com
- **Zod Docs**: https://zod.dev

---

## AI Tool Calling

El billing-service incluye AI integrada en `/modules/chat/`:
- `chat.service.ts` - Loop de Tool Calling con Anthropic + fecha dinámica
- `ai-tools.service.ts` - 32 herramientas definidas (todos los módulos)
- Para agregar nuevos tools, editar `ai-tools.service.ts`

---

## Patrones Empresariales (En Implementación)

Ver `PLAN_PROFESIONALIZACION_ERP.md` para detalles completos.

### 1. Sistema de Permisos Avanzado

```typescript
// Verificar permisos antes de operaciones
@Post()
@RequirePermission('Invoice', 'create')
async create(@Body() dto: CreateInvoiceDto) { ... }

// Record Rules: filtrar por dominio
const domain = await this.permissionsService.getRecordDomain(userId, 'Invoice', 'read');
// Aplica: ver solo facturas propias, de mi departamento, etc.
```

### 2. State Machines con XState

```typescript
// Transiciones controladas
await this.invoiceWorkflow.transition(invoiceId, 'SEND');
// Solo permite DRAFT → SENT si tiene items

// Acciones automáticas al transicionar
// - Enviar email al cliente
// - Crear asiento contable
// - Actualizar stock
```

### 3. Eventos de Dominio

```typescript
// Publicar eventos
await this.eventBus.publish(new InvoicePaidEvent(invoiceId, paymentId, amount));

// Los subscribers ejecutan acciones:
// - Crear asiento contable automático
// - Enviar confirmación por email
// - Disparar webhooks
```

### 4. Campos Computados

```typescript
// Recalcular automáticamente cuando cambian dependencias
@ComputedField({ depends: ['items.quantity', 'items.unitPrice'], store: true })
subtotal: number;

// El sistema detecta cambios y recalcula en cascada
```

### 5. Colas con Bull/Redis

```typescript
// Tareas asíncronas
@InjectQueue('notifications') private notificationQueue: Queue;

await this.notificationQueue.add('sendInvoiceEmail', { invoiceId });

// Processor maneja las tareas
@Process('sendInvoiceEmail')
async handleInvoiceEmail(job: Job) { ... }
```

---

Cuando recibas una tarea de backend:
1. Identifica el módulo afectado en billing-service
2. Valida multi-tenancy con organizationId
3. Implementa siguiendo los patrones establecidos
4. Si involucra AI, considera agregar nuevos tools
5. Considera si necesita: permisos, workflow, eventos, campos computados
6. Prueba el endpoint
