-- Agrega el campo cantidadCuotas al PrestamoEmpleado.
-- Es opcional: si el usuario cargó el préstamo con una cantidad de cuotas
-- semanales (ej. 4), el frontend sugiere monto/cantidadCuotas como cuota
-- en la certificación siguiente. Si es null, se decide a mano cada semana.

ALTER TABLE "PrestamoEmpleado" ADD COLUMN IF NOT EXISTS "cantidadCuotas" INTEGER;
