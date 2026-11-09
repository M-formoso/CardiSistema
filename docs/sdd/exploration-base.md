# Exploración de proyectos base — Sistema Cardi

> Resultado de la Fase 1 del `inicial.md`: qué se reutiliza de los proyectos de referencia, qué se adapta y qué se descarta.
> Fecha: 2026-11-09.

## Proyectos auditados

| Proyecto | Ruta | Rol |
|---|---|---|
| **sistemaCocGuana** | `/Volumes/discoExt/TRABAJO/FREELANCER/sistemaCocGuana/backend` | Patrón del dominio financiero (billetera multimoneda, cotización, cheques). |
| **sistemaDistrito** | `/Volumes/discoExt/TRABAJO/FREELANCER/sistemaDistrito/backend` | Patrón de liquidación semanal con obra por día + AuditLog. |
| **NachoMaquinaria** | `/Volumes/discoExt/TRABAJO/FREELANCER/NachoMaquinaria/{backend,frontend}` | Esqueleto single-tenant: auth, Prisma, React/Vite/Tailwind/shadcn, Railway. |
| **DevelopNet/codigo_fuente** | `/Volumes/discoExt/TRABAJO/DevelopNet/codigo_fuente/.claude` | Skills, MIGRATIONS_RULES, GIT_RULES. |
| **AgroFacil** | `/Volumes/discoExt/TRABAJO/AgroFacil/.claude/commands` | Slash commands (crear-crud-completo, crear-modulo-*, etc.). |

## Resumen ejecutivo

- El **motor financiero** sale de **Cocoguana**: service de tesorería ya resuelto (`registrarMovimiento`, `anularMovimiento` con reversa en `$transaction`, `transferir`, `cambio`), cheques con máquina de estados, cotizaciones con cron diario + fallback.
- La **liquidación semanal con obra por día** sale de **Distrito**: `LiquidacionSemanal` → `Item` → `Dia` modela exactamente el bloque 04 de Cardi. Incluye `nombreLibre` para matcheo durante la migración.
- El **esqueleto full-stack** (NestJS + Prisma + React/Vite + Tailwind + shadcn + Railway + auth JWT con rotación) sale de **NachoMaquinaria**.
- Los **tooling** (skills + commands + rules) se copian de DevelopNet y AgroFacil.

---

## 1. Cocoguana — motor financiero

**Reutilizar tal cual (adaptando nombres)**:
- `backend/src/tesoreria/tesoreria.service.ts` (67 KB) — método `registrarMovimiento` con cotización congelada, `anularMovimiento` que crea REVERSA en `prisma.$transaction`, `transferir` entre cajas, `crearMovimientoCompuesto`.
- `backend/src/cheques/cheques.service.ts` — `cambiarEstado` con `assertTransition()` sobre máquina de estados.
- `backend/src/cotizaciones/cotizaciones.service.ts` — consulta a `mercados.ambito.com`, caching 15 min, `@Cron(EVERY_DAY_AT_MIDNIGHT)` para snapshot diario en `CotizacionHistorica`, fallback a cache o `ServiceUnavailableException`.
- `backend/src/common/state-machines.ts` — helper de transiciones válidas (sirve también para estados de cheques, obligaciones, liquidaciones).
- `backend/src/auth/` — `JwtAuthGuard`, `ModulosGuard` (`@RequiereModulo`), `PermisoGuard` (`@RequierePermiso`) con enum `Permisos` y tabla rol→permisos.

**Adaptar**:
- Agregar fuente de dólar `dolarapi.com` como primaria (actualmente usa solo Ámbito). Mantener Ámbito como respaldo. Agregar `argentinadatos.com` para histórico durante la migración (Cardi necesita cotización del día de cada movimiento viejo).
- Agregar medio de pago `CHEQUE_PROPIO` / `CHEQUE_TERCERO` explícitos (Cocoguana tiene solo `CHEQUE`). Nuestro `CLAUDE.md` los separa.
- Agregar tabla `imputaciones` (movimiento → obra × N). Cocoguana imputa 1 obra directa; nosotros necesitamos reparto entre varias obras.
- Convención de naming: Cocoguana usa **camelCase sin `@@map`**. Nuestro `CLAUDE.md` pide snake_case con `@@map`. **Decisión abierta** (ver §6).

