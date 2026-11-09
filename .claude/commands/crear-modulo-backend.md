# Crear Módulo Backend (NestJS)

Crea un nuevo módulo backend completo para AgroFácil siguiendo la arquitectura NestJS + Prisma + Zod.

## Parámetros
- **$ARGUMENTS**: Nombre del módulo en singular (ej: `"lote"`, `"campania"`, `"labor"`)

## Instrucciones

1. **Agregar el modelo Prisma** en `backend/prisma/schema.prisma`:
   - PK `id` (uuid).
   - `cuentaId String @map("cuenta_id")` (tenant — obligatorio en toda entidad de negocio).
   - `activo Boolean @default(true)` (soft delete).
   - `createdAt` y `updatedAt` con `@map("created_at"/"updated_at")`.
   - Relaciones con FKs.
   - `@@map("{tabla_plural_snake_case}")`.
   - Tipos numéricos: `Decimal @db.Decimal(14, 4)` para dinero; `Decimal @db.Decimal(12, 4)` para superficie/rinde.

2. **Crear DTOs con Zod** en `backend/src/modules/{modulo}/dto/`:
   - `crear-{modulo}.schema.ts` — schema Zod + tipo inferido `CrearXxxDto = z.infer<typeof schema>`.
   - `actualizar-{modulo}.schema.ts` — partial del anterior.
   - `{modulo}-response.dto.ts` — shape de respuesta tipado.
   - Usar `createZodDto` de `nestjs-zod` para integrarlo a NestJS.

3. **Crear el service** en `backend/src/modules/{modulo}/{modulo}.service.ts`:
   - `@Injectable()`.
   - Métodos: `listar`, `obtenerPorId`, `crear`, `actualizar`, `eliminar` (soft delete vía `activo: false`).
   - Lógica de negocio acá, **nunca en el controller**.
   - Logger pino con contexto (`cuentaId`, `usuarioId`) en operaciones de escritura.
   - Transacciones (`prisma.$transaction`) si toca > 1 tabla.

4. **Crear el controller** en `backend/src/modules/{modulo}/{modulo}.controller.ts`:
   - `@Controller('{modulo-plural-kebab}')`.
   - Guards: `@UseGuards(JwtAuthGuard)`.
   - Endpoints REST: `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`.
   - DTOs con `@Body() dto: CrearXxxDto`.
   - Paginación: `?page=1&limit=20`.

5. **Crear el module** en `backend/src/modules/{modulo}/{modulo}.module.ts`:
   - Importa `PrismaModule`.
   - Declara controller y service.
   - Exporta el service si otros módulos lo usan.

6. **Registrar en `app.module.ts`**.

7. **Crear migración Prisma**: `npx prisma migrate dev --name agregar_{modulo}`.

8. **Crear tests** en `backend/src/modules/{modulo}/tests/`:
   - `{modulo}.service.spec.ts` (unit con Prisma mock).
   - `{modulo}.controller.spec.ts` (e2e con Supertest contra Postgres de test).

---

## Template del Service

```typescript
// src/modules/{modulo}/{modulo}.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';
import { CrearXxxDto } from './dto/crear-{modulo}.schema';
import { ActualizarXxxDto } from './dto/actualizar-{modulo}.schema';

@Injectable()
export class XxxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  async listar(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const where = { activo: true, ...(search && { nombre: { contains: search, mode: 'insensitive' as const } }) };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.xxx.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.xxx.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async obtenerPorId(id: string) {
    const item = await this.prisma.xxx.findFirst({ where: { id, activo: true } });
    if (!item) throw new NotFoundException(`Xxx ${id} no encontrado`);
    return item;
  }

  async crear(dto: CrearXxxDto, usuarioId: string) {
    const creado = await this.prisma.xxx.create({ data: dto });
    this.logger.log({ usuarioId, xxxId: creado.id }, 'xxx creado');
    return creado;
  }

  async actualizar(id: string, dto: ActualizarXxxDto, usuarioId: string) {
    await this.obtenerPorId(id);
    const actualizado = await this.prisma.xxx.update({ where: { id }, data: dto });
    this.logger.log({ usuarioId, xxxId: id }, 'xxx actualizado');
    return actualizado;
  }

  async eliminar(id: string, usuarioId: string) {
    await this.obtenerPorId(id);
    await this.prisma.xxx.update({ where: { id }, data: { activo: false } });
    this.logger.log({ usuarioId, xxxId: id }, 'xxx eliminado (soft)');
  }
}
```

## Ejemplo de uso
```
/crear-modulo-backend lote
/crear-modulo-backend campania
```

## Checklist de verificación
- [ ] Modelo en Prisma schema con `cuenta_id`, `activo`, timestamps
- [ ] DTOs con Zod (Crear/Actualizar/Response)
- [ ] Service con lógica de negocio y logging
- [ ] Controller con JwtAuthGuard
- [ ] Module registrado en `app.module.ts`
- [ ] Migración Prisma aplicada
- [ ] Tests unit + e2e cubriendo CRUD y tenant isolation
