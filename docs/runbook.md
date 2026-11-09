# Runbook — Sistema Cardi

> Operación, despliegue y recuperación. Se actualiza cada vez que se agrega una pieza nueva de infraestructura.

## Entornos

| Entorno | Rama | Proyecto Railway | DB |
|---|---|---|---|
| Local | — | — | Docker Postgres 15 (`docker-compose.yml`) |
| Staging | `develop` | `sistemaCardi (staging)` | Railway Postgres (plan hobby) |
| Producción | `main` | `sistemaCardi (prod)` | Railway Postgres (plan pro + backups) |

Las URLs de staging y producción se cargan acá cuando se configuren.

## Setup inicial local

Ver [README.md § Setup local](../README.md#setup-local).

## Despliegue

1. Push a `develop` → Railway staging se autodeploya.
2. Mateo prueba el cambio en staging.
3. Con OK de Mateo: merge `develop → main` y push → Railway prod se autodeploya.

Reglas estrictas en [`.claude/GIT_RULES.md`](../.claude/GIT_RULES.md) y [`.claude/MIGRATIONS_RULES.md`](../.claude/MIGRATIONS_RULES.md).

## Backups de Postgres

La propuesta a Cardi (bloque de mantenimiento) compromete **backups diarios**. Se implementa en dos capas:

1. **Backups automáticos de Railway** (habilitados en el plan pro de la DB de producción).
2. **`pg_dump` diario adicional** por cron (resguardo local/off-site).

Pendiente:
- [ ] Verificar que Railway tiene backups habilitados y cuántos días retiene.
- [ ] Armar el cron de `pg_dump` (opciones: GitHub Actions scheduled workflow, Railway cron service, o script local programado).
- [ ] Documentar aquí: frecuencia, retención, cómo restaurar.

## Restaurar un backup

TBD al armar el cron.

## Cotización del dólar — healthcheck

El cron diario de snapshot (`cotizaciones.service.ts`) corre a las 00:00 UTC (21:00 ARG). Si falla la API primaria (dolarapi), usa Ámbito como respaldo. Si ambas fallan, el sistema no bloquea movimientos: usa la última cotización del día anterior con aviso visible en la UI, o pide carga manual (requiere permiso).

**Si no hay cotización del día** en la UI o logs: revisar `logs/` del backend en Railway y validar las URLs del `.env`.

## Uploads

Archivos de comprobantes, cheques, certificaciones y migración se guardan en:
- Local: `backend/uploads/` (fuera de git).
- Railway: `/data/uploads/` (Volume montado, variable `UPLOADS_DIR`).

## Migración de 2026 (bloque 09)

Procedimiento detallado en `docs/sdd/` cuando se diseñe. Reglas base:
- Originales en `migracion/originales/` → **solo lectura**, fuera de git.
- Import siempre con `--dry-run` primero.
- Reimportar un lote nunca duplica (idempotente por `migracion_lotes` + `migracion_filas`).
- Validación contra totales que entrega Cardi (relevamiento §3.3).

## Incidentes y recetas

### P2022 / P3009 (migraciones Prisma)
Ver [`.claude/MIGRATIONS_RULES.md`](../.claude/MIGRATIONS_RULES.md) §5.

### Saldo negativo en una caja
No es incidente: está permitido con advertencia en UI (el efectivo real manda).
