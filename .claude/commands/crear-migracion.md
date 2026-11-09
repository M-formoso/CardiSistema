# Crear Migración Prisma

Crea una migración de base de datos con Prisma para AgroFácil.

## Parámetros
- **$ARGUMENTS**: Descripción de la migración en snake_case (ej: `"agregar_tabla_lotes"`, `"agregar_columna_arrendamiento_a_lote"`)

## Instrucciones

### 1. Editar el schema Prisma

`backend/prisma/schema.prisma` — agregar/modificar el modelo. Respetar **siempre** las convenciones AgroFácil:

```prisma
model Xxx {
  id         String   @id @default(uuid())
  cuentaId   String   @map("cuenta_id")             // <-- multi-tenant SIEMPRE
  // ... campos específicos
  activo     Boolean  @default(true)                 // <-- soft delete
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  cuenta     Cuenta   @relation(fields: [cuentaId], references: [id])

  @@map("xxxs")                                      // tabla snake_case plural
  @@index([cuentaId])                                // index obligatorio en tenant
}
```

### 2. Generar la migración

```bash
cd backend
npx prisma migrate dev --name $ARGUMENTS
```

Esto:
- Aplica la migración al Postgres local
- Regenera el Prisma Client
- Crea el archivo SQL en `backend/prisma/migrations/`

### 3. Revisar el SQL generado

Abrir `backend/prisma/migrations/{timestamp}_{nombre}/migration.sql` y verificar:
- Tipos correctos (`Decimal(14,4)` para dinero, `Decimal(12,4)` para superficies/rinde)
- Foreign keys con `ON DELETE` apropiado
- Índices en campos de búsqueda frecuente

### 4. Aplicar a Railway (cuando esté listo)

```bash
# Railway aplica migraciones automáticamente vía:
# npx prisma migrate deploy
# en el comando de start del backend.
```

---

## Convenciones AgroFácil

### Tipos numéricos

| Concepto | Tipo Prisma | SQL |
|---|---|---|
| Dinero (USD) | `Decimal @db.Decimal(14, 4)` | `DECIMAL(14,4)` |
| Superficie (ha) | `Decimal @db.Decimal(12, 4)` | `DECIMAL(12,4)` |
| Rinde (qq/ha) | `Decimal @db.Decimal(10, 4)` | `DECIMAL(10,4)` |
| Cantidad insumo | `Decimal @db.Decimal(12, 4)` | `DECIMAL(12,4)` |
| Porcentaje | `Decimal @db.Decimal(5, 2)` | `DECIMAL(5,2)` |

> Usar `Float` SOLO si la precisión decimal es irrelevante. Para todo lo agro/financiero, **Decimal**.

### Enums (en Prisma)

```prisma
enum Tenencia {
  propio
  arrendado
  mixto
}

enum UnidadArrendamiento {
  qq_ha
  usd_ha
  pct_produccion
}

enum FormaPago {
  contado
  canje
  financiado
}

enum TipoCampania {
  fina
  gruesa
}
```

### Índices recomendados
```prisma
@@index([cuentaId])                  // siempre
@@index([cuentaId, activo])          // común
@@unique([cuentaId, nombre])         // si hay unicidad por tenant
```

### Cambios destructivos

Si un cambio es destructivo (borrar columna, cambiar tipo incompatible), Prisma pide confirmación. **Antes de aplicar en prod**:
1. Hacer backup de la DB de Railway.
2. Crear migración en una rama, probar localmente.
3. Si la columna tiene datos, hacer migración en 2 pasos: agregar nueva columna, copiar datos, luego borrar la vieja.

### Comandos útiles

```bash
npx prisma migrate dev --name $NOMBRE    # crear + aplicar (dev)
npx prisma migrate deploy                # aplicar pendientes (prod)
npx prisma migrate status                # ver estado
npx prisma migrate reset                 # reset total (SOLO dev)
npx prisma generate                      # regenerar client tras editar schema
npx prisma studio                        # GUI para inspeccionar DB
npx prisma db push                       # aplicar sin migración (prototipo rápido — NO usar en prod)
```

## Ejemplo de uso
```
/crear-migracion agregar_tabla_lotes_campania
/crear-migracion agregar_columna_rinde_real_qq_ha_a_lotes_campania
```
