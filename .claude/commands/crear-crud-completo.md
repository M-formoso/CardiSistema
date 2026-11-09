# Crear CRUD Completo

Crea un CRUD completo (backend + frontend) para una entidad del MVP de AgroFácil.

## Parámetros
- **$ARGUMENTS**: Nombre de la entidad en singular (ej: `"lote"`, `"campania"`, `"cultivo"`)

## Orden de ejecución

### 1. Backend (NestJS + Prisma)

**Modelo Prisma** (`backend/prisma/schema.prisma`):
```prisma
model Xxx {
  id         String   @id @default(uuid())
  cuentaId   String   @map("cuenta_id")
  // ... campos específicos
  activo     Boolean  @default(true)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  cuenta     Cuenta   @relation(fields: [cuentaId], references: [id])

  @@map("xxxs")
}
```

**DTOs Zod** (`backend/src/modules/{entidad}/dto/`):
```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const crearXxxSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  // ... más campos
});
export class CrearXxxDto extends createZodDto(crearXxxSchema) {}
export type CrearXxxInput = z.infer<typeof crearXxxSchema>;
```

**Service** + **Controller** + **Module** según template de `/crear-modulo-backend`.

**Migración**:
```bash
cd backend && npx prisma migrate dev --name agregar_xxx
```

### 2. Frontend (React + Vite)

**Tipos** (`frontend/src/types/{entidad}.ts`)

**Servicio** (`frontend/src/services/{entidad}Service.ts`)

**Hook** (`frontend/src/hooks/use{Entidad}.ts`)

**Componentes**:
- `{Entidad}List.tsx` — tabla shadcn DataTable
- `{Entidad}Form.tsx` — React Hook Form + Zod (el MISMO schema que el backend si tiene sentido)
- `{Entidad}Detail.tsx`

**Páginas**:
- `/src/pages/{entidad}s/index.tsx`
- `/src/pages/{entidad}s/nuevo.tsx`
- `/src/pages/{entidad}s/[id].tsx`

### 3. Tests

**Backend**:
```bash
cd backend && npm run test -- {entidad}
```

**Frontend**:
```bash
cd frontend && npm run test -- {Entidad}
```

### 4. Verificación manual
- [ ] Crear un registro desde el frontend funciona y persiste en Postgres.
- [ ] Listar paginado funciona.
- [ ] Editar y eliminar (soft) funcionan.
- [ ] **Tenant isolation**: con un usuario de otra cuenta, los registros no aparecen.

---

## Ejemplo de uso
```
/crear-crud-completo lote
/crear-crud-completo campania
```
