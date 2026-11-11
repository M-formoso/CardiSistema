-- ============================================================
-- Migración: empleados + liquidación v2
-- Agrega Empresa, historial de jornales, préstamos, pagos parciales,
-- hs extras, obra en la liquidación. Elimina LiquidacionDia.
-- Toda la migración es idempotente (ver .claude/MIGRATIONS_RULES.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. ENUMS NUEVOS Y VALORES NUEVOS
-- ------------------------------------------------------------

-- SituacionFiscal
DO $$ BEGIN
  CREATE TYPE "SituacionFiscal" AS ENUM ('BLANCO', 'NEGRO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- EstadoPrestamoEmpleado
DO $$ BEGIN
  CREATE TYPE "EstadoPrestamoEmpleado" AS ENUM ('VIGENTE', 'SALDADO', 'ANULADO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- OrigenMovimiento: agregar PRESTAMO (ADD VALUE IF NOT EXISTS es idempotente desde PG 9.6+)
ALTER TYPE "OrigenMovimiento" ADD VALUE IF NOT EXISTS 'PRESTAMO';

-- EstadoLiquidacion: agregar PAGADA_PARCIAL
-- Nota: no usamos BEFORE/AFTER porque el enum se usa en transacciones;
-- el orden no afecta la lógica, solo la lista.
ALTER TYPE "EstadoLiquidacion" ADD VALUE IF NOT EXISTS 'PAGADA_PARCIAL';

-- ------------------------------------------------------------
-- 2. TABLA Empresa
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Empresa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Empresa_nombre_key" ON "Empresa"("nombre");
CREATE INDEX IF NOT EXISTS "Empresa_activo_idx" ON "Empresa"("activo");

DO $$ BEGIN
  ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------
-- 3. EmpleadoLegajo: columnas nuevas
-- ------------------------------------------------------------

ALTER TABLE "EmpleadoLegajo" ADD COLUMN IF NOT EXISTS "dni" TEXT;
ALTER TABLE "EmpleadoLegajo" ADD COLUMN IF NOT EXISTS "empresaId" TEXT;
ALTER TABLE "EmpleadoLegajo" ADD COLUMN IF NOT EXISTS "situacionFiscal" "SituacionFiscal" NOT NULL DEFAULT 'NEGRO';
ALTER TABLE "EmpleadoLegajo" ADD COLUMN IF NOT EXISTS "valorHoraExtra" DECIMAL(14,2);

CREATE INDEX IF NOT EXISTS "EmpleadoLegajo_empresaId_idx" ON "EmpleadoLegajo"("empresaId");
CREATE INDEX IF NOT EXISTS "EmpleadoLegajo_obraActualId_idx" ON "EmpleadoLegajo"("obraActualId");

DO $$ BEGIN
  ALTER TABLE "EmpleadoLegajo" ADD CONSTRAINT "EmpleadoLegajo_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------
-- 4. EmpleadoJornalHistorico
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "EmpleadoJornalHistorico" (
    "id" TEXT NOT NULL,
    "legajoId" TEXT NOT NULL,
    "jornal" DECIMAL(14,2) NOT NULL,
    "valorHoraExtra" DECIMAL(14,2),
    "vigenteDesde" DATE NOT NULL,
    "motivo" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmpleadoJornalHistorico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmpleadoJornalHistorico_legajoId_vigenteDesde_idx"
    ON "EmpleadoJornalHistorico"("legajoId", "vigenteDesde");

DO $$ BEGIN
  ALTER TABLE "EmpleadoJornalHistorico" ADD CONSTRAINT "EmpleadoJornalHistorico_legajoId_fkey"
    FOREIGN KEY ("legajoId") REFERENCES "EmpleadoLegajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "EmpleadoJornalHistorico" ADD CONSTRAINT "EmpleadoJornalHistorico_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------
-- 5. PrestamoEmpleado
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "PrestamoEmpleado" (
    "id" TEXT NOT NULL,
    "beneficiarioId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "saldoPendiente" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoPrestamoEmpleado" NOT NULL DEFAULT 'VIGENTE',
    "movimientoId" TEXT,
    "observaciones" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrestamoEmpleado_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrestamoEmpleado_beneficiarioId_idx" ON "PrestamoEmpleado"("beneficiarioId");
CREATE INDEX IF NOT EXISTS "PrestamoEmpleado_estado_idx" ON "PrestamoEmpleado"("estado");

DO $$ BEGIN
  ALTER TABLE "PrestamoEmpleado" ADD CONSTRAINT "PrestamoEmpleado_beneficiarioId_fkey"
    FOREIGN KEY ("beneficiarioId") REFERENCES "Beneficiario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PrestamoEmpleado" ADD CONSTRAINT "PrestamoEmpleado_movimientoId_fkey"
    FOREIGN KEY ("movimientoId") REFERENCES "Movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PrestamoEmpleado" ADD CONSTRAINT "PrestamoEmpleado_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PrestamoEmpleado" ADD CONSTRAINT "PrestamoEmpleado_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------
-- 6. PrestamoAplicacion
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "PrestamoAplicacion" (
    "id" TEXT NOT NULL,
    "prestamoId" TEXT NOT NULL,
    "liquidacionItemId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrestamoAplicacion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrestamoAplicacion_prestamoId_idx" ON "PrestamoAplicacion"("prestamoId");
CREATE INDEX IF NOT EXISTS "PrestamoAplicacion_liquidacionItemId_idx" ON "PrestamoAplicacion"("liquidacionItemId");

DO $$ BEGIN
  ALTER TABLE "PrestamoAplicacion" ADD CONSTRAINT "PrestamoAplicacion_prestamoId_fkey"
    FOREIGN KEY ("prestamoId") REFERENCES "PrestamoEmpleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- La FK a LiquidacionItem se agrega más abajo, después de modificar la tabla.

-- ------------------------------------------------------------
-- 7. LiquidacionSemanal: agregar obraId, totalAPagar; sacar unique
-- ------------------------------------------------------------

ALTER TABLE "LiquidacionSemanal" ADD COLUMN IF NOT EXISTS "obraId" TEXT;
ALTER TABLE "LiquidacionSemanal" ADD COLUMN IF NOT EXISTS "totalAPagar" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- Para data existente (staging): setear obraId a la obra GENERAL si hay.
-- Si no hay, no se puede continuar: avisar y abortar.
DO $$
DECLARE
  obra_general_id TEXT;
  liq_pendientes INT;
BEGIN
  SELECT id INTO obra_general_id FROM "Obra" WHERE tipo = 'GENERAL' LIMIT 1;
  SELECT COUNT(*) INTO liq_pendientes FROM "LiquidacionSemanal" WHERE "obraId" IS NULL;
  IF liq_pendientes > 0 THEN
    IF obra_general_id IS NULL THEN
      RAISE EXCEPTION 'No se puede migrar LiquidacionSemanal: hay % filas sin obra y no existe obra GENERAL', liq_pendientes;
    END IF;
    UPDATE "LiquidacionSemanal" SET "obraId" = obra_general_id WHERE "obraId" IS NULL;
  END IF;
END $$;

ALTER TABLE "LiquidacionSemanal" ALTER COLUMN "obraId" SET NOT NULL;

-- Remover unique viejo (si existe)
DROP INDEX IF EXISTS "LiquidacionSemanal_semanaInicio_semanaFin_key";

-- Nuevos índices
CREATE INDEX IF NOT EXISTS "LiquidacionSemanal_obraId_semanaInicio_idx"
    ON "LiquidacionSemanal"("obraId", "semanaInicio");
CREATE INDEX IF NOT EXISTS "LiquidacionSemanal_semanaInicio_semanaFin_idx"
    ON "LiquidacionSemanal"("semanaInicio", "semanaFin");

DO $$ BEGIN
  ALTER TABLE "LiquidacionSemanal" ADD CONSTRAINT "LiquidacionSemanal_obraId_fkey"
    FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------
-- 8. LiquidacionItem: agregar hs extras + préstamos aplicados
-- ------------------------------------------------------------

ALTER TABLE "LiquidacionItem" ADD COLUMN IF NOT EXISTS "horasExtras" DECIMAL(6,2) NOT NULL DEFAULT 0;
ALTER TABLE "LiquidacionItem" ADD COLUMN IF NOT EXISTS "valorHoraExtra" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "LiquidacionItem" ADD COLUMN IF NOT EXISTS "prestamosAplicados" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- FK pendiente de PrestamoAplicacion
DO $$ BEGIN
  ALTER TABLE "PrestamoAplicacion" ADD CONSTRAINT "PrestamoAplicacion_liquidacionItemId_fkey"
    FOREIGN KEY ("liquidacionItemId") REFERENCES "LiquidacionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------
-- 9. LiquidacionDia: eliminar
-- ------------------------------------------------------------

DROP TABLE IF EXISTS "LiquidacionDia";

-- ------------------------------------------------------------
-- 10. LiquidacionPago
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "LiquidacionPago" (
    "id" TEXT NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "movimientoId" TEXT,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "medioPago" "MedioPago" NOT NULL,
    "cajaId" TEXT NOT NULL,
    "observaciones" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiquidacionPago_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LiquidacionPago_movimientoId_key" ON "LiquidacionPago"("movimientoId");
CREATE INDEX IF NOT EXISTS "LiquidacionPago_liquidacionId_idx" ON "LiquidacionPago"("liquidacionId");
CREATE INDEX IF NOT EXISTS "LiquidacionPago_cajaId_fecha_idx" ON "LiquidacionPago"("cajaId", "fecha");

DO $$ BEGIN
  ALTER TABLE "LiquidacionPago" ADD CONSTRAINT "LiquidacionPago_liquidacionId_fkey"
    FOREIGN KEY ("liquidacionId") REFERENCES "LiquidacionSemanal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "LiquidacionPago" ADD CONSTRAINT "LiquidacionPago_movimientoId_fkey"
    FOREIGN KEY ("movimientoId") REFERENCES "Movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "LiquidacionPago" ADD CONSTRAINT "LiquidacionPago_cajaId_fkey"
    FOREIGN KEY ("cajaId") REFERENCES "Caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "LiquidacionPago" ADD CONSTRAINT "LiquidacionPago_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
