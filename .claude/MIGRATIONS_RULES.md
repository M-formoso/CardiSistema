# Migraciones Prisma — reglas duras (NO negociables)

Adaptado del playbook de DevelopNet, aplicado al Sistema Cardi.

## 1. Backend corre `prisma migrate deploy` en start:prod

**Archivo**: `backend/package.json` → `"start:prod": "prisma migrate deploy && node dist/main.js"`.

Esto significa:
- Si agregás un campo o modelo a `backend/prisma/schema.prisma` SIN crear la migration formal, Railway **NO** sincroniza la DB.
- Al arrancar el service, el schema de Prisma espera columnas/tablas que no existen → **P2022** → crash en loop en cualquier endpoint que toque esa entidad.

**NUNCA usar `prisma db push` en staging ni en producción.** Solo en Postgres local durante exploración, y siempre terminar con `prisma migrate dev --name <nombre>` para formalizar.

## 2. Toda nueva columna/tabla/enum requiere migration formal

Flujo correcto:
```bash
cd backend
pnpm db:migrate   # equivale a: npx prisma migrate dev --name <nombre_descriptivo>
```

Esto genera `backend/prisma/migrations/<timestamp>_<nombre>/migration.sql` que **DEBE** quedar commiteado en el mismo cambio que tocó `schema.prisma`.

Si olvidaste la migration y ya mergeaste → hotfix idempotente (ver #3).

## 3. Toda migration SQL va con `IF NOT EXISTS` / `EXCEPTION WHEN duplicate_object`

Patrón canónico:

```sql
-- Columnas
ALTER TABLE "tabla" ADD COLUMN IF NOT EXISTS "campo" TEXT;

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS "tabla_campo_key" ON "tabla"("campo");

-- Enums
DO $$ BEGIN
  CREATE TYPE "MiEnum" AS ENUM ('A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "tabla" ADD CONSTRAINT "tabla_fk_fkey"
    FOREIGN KEY ("fk") REFERENCES "otra"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tablas
CREATE TABLE IF NOT EXISTS "mi_tabla" (...);
```

**Por qué**: en staging/dev un `db push` previo o manual puede haber dejado la columna/tabla ya creada. Sin `IF NOT EXISTS` el `migrate deploy` falla con `42701` (column already exists), queda en estado FAILED (P3009) y **bloquea todas las migrations siguientes**.

## 4. Antes de pushear cambios de schema

Checklist obligatorio:
- [ ] `pnpm db:migrate` generó archivo en `backend/prisma/migrations/`
- [ ] El `migration.sql` usa `IF NOT EXISTS` / `EXCEPTION WHEN duplicate_object` donde aplique
- [ ] `prisma generate` compila sin errores
- [ ] `pnpm build` del backend pasa
- [ ] `pnpm test` pasa (incluye tests de money.ts en packages/shared)

Validación recomendada ante dudas: `prisma migrate diff --from-url <db_staging> --to-schema-datamodel backend/prisma/schema.prisma` → tiene que dar "empty migration".

## 5. Si el backend crashea con P2022 o P3009

**P2022** (column does not exist):
→ Falta migration. Crearla idempotente, commit hotfix, push a `develop`, verificar staging, pedir OK para prod.

**P3009** (failed migration bloqueando):
1. Chequear `_prisma_migrations` en Postgres (Railway UI → Database → Query):
   ```sql
   SELECT migration_name, started_at, finished_at, rolled_back_at
   FROM "_prisma_migrations"
   WHERE finished_at IS NULL;
   ```
2. Si hay una con `finished_at IS NULL` → marcarla rolled back:
   ```sql
   UPDATE "_prisma_migrations"
   SET rolled_back_at = NOW()
   WHERE migration_name = '<nombre>' AND finished_at IS NULL;
   ```
3. Commit con migration idempotente del mismo nombre o fix.
4. Redeploy.

## 6. Datos de producción

- **Backups diarios**: habilitados en Railway + `pg_dump` adicional por cron. Documentado en `docs/runbook.md`.
- Nunca correr migrations destructivas (`DROP COLUMN`, `DROP TABLE`) sin OK explícito de Mateo y backup verificado.
- Para rename de columnas: seguir patrón "expand/contract" (agregar nueva, migrar datos, deprecar vieja en un segundo deploy).
- La migración de 2026 (bloque 09) tiene su propio playbook en `docs/sdd/` y usa transacciones + lotes idempotentes (`migracion_lotes`, `migracion_filas`).
