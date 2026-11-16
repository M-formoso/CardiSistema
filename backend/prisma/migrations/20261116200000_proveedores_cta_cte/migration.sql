-- Módulo Proveedores + Cuenta corriente (#9 del backlog, reunión 16/11).
-- Dos tablas nuevas para guardar la "foto" del estado de cuenta que cada
-- proveedor manda cada tanto. El saldo = último resumen - pagos posteriores
-- se calcula en el service (los pagos ya viven en Movimiento).
--
-- Idempotente: se puede correr dos veces sin romper.

-- ProveedorResumen
CREATE TABLE IF NOT EXISTS "ProveedorResumen" (
    "id"            TEXT NOT NULL,
    "proveedorId"   TEXT NOT NULL,
    "fecha"         DATE NOT NULL,
    "montoTotal"    DECIMAL(14, 2) NOT NULL,
    "observaciones" TEXT,
    "createdById"   TEXT,
    "updatedById"   TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProveedorResumen_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProveedorResumen_proveedorId_fecha_key"
    ON "ProveedorResumen"("proveedorId", "fecha");
CREATE INDEX IF NOT EXISTS "ProveedorResumen_proveedorId_fecha_idx"
    ON "ProveedorResumen"("proveedorId", "fecha");

-- ProveedorResumenItem
CREATE TABLE IF NOT EXISTS "ProveedorResumenItem" (
    "id"        TEXT NOT NULL,
    "resumenId" TEXT NOT NULL,
    "obraId"    TEXT NOT NULL,
    "monto"     DECIMAL(14, 2) NOT NULL,

    CONSTRAINT "ProveedorResumenItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProveedorResumenItem_resumenId_obraId_key"
    ON "ProveedorResumenItem"("resumenId", "obraId");
CREATE INDEX IF NOT EXISTS "ProveedorResumenItem_obraId_idx"
    ON "ProveedorResumenItem"("obraId");

-- Foreign keys (envueltas para no romper si ya existen de un intento previo)
DO $$ BEGIN
    ALTER TABLE "ProveedorResumen"
        ADD CONSTRAINT "ProveedorResumen_proveedorId_fkey"
        FOREIGN KEY ("proveedorId") REFERENCES "Beneficiario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ProveedorResumen"
        ADD CONSTRAINT "ProveedorResumen_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ProveedorResumen"
        ADD CONSTRAINT "ProveedorResumen_updatedById_fkey"
        FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ProveedorResumenItem"
        ADD CONSTRAINT "ProveedorResumenItem_resumenId_fkey"
        FOREIGN KEY ("resumenId") REFERENCES "ProveedorResumen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ProveedorResumenItem"
        ADD CONSTRAINT "ProveedorResumenItem_obraId_fkey"
        FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
