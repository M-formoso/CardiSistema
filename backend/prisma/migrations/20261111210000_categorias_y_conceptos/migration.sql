-- ============================================================
-- Migración v3: CategoriaEmpleado + LiquidacionItemConcepto
-- Cambios tras cruzar las planillas reales de Cardi:
-- - Categorías de empleado (Oficial Capataz, Oficial, Medio Oficial,
--   Ayudante, etc.) con jornal/hora extra de referencia y actualización
--   masiva (propaga a empleados).
-- - Recibo = persona + N conceptos tipados (JORNAL / HS_EXTRA / VIATICO /
--   VACACIONES / CERTIFICACION / SUELDO / PRESTAMO_ENTREGADO /
--   PRESTAMO_APLICACION / DEDUCCION / VALE / NOTA_SALDO).
-- - LiquidacionItem se simplifica: solo subtotal / aPagar / estado;
--   todo lo demás se deriva de los conceptos.
--
-- Toda la migración es idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ENUM TipoConceptoLiquidacion
-- ------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "TipoConceptoLiquidacion" AS ENUM (
    'JORNAL',
    'JORNAL_ESPECIAL',
    'HORAS_EXTRA',
    'VIATICO',
    'VACACIONES',
    'CERTIFICACION',
    'SUELDO',
    'PRESTAMO_ENTREGADO',
    'PRESTAMO_APLICACION',
    'DEDUCCION',
    'VALE',
    'NOTA_SALDO'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------
-- 2. CategoriaEmpleado + CategoriaEmpleadoHistorico
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "CategoriaEmpleado" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "jornal" DECIMAL(14,2),
    "valorHoraExtra" DECIMAL(14,2),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CategoriaEmpleado_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CategoriaEmpleado_codigo_key" ON "CategoriaEmpleado"("codigo");
CREATE INDEX IF NOT EXISTS "CategoriaEmpleado_activo_idx" ON "CategoriaEmpleado"("activo");

DO $$ BEGIN
  ALTER TABLE "CategoriaEmpleado" ADD CONSTRAINT "CategoriaEmpleado_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CategoriaEmpleado" ADD CONSTRAINT "CategoriaEmpleado_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "CategoriaEmpleadoHistorico" (
    "id" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "jornal" DECIMAL(14,2) NOT NULL,
    "valorHoraExtra" DECIMAL(14,2),
    "vigenteDesde" DATE NOT NULL,
    "motivo" TEXT,
    "empleadosAfectados" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CategoriaEmpleadoHistorico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CategoriaEmpleadoHistorico_categoriaId_vigenteDesde_idx"
    ON "CategoriaEmpleadoHistorico"("categoriaId", "vigenteDesde");

DO $$ BEGIN
  ALTER TABLE "CategoriaEmpleadoHistorico" ADD CONSTRAINT "CategoriaEmpleadoHistorico_categoriaId_fkey"
    FOREIGN KEY ("categoriaId") REFERENCES "CategoriaEmpleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CategoriaEmpleadoHistorico" ADD CONSTRAINT "CategoriaEmpleadoHistorico_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------
-- 3. EmpleadoLegajo.categoriaId (FK a CategoriaEmpleado)
-- ------------------------------------------------------------

ALTER TABLE "EmpleadoLegajo" ADD COLUMN IF NOT EXISTS "categoriaId" TEXT;

CREATE INDEX IF NOT EXISTS "EmpleadoLegajo_categoriaId_idx" ON "EmpleadoLegajo"("categoriaId");

DO $$ BEGIN
  ALTER TABLE "EmpleadoLegajo" ADD CONSTRAINT "EmpleadoLegajo_categoriaId_fkey"
    FOREIGN KEY ("categoriaId") REFERENCES "CategoriaEmpleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------
-- 4. LiquidacionItemConcepto
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "LiquidacionItemConcepto" (
    "id" TEXT NOT NULL,
    "liquidacionItemId" TEXT NOT NULL,
    "tipo" "TipoConceptoLiquidacion" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(10,3),
    "valorUnitario" DECIMAL(14,2),
    "monto" DECIMAL(14,2) NOT NULL,
    "obraId" TEXT,
    "prestamoId" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiquidacionItemConcepto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LiquidacionItemConcepto_liquidacionItemId_orden_idx"
    ON "LiquidacionItemConcepto"("liquidacionItemId", "orden");
CREATE INDEX IF NOT EXISTS "LiquidacionItemConcepto_obraId_idx" ON "LiquidacionItemConcepto"("obraId");
CREATE INDEX IF NOT EXISTS "LiquidacionItemConcepto_prestamoId_idx" ON "LiquidacionItemConcepto"("prestamoId");
CREATE INDEX IF NOT EXISTS "LiquidacionItemConcepto_tipo_idx" ON "LiquidacionItemConcepto"("tipo");

DO $$ BEGIN
  ALTER TABLE "LiquidacionItemConcepto" ADD CONSTRAINT "LiquidacionItemConcepto_liquidacionItemId_fkey"
    FOREIGN KEY ("liquidacionItemId") REFERENCES "LiquidacionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "LiquidacionItemConcepto" ADD CONSTRAINT "LiquidacionItemConcepto_obraId_fkey"
    FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "LiquidacionItemConcepto" ADD CONSTRAINT "LiquidacionItemConcepto_prestamoId_fkey"
    FOREIGN KEY ("prestamoId") REFERENCES "PrestamoEmpleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------
-- 5. Quitar columnas redundantes de LiquidacionItem
-- Los montos ahora se derivan de los conceptos.
-- Columnas eliminadas: diasTrabajados, valorDia, horasExtras,
-- valorHoraExtra, descuentos, prestamosAplicados.
-- Mantenemos: subtotal, aPagar, pagado, fechaPago, observaciones.
-- ------------------------------------------------------------

ALTER TABLE "LiquidacionItem" DROP COLUMN IF EXISTS "diasTrabajados";
ALTER TABLE "LiquidacionItem" DROP COLUMN IF EXISTS "valorDia";
ALTER TABLE "LiquidacionItem" DROP COLUMN IF EXISTS "horasExtras";
ALTER TABLE "LiquidacionItem" DROP COLUMN IF EXISTS "valorHoraExtra";
ALTER TABLE "LiquidacionItem" DROP COLUMN IF EXISTS "descuentos";
ALTER TABLE "LiquidacionItem" DROP COLUMN IF EXISTS "prestamosAplicados";
