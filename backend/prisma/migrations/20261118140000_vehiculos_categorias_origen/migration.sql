-- Reunión Dani 18/11/2026: cambios de modelo para el flujo nuevo de egresos
-- (tipo + vehículos + origen de ingresos).
--
-- 1) Nuevo valor del enum TipoBeneficiario: EMPRESA_PAGADORA (origen de un
--    ingreso o cheque recibido, ej: Grupo Fonte, Astori). Separa a Dani
--    "quién me pagó" de los empleados.
-- 2) Nuevo enum TipoCategoria para filtrar categorías de gasto según el
--    tipo de egreso (Servicio / Proveedor / etc.).
-- 3) Agrega a CategoriaGasto: tipo (default GENERAL) y vinculadaVehiculo
--    (default false). vinculadaVehiculo solo aplica a tipo=SERVICIO y
--    habilita la nómina de vehículos en el egreso.
-- 4) Crea Vehiculo y MovimientoVehiculo (N:N con monto por vehículo).
--
-- Idempotente.

ALTER TYPE "TipoBeneficiario" ADD VALUE IF NOT EXISTS 'EMPRESA_PAGADORA';

DO $$ BEGIN
    CREATE TYPE "TipoCategoria" AS ENUM ('INGRESO', 'SERVICIO', 'PROVEEDOR', 'EMPLEADO', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "CategoriaGasto"
    ADD COLUMN IF NOT EXISTS "tipo" "TipoCategoria" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "CategoriaGasto"
    ADD COLUMN IF NOT EXISTS "vinculadaVehiculo" BOOLEAN NOT NULL DEFAULT false;

-- Vehiculo
CREATE TABLE IF NOT EXISTS "Vehiculo" (
    "id"            TEXT NOT NULL,
    "nombre"        TEXT NOT NULL,
    "modelo"        TEXT,
    "patente"       TEXT NOT NULL,
    "observaciones" TEXT,
    "activo"        BOOLEAN NOT NULL DEFAULT true,
    "createdById"   TEXT,
    "updatedById"   TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Vehiculo_patente_key" ON "Vehiculo"("patente");
CREATE INDEX IF NOT EXISTS "Vehiculo_activo_idx" ON "Vehiculo"("activo");

DO $$ BEGIN
    ALTER TABLE "Vehiculo"
        ADD CONSTRAINT "Vehiculo_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Vehiculo"
        ADD CONSTRAINT "Vehiculo_updatedById_fkey"
        FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MovimientoVehiculo (imputación N:N movimiento-vehículo)
CREATE TABLE IF NOT EXISTS "MovimientoVehiculo" (
    "id"           TEXT NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "vehiculoId"   TEXT NOT NULL,
    "monto"        DECIMAL(14, 2) NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoVehiculo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MovimientoVehiculo_movimientoId_vehiculoId_key"
    ON "MovimientoVehiculo"("movimientoId", "vehiculoId");
CREATE INDEX IF NOT EXISTS "MovimientoVehiculo_vehiculoId_idx"
    ON "MovimientoVehiculo"("vehiculoId");

DO $$ BEGIN
    ALTER TABLE "MovimientoVehiculo"
        ADD CONSTRAINT "MovimientoVehiculo_movimientoId_fkey"
        FOREIGN KEY ("movimientoId") REFERENCES "Movimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MovimientoVehiculo"
        ADD CONSTRAINT "MovimientoVehiculo_vehiculoId_fkey"
        FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
