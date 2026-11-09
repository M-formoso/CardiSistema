# Sistema Cardi

Sistema de gestión de gastos por obra para **Cardi**, desarrollado a medida por **DevelopNet**.

> Fuente de verdad técnica: [`CLAUDE.md`](./CLAUDE.md). Propuesta y relevamiento del cliente en [`docs/`](./docs).

## Stack

- **Backend**: NestJS 10 + Prisma 5 + PostgreSQL 15 + Zod + decimal.js + pino.
- **Frontend**: React 19 + Vite 6 + Tailwind + shadcn/ui + TanStack Query + Zustand.
- **Shared**: `packages/shared` con schemas Zod, enums, y helpers de dinero (decimal.js).
- **Monorepo**: pnpm workspaces + Turborepo.
- **Infra**: Docker Compose para Postgres local. Railway para staging/producción.

## Estructura

```
sistemaCardi/
├── backend/            # NestJS + Prisma
├── frontend/           # React + Vite + Tailwind
├── packages/shared/    # Zod schemas + money.ts + enums
├── migracion/          # Planillas del cliente (originales/ está fuera de git)
├── docs/               # Propuesta, relevamiento, SDD
├── assets/brand/       # Logo + design tokens Cardi
├── .claude/            # Skills, commands y reglas para Claude Code
├── CLAUDE.md
├── docker-compose.yml
├── railway.toml
├── pnpm-workspace.yaml
└── turbo.json
```

## Setup local

Requisitos: **Node 20 LTS**, **pnpm 10**, y una **PostgreSQL 15** corriendo en local (Docker recomendado; alternativas abajo).

```bash
# 1. Instalar dependencias
pnpm install

# 2. Copiar .env
cp .env.example .env
# Editar: JWT_SECRET (openssl rand -base64 48), ADMIN_PASSWORD, etc.

# 3. Levantar Postgres (ver "Postgres local" más abajo)
docker compose up -d

# 4. Migrar + sembrar la base
pnpm db:migrate
pnpm db:seed

# 5. Arrancar backend + frontend
pnpm dev
```

- Backend: `http://localhost:3000/api/v1`
- Frontend: `http://localhost:5173`

### Postgres local

**Opción A — Docker (recomendado)**:
```bash
docker compose up -d
```

**Opción B — Postgres nativo (si no tenés Docker)**:
```bash
brew install postgresql@15
brew services start postgresql@15
createuser -s cardi && createdb -O cardi cardi
# Setear en .env:
#   DATABASE_URL="postgresql://cardi@localhost:5432/cardi?schema=public"
```

**Opción C — Postgres remoto** (ej. Railway dev DB):
Setear `DATABASE_URL` en `.env` con la URL remota.

## Comandos

```bash
pnpm dev              # backend + frontend en paralelo
pnpm build            # build de todos los paquetes
pnpm test             # tests (incluye packages/shared/money)
pnpm lint             # eslint de todo
pnpm type-check       # type-check de todo
pnpm format           # prettier --write

pnpm db:migrate       # prisma migrate dev (solo local)
pnpm db:seed          # admin + obras + categorías + cajas
pnpm db:studio        # Prisma Studio en localhost

pnpm migracion -- --lote <archivo.xlsx> --dry-run
```

## Branding

Identidad visual del cliente en [`assets/brand/`](./assets/brand). Color primario: **`#4390B6`**. En la UI, documentos y recibos la empresa se nombra solo como **"Cardi"** (ver `CLAUDE.md` §1).

## Entornos y despliegue

| Rama      | Entorno     | URL              |
|-----------|-------------|------------------|
| `develop` | Staging     | Railway staging  |
| `main`    | Producción  | Railway prod     |

Reglas de Git y migraciones en [`.claude/GIT_RULES.md`](./.claude/GIT_RULES.md) y [`.claude/MIGRATIONS_RULES.md`](./.claude/MIGRATIONS_RULES.md). **Nunca push/merge a `main` sin OK de Mateo.**

## Datos del cliente

Las planillas de Cardi viven en `migracion/originales/` y están **fuera de git** (ver `.gitignore`). Nunca commitear archivos con datos reales.

## Deadline

**2 de enero de 2027** — uso pleno del sistema con la migración de 2026 completa.
