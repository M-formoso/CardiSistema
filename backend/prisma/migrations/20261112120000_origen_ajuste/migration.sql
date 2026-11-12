-- Agrega el valor AJUSTE al enum OrigenMovimiento.
-- Usado por los movimientos que se crean cuando se ajusta manualmente el
-- saldo de una caja desde la pantalla de Cuentas.

ALTER TYPE "OrigenMovimiento" ADD VALUE IF NOT EXISTS 'AJUSTE';