**Descartar** (específico de Cocoguana):
- `src/alojamiento/`, `src/calendario/`, `src/turismo-estudiantil/`, `src/eventos/`, `src/egresados/` — turismo estudiantil.
- `src/compras/`, `src/inventario/`, `src/ipc/`, `src/contratos/`, `src/presupuestos/` — stock y comisiones de vendedor.
- Modelos de ese dominio: `Reserva`, `Contrato`, `Presupuesto`, `Stock`, `Compra`.

## 2. Distrito — liquidación semanal

**Reutilizar tal cual**:
- Schema `LiquidacionSemanal` + `LiquidacionSemanalItem` + `LiquidacionSemanalDia` (líneas 1140–1217 de `prisma/schema.prisma`). Flujo BORRADOR → APROBADA → PAGADA → CERRADA. Soporta **obra por día** (`Dia.obraId`), que es lo que pide Cardi.
- Campo `nombreLibre` en `Item` — para la migración desde Excel (matcheo fuzzy).
- Modelo `Vale` — adelantos/descuentos deducibles (relevamiento Cardi, decisión abierta #5).
- `src/modules/liquidaciones/` — service con `upsertItem`, `marcarItemPagado`.
- `src/modules/auditoria/` — `AuditLog` + `AuditoriaService.registrar()` fire-and-forget. **No tiene interceptor automático**, se llama a mano en puntos sensibles.
- `scripts/import-xlsx.ts` — `normalizar()` para fuzzy matching de nombres en la migración.

**Adaptar**:
- Renombrar `Trabajador` → `Beneficiario` (tipo `EMPLEADO`) con relación 1:1 a `empleado_legajos` (nuestro CLAUDE.md unifica beneficiarios en una sola tabla con tipo).
- Al confirmar el pago de la liquidación: generar los **egresos** en `movimientos` con `origen = LIQUIDACION` + imputaciones proporcionales a días por obra + recibo por empleado. Todo en una sola `prisma.$transaction`.

**No existe en Distrito** (crear desde cero):
- Export PDF de recibos (usar `pdfkit`, ya en package del proyecto que vamos a crear).
- Export Excel de reportes (`exceljs`).

## 3. NachoMaquinaria — esqueleto

**Reutilizar tal cual (copiar y renombrar)**:
- `backend/src/main.ts` + `app.module.ts` + `config/configuration.ts` — bootstrap con pino, CORS, throttler global, JWT guard global.
- `backend/src/common/guards/` — `JwtAuthGuard`, `RolesGuard`.
- `backend/src/common/decorators/` — `@Public()`, `@Roles(...)`.
- `backend/src/modules/auth/` — login + refresh con rotación (opaco 48-byte hex, SHA256 en BD) + logout + change password. JWT access 30 min, refresh 7 días.
- `backend/src/prisma/` — `PrismaModule` + `PrismaService`.
- Logger pino global con redact de passwords y auth headers.
- `frontend/src/lib/apiClient.ts` — axios con interceptor de refresh loop.
- `frontend/src/stores/authStore.ts` — Zustand + persist.
- `frontend/src/components/layout/` — `AppLayout`, `Sidebar` colapsable, `Topbar`, `RutaProtegida`.
- `frontend/src/pages/LoginPage.tsx` — adaptar branding.
- `frontend/tailwind.config.js` — estructura; reemplazar colores por paleta Cardi (`#4390B6`).
- `frontend/vite.config.ts`, `components.json` (shadcn).
- `docker-compose.yml`, `railway.toml` raíz/backend/frontend, `.env.example`.

**Adaptar**:
- **Convertir a monorepo pnpm + Turborepo**: NachoMaquinaria tiene backend y frontend como proyectos sueltos. Nosotros necesitamos `pnpm-workspace.yaml` + `turbo.json` + `packages/shared/` (Zod + `money.ts` con decimal.js + enums compartidos, según `CLAUDE.md` §3 y §6).
- Roles: NachoMaquinaria tiene `EMPLEADO` / `ADMIN` con `modulosPermitidos: string[]`. Nosotros usamos **`ADMIN` / `CARGA` / `CONSULTA`** + tabla `usuario_permisos` para permisos granulares (ej. `empleados.datos_sensibles`). Tomamos el patrón de permisos de Cocoguana (`PermisoGuard` + enum `Permisos`), no el de NachoMaquinaria.
- `AuditLog`: NachoMaquinaria **no lo tiene**. Lo tomamos del patrón de Distrito.
- Reemplazar paleta dorada (`#E5B93B`) de NachoMaquinaria por paleta Cardi (`assets/brand/brand.md`).

**Descartar**:
- Módulos de dominio: `maquinas`, `alquileres`, `proyectos`, `combustible`, `controles`, `bitacoras`, `checklists`, `jornadas`, `tesoreria` (el de NachoMaquinaria es rudimentario; usamos el de Cocoguana).
- Seed inicial con máquinas y usuario Ignacio.
- Páginas específicas de maquinaria.

## 4. Tooling .claude (DevelopNet + AgroFacil)

**Copiados a `.claude/skills/`**: `_shared`, `entrega-completa`, `systematic-debugging`, `tdd`, `verification-protocol`, `brainstorming`, `code-review`, `client-data-migration`, `sdd-explore`, `sdd-propose`, `sdd-design`, `sdd-tasks`, `sdd-apply`, `sdd-verify`, `sdd-orchestrator`, `parallel-agents`, `frontend-design`, `backend-dev.md`, `database-architect.md`, `frontend-dev.md`, `simplify.md`.

**Copiados a `.claude/commands/`**: `crear-crud-completo`, `crear-modulo-backend`, `crear-modulo-frontend`, `crear-migracion`, `crear-test`, `revisar-codigo`.

**Copiados a `.claude/`**: `GIT_RULES.md` + `MIGRATIONS_RULES.md` (ambos adaptados al monorepo Cardi) + `settings.json` con `"model": "opus"` y plugin `agent-skills@addy-agent-skills`.

**Excluidos intencionalmente** (específicos de DevelopNet multi-tenant): `developnet-identidad-visual`, `client-onboarding`, `client-go-live`, `client-followup`, `engram`, `memory-protocol`, `client-integrations`, `enterprise-patterns.md`, `Model selection.skill.md`.

**Pendiente**: revisar los commands de AgroFacil para quitar referencias a `cuentaId` / multi-tenant. Se ajusta antes del primer uso real.

## 5. Stack final confirmado

Igual al `CLAUDE.md` §3. Versiones a adoptar (tomadas de los refs):

- **Backend**: NestJS ^10.4, Prisma ^5.22, nestjs-zod ^5.4, zod ^3.23, @nestjs/jwt ^11, @nestjs/schedule ^6.1, @nestjs/throttler ^6.5, pino ^10 + nestjs-pino ^4.6, decimal.js ^10.6, bcrypt ^6, pdfkit ^0.19, exceljs ^4.4, multer, Jest + Supertest.
- **Frontend**: React ^19.1 (no 18 como dice el `CLAUDE.md` — propongo bumpar porque los tres proyectos de referencia ya usan 19), Vite ^6, Tailwind ^3.4, @tanstack/react-query ^5.1, @tanstack/react-table ^8.2, zustand ^5, react-router-dom ^7, react-hook-form ^7.8, zod, axios, sonner, date-fns, lucide-react, recharts.
- **Infra**: Docker Compose (Postgres 15-alpine), Railway (dos entornos), pnpm workspaces + Turborepo.

## 6. Preguntas que quedan abiertas (para resolver con Mateo)

1. **Convención de naming en Prisma**: `CLAUDE.md` §4 pide snake_case en DB con `@@map`/`@map` a camelCase. Cocoguana usa camelCase directo (sin `@@map`). Distrito también. ¿Mantenemos snake_case (más limpio para `psql` y migración desde Excel) o adoptamos camelCase para alinear con los refs y evitar overhead? **Recomiendo camelCase sin `@@map`** — es lo que usan los tres refs y no aporta valor traducir.
2. **React 18 vs 19**: `CLAUDE.md` dice React 18. Los tres refs (los más recientes) usan React 19. ¿Bumpamos a 19?
3. **Skills adicionales**: ¿agregamos `backend-dev`, `database-architect`, `frontend-dev`, `simplify`, `parallel-agents`, `frontend-design` que no estaban en `inicial.md` pero están en DevelopNet? Los copié provisoriamente.

Estas tres se resuelven en un minuto con un "sí" / "no" antes de arrancar la Etapa 0.
