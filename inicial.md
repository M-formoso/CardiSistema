# INICIAL — Prompt de arranque para Claude Code (Sistema Cardi)

> Pegá esto en Claude Code parado en `/Volumes/discoExt/TRABAJO/FREELANCER/sistemaCardi`.

---

Vamos a arrancar el **Sistema de gestión de gastos por obra para Cardi**, un desarrollo a medida de DevelopNet.

**Antes de escribir una sola línea de código:**

1. Leé completo `CLAUDE.md`: es la fuente de verdad técnica (alcance, stack, modelo de datos, reglas de negocio, proceso). Después leé `docs/Propuesta-DevelopNet-Cardi.pdf` (alcance aprobado) y `docs/Relevamiento-DevelopNet-Cardi.pdf` (datos y decisiones pendientes).

2. Revisá los proyectos de referencia y anotá en `docs/sdd/exploration-base.md` qué se reutiliza tal cual, qué se adapta y qué se descarta. Copiá patrones, no funcionalidad:
   - `/Volumes/discoExt/TRABAJO/FREELANCER/sistemaCocGuana/backend`: `prisma/schema.prisma` (Caja, MovimientoTesoreria con cotización congelada y reversa, Cheque, CategoriaEgreso, UEN, Obligacion/Aplicacion, CotizacionHistorica) y `src/tesoreria`, `src/cheques`, `src/cotizaciones`.
   - `/Volumes/discoExt/TRABAJO/FREELANCER/sistemaDistrito/backend`: `LiquidacionSemanal` / `Item` / `Dia` (obra por día), `AuditLog`, export PDF y Excel.
   - `/Volumes/discoExt/TRABAJO/FREELANCER/NachoMaquinaria`: esqueleto single-tenant (auth, guards, estructura de módulos, frontend, Railway).
   - `/Volumes/discoExt/TRABAJO/DevelopNet/codigo_fuente`: `.claude/MIGRATIONS_RULES.md`, `.claude/GIT_RULES.md` y `.claude/skills/`.

3. Prepará el tooling de Claude del proyecto:
   - Copiá a `.claude/skills/` desde `DevelopNet/codigo_fuente/.claude/skills/`: `entrega-completa`, `systematic-debugging`, `tdd`, `verification-protocol`, `brainstorming`, `code-review`, `client-data-migration`, `sdd-explore`, `sdd-propose`, `sdd-design`, `sdd-tasks`, `sdd-apply`, `sdd-verify`, `sdd-orchestrator` y `_shared`. Adaptá las referencias a DevelopNet (multi-tenant, `billing-service`, identidad visual DevelopNet, Engram) a este proyecto. **No copies** `developnet-identidad-visual`, `client-onboarding`, `client-go-live`, `client-followup`, `engram` ni `memory-protocol`.
   - Copiá `MIGRATIONS_RULES.md` y `GIT_RULES.md` a `.claude/`, adaptando rutas, nombres de servicio y el remoto de git de este proyecto.
   - Copiá los commands de `/Volumes/discoExt/TRABAJO/AgroFacil/.claude/commands/` (`crear-crud-completo`, `crear-modulo-backend`, `crear-modulo-frontend`, `crear-migracion`, `crear-test`, `revisar-codigo`) a `.claude/commands/`, sacando todo lo de multi-tenant (`cuentaId`) y lo agro, y alineándolos a las convenciones de `CLAUDE.md`.
   - Creá `.claude/settings.json` con `"model": "opus"` y el plugin `agent-skills@addy-agent-skills` habilitado, igual que en DevelopNet.

4. Mostrame un resumen corto de lo que encontraste, lo que reutilizás y el plan de la Etapa 0. **Esperá mi OK antes de generar código.**

**Después de mi OK, Etapa 0 (setup), en este orden:**

1. Monorepo pnpm + Turborepo con `backend/` (NestJS 10 + Prisma 5), `frontend/` (React + Vite + Tailwind + shadcn) y `packages/shared/` (Zod + `money.ts` con decimal.js y sus tests).
2. `docker-compose.yml` con Postgres 15, `.env.example` documentado, `railway.toml`, `README.md`.
3. `schema.prisma` completo según la sección 4 de `CLAUDE.md` y la **migración inicial**, idempotente. Revisalo conmigo antes de aplicarlo: es la base de todo y cambiarlo después cuesta.
4. Auth (login, refresh con rotación, logout), usuarios, roles `ADMIN` / `CARGA` / `CONSULTA`, `PermissionsGuard` y `audit_logs`.
5. Seed: usuario admin, obras conocidas (General Paz, Mont Petit, Rialto, Doma, Bower, Galpones Brasil y la obra `GENERAL` "Gastos generales"), categorías iniciales y cajas ARS/USD de ejemplo. Marcá en el seed que son datos provisorios hasta recibir el relevamiento.
6. Layout del frontend (sidebar, topbar, login) con theme neutro, sin emojis y listo para aplicar la identidad de Cardi cuando llegue a `assets/`.
7. Build, type-check, lint y tests en verde. Commit y push a `develop`. Después avisame para configurar el entorno de staging en Railway (preguntá antes de tocar infraestructura).

**Después, Etapa 2 (primera versión navegable, semana 1):** obras, beneficiarios, categorías, cajas, cotización automática del blue (snapshot diario + consulta al momento + fallback manual), ingresos, egresos con imputación a una o varias obras, transferencias y cambio USD→ARS. Usá SDD para la billetera (`docs/sdd/`): es el núcleo y todo lo demás genera movimientos sobre ella.

**Reglas que aplican siempre:**
- Skill `entrega-completa`: cada entrega funciona de punta a punta, sin TODO, mocks ni botones muertos.
- Nada fuera del alcance de los 9 bloques. Si algo te parece útil y no está, anotalo como sugerencia y no lo hagas.
- Plata siempre con decimal.js y `Decimal` en la base. Nunca `number`.
- Toda la UI en español de Argentina, formato `dd/MM/yyyy` y montos en ARS y USD.
- Nunca push ni merge a `main` sin mi OK explícito.
- Un paso por vez y mensajes cortos. Si una duda cambia el resultado, preguntá antes de seguir.
- Las decisiones abiertas de la sección 10 de `CLAUDE.md` no se inventan: usá el valor por defecto propuesto, dejalo configurable y anotalo.
