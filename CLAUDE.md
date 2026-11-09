# Agent Instructions — Sistema Cardi

> Fuente de verdad técnica del proyecto. Leelo completo antes de escribir código. Si algo no está acá ni en las fuentes funcionales, **preguntá antes de inventar**. Este archivo se actualiza a medida que se cierran decisiones.

---

## 1. Contexto del proyecto

**Sistema de gestión de gastos por obra** desarrollado a medida por DevelopNet (Mateo Formoso) para **Cardi**.

- **Cliente**: Cardi. Una sola empresa: **NO es multi-tenant**. Decide Marcelo; el contacto operativo es Dani.
- **Regla de marca**: en UI, documentos y recibos se nombra solo como "Cardi". **No describir a la empresa por rubro** (se están abriendo a varios conceptos).
- **Problema**: varias obras en simultáneo, pagos en efectivo, transferencia, cheque y dólares. La info llega por papel, fotos y WhatsApp, se vuelca a mano en varios Excel, el mismo dato se carga varias veces, cada viernes se rehacen recibos y saber cuánto se gastó en una obra exige cruzar archivos.
- **Promesa central**: **una sola carga por movimiento** (monto, moneda, medio de pago, obra y beneficiario). El sistema toma el dólar blue del día, genera el recibo y deja el gasto imputado. Cualquier consulta sale con un filtro, siempre en pesos y en dólares.
- **Uso**: carga desde celular y escritorio. Consultas desde escritorio.
- **Fecha de uso pleno comprometida**: **2 de enero de 2027**.

### Fuentes de verdad funcional (por prioridad)
1. `docs/Propuesta-DevelopNet-Cardi.pdf`: alcance aprobado (9 bloques). Si algo no está ahí, **no se desarrolla** en esta versión.
2. `docs/Relevamiento-DevelopNet-Cardi.pdf`: datos que entrega el cliente y definiciones a cerrar (Fase 4).
3. Planillas del cliente en `migracion/originales/` (cuando lleguen). Reflejan la operación real: si contradicen una suposición de este archivo, ganan las planillas y se actualiza este archivo.

### Referencias arquitecturales (copiar patrones, no funcionalidad)

| Proyecto | Ruta | Qué se toma |
|---|---|---|
| **Mundo Cocoguana** | `/Volumes/discoExt/TRABAJO/FREELANCER/sistemaCocGuana` | **La base del dominio financiero.** `Caja` multimoneda, `MovimientoTesoreria` con cotización congelada (`cotizacionARS` + `FuenteCotizacion`), anulación por **reversa** (estado `CONFIRMADO/ANULADO/REVERSA`), `Cheque` con estados, `CategoriaEgreso`/`SubcategoriaEgreso`, `UEN`, `Obligacion`/`Aplicacion`, `ArqueoCaja`, `CotizacionHistorica` + servicio `cotizaciones` con cron diario, auditoría `createdById/updatedById`. |
| **Distrito (Jorge)** | `/Volumes/discoExt/TRABAJO/FREELANCER/sistemaDistrito` | `LiquidacionSemanal` → `Item` → `Dia` con **obra por día**, `nombreLibre` para matchear nombres del Excel durante la migración, `Trabajador`, `AuditLog`, exportación PDF (pdfkit) y Excel (exceljs). |
| **Nacho Maquinaria** | `/Volumes/discoExt/TRABAJO/FREELANCER/NachoMaquinaria` | Esqueleto single-tenant: auth JWT + refresh, guards de rol, estructura de módulos NestJS, frontend React/Vite/shadcn, formato argentino, deploy en Railway. |
| **DevelopNet** | `/Volumes/discoExt/TRABAJO/DevelopNet/codigo_fuente` | Reglas de proceso: `.claude/MIGRATIONS_RULES.md`, `.claude/GIT_RULES.md`, skills (`entrega-completa`, `systematic-debugging`, `tdd`, `verification-protocol`, `client-data-migration`, SDD). `packages/shared-*` como patrón para compartir Zod y calculadoras. |

Si un patrón de referencia contradice este documento, **manda este documento**. No arrastrar complejidad que Cardi no pidió (portal de clientes, vouchers, comisiones, retenciones, IPC, multi-tenant, etc.).

---

## 2. Alcance de la primera versión (9 bloques aprobados)

| # | Bloque | Qué incluye |
|---|---|---|
| 01 | **Base del sistema** | Usuarios con acceso propio y permisos. Obras y unidades de negocio (General Paz, Mont Petit, Rialto, Doma, Bower, galpones de Brasil y las que se sumen) con estado. Listados de empleados, contratistas, proveedores, profesionales y categorías de gasto. |
| 02 | **Billetera multimoneda** | Cajas/cuentas separadas por moneda (lo que pasa en USD no toca la caja en ARS). Ingresos a cualquier caja. Transferencias entre cajas y cambio USD→ARS con la cotización registrada. Medios: efectivo, transferencia, cheques propios y de terceros, dólares. Gestión de cheques (en cartera, emitidos, fechas de cobro, estado). **Dólar blue del día automático** en cada movimiento. |
| 03 | **Egresos imputados con una sola carga** | Fecha, monto, moneda, caja de origen, medio de pago, beneficiario y descripción. Imputación a una obra, **repartida entre varias** o como gasto general. Equivalente en USD de cada gasto; los pagos en USD descuentan directo de la caja en USD. |
| 04 | **Empleados y pagos semanales** | Liquidación semanal de varios empleados **en un solo paso**, indicando en qué obra trabajó cada uno. Legajo: fecha de ingreso, histórico cobrado, vacaciones pagadas. **Recibo automático** con la fecha del día, para imprimir o enviar. |
| 05 | **Contratistas y certificaciones** | Pagos a contratistas por proyecto según certificaciones de avance. Historial por contratista y obra. |
| 06 | **Proveedores y profesionales** | Pagos a proveedores imputados a obra, con historial. **Contratos en cuotas** con profesionales (ej. 4 cuotas en USD) y seguimiento de lo pagado. |
| 07 | **Compromisos y vencimientos** | Agenda de cuotas y vencimientos recurrentes con monto estimado. Proyección de pagos de los próximos días y semanas. |
| 08 | **Reportes y consultas** | Filtros por obra, contratista, empleado, proveedor, categoría y período, en ARS y USD. Gasto acumulado por obra **contra presupuesto/licitación** (cuánto se gastó, cuánto queda). Combustible y gastos operativos totalizados por obra. **Exportación a Excel** de cualquier listado. |
| 09 | **Migración de todo 2026** | Movimientos desde el 01/01/2026 a partir de las planillas. Unificación de nombres y descripciones. El sistema arranca con el año completo cargado. |

### Fuera de alcance (NO desarrollar)
Facturación electrónica / ARCA, conciliación bancaria, ingresos con origen y proyecto, rentabilidad por obra, tablero gerencial, flujo de fondos proyectado con alertas, circuitos de aprobación, stock, órdenes de compra, flota por vehículo, asistencia diaria, asistente IA / WhatsApp, gestión hotelera de Rialto. Son etapas futuras que se cotizan aparte.

**Pero el modelo tiene que dejarlas listas sin rehacer nada** (la propuesta lo promete): ingresos con `obraId` y `origen` opcionales, obras con monto contratado, auditoría de cambios desde el día 1, permisos granulares, patente opcional en cargas de combustible.

---

## 3. Stack tecnológico

Mismo stack que Nacho Maquinaria, Distrito y Cocoguana. No introducir librerías nuevas sin justificarlo.

### Backend
| Tecnología | Uso |
|---|---|
| Node.js 20 LTS + TypeScript 5 (strict) | Runtime y lenguaje |
| NestJS 10 | Framework HTTP |
| Prisma 5 + PostgreSQL 15 | ORM, migraciones, base de datos |
| nestjs-zod + zod | Validación de DTOs (schemas compartidos en `packages/shared`) |
| @nestjs/jwt + Passport + bcrypt | Auth (access 30 min, refresh 7 días con rotación) |
| @nestjs/schedule | Cron: snapshot diario del dólar, generación de compromisos recurrentes |
| @nestjs/throttler | Rate limit en `/auth` |
| decimal.js | **Toda** aritmética de dinero y cotizaciones. Nunca `number` para plata |
| pdfkit | Recibos en PDF |
| exceljs | Exportación a Excel y lectura de planillas en la migración |
| multer + Railway Volume (`/data/uploads`) | Comprobantes y adjuntos (certificaciones, fotos de cheques) |
| pino + nestjs-pino | Logging estructurado con `userId` |
| Jest + Supertest | Tests |

### Frontend
| Tecnología | Uso |
|---|---|
| React 19 + TypeScript + Vite | UI |
| Tailwind CSS + shadcn/ui + lucide-react | Estilos y componentes |
| TanStack Query | Data fetching / cache |
| TanStack Table | Listados con filtros, totales y export |
| React Hook Form + Zod | Formularios (mismos schemas que el backend) |
| Zustand | Sesión y UI ligera |
| React Router | Ruteo |
| Recharts | Gráficos de reportes |
| Sonner | Toasts |
| date-fns | Fechas |
| axios | Cliente HTTP |

### Infraestructura
- **Monorepo pnpm workspaces + Turborepo**: `backend/`, `frontend/`, `packages/shared/`.
- **Docker Compose** solo para Postgres local.
- **Railway**: backend + frontend + Postgres + Volume. Dos entornos: **staging** (rama `develop`) y **producción** (rama `main`).
- **Backups diarios** de Postgres (lo promete el mantenimiento): habilitar backups de Railway y además un `pg_dump` diario por cron. Documentar en `docs/runbook.md`.
- Sin Redis, sin colas, sin microservicios.

---

## 4. Modelo de datos

### Convenciones obligatorias
- `id` uuid, `createdAt`, `updatedAt` en todas las tablas (salvo logs).
- Auditoría: `createdById`, `updatedById` en toda entidad editable + tabla `AuditLog` con diff antes/después en cada create/update/anular.
- **Nunca borrar físicamente.** Maestros: `activo: boolean`. Movimientos: se **anulan** con reversa (patrón Cocoguana) y quedan visibles en la auditoría.
- Dinero: `Decimal(14,2)`. Cotización: `Decimal(14,4)`. Porcentajes: `Decimal(7,4)`.
- Fecha del movimiento: `Date` (día contable). Timestamps: `DateTime`. Zona horaria: `America/Argentina/Cordoba`.
- **Tablas y campos en camelCase**, sin `@@map`/`@map` (decisión 2026-11-09 alineada con Cocoguana y Distrito).
- Enums en mayúsculas.

### Entidades

**Base**
- `usuarios`: nombre, email, password_hash, rol (`ADMIN`, `CARGA`, `CONSULTA`), permisos extra (json o tabla `usuario_permisos`), activo. Permiso aparte `empleados.datos_sensibles` para ver CUIL y montos de legajo.
- `refresh_tokens`, `audit_logs` (usuario, acción, entidad, entidad_id, antes, después, ip, fecha).
- `configuracion_empresa`: razón social, CUIT, domicilio, contacto, logo (para recibos), cotización por defecto (`BLUE_COMPRA` | `BLUE_VENTA`), día de pago semanal.
- `obras`: nombre (exacto como lo usa Cardi), tipo (`OBRA` | `UNIDAD_NEGOCIO` | `GENERAL`), comitente/constructora, ubicación, fecha_inicio, estado (`EN_LICITACION`, `ACTIVA`, `PAUSADA`, `TERMINADA`), monto_contratado, moneda_contrato, activo. **"Gastos generales de la empresa" es una obra de tipo `GENERAL`**, así todo egreso tiene al menos una imputación.
- `beneficiarios`: **una sola tabla** para todos a quienes se les paga. tipo (`EMPLEADO`, `CONTRATISTA`, `PROVEEDOR`, `PROFESIONAL`, `OTRO`), nombre/razón social, cuit_cuil, rubro, contacto, condición de pago, activo. Permite filtrar "por beneficiario" sin uniones polimórficas.
  - `empleado_legajos` (1:1 con beneficiario `EMPLEADO`): fecha_ingreso, jornal o monto semanal, moneda, obra_actual_id, observaciones.
  - `beneficiario_alias`: nombres libres o apodos de las planillas → beneficiario (lo usa la migración y el autocompletado).
- `categorias_gasto`: código, nombre, orden, activo (jornales, contratistas, materiales, fletes, combustible, profesionales, impuestos, servicios, gastos generales, retiros, etc.). Subcategorías solo si las planillas lo piden.
- `concepto_alias`: diccionario texto-origen → categoría (ej. nombre de un fletero → "Fletes"). Es el "diccionario de conceptos" del relevamiento.

**Billetera**
- `cajas`: nombre, tipo (`EFECTIVO`, `BANCO`, `CHEQUES_TERCEROS`, `OTRO`), moneda (`ARS` | `USD`), saldo_inicial, fecha_saldo_inicial (01/01/2026), activo. **El saldo se deriva de los movimientos confirmados**. Si se cachea por performance, se actualiza en la misma transacción y hay un endpoint de verificación que lo recalcula.
- `cotizaciones_dolar`: fecha (Date), tipo (`BLUE`, `OFICIAL`), compra, venta, fuente (`DOLARAPI`, `AMBITO`, `ARGENTINADATOS`, `MANUAL`), `@@unique([fecha, tipo])`.
- `movimientos`: el **libro único** de la billetera.
  - tipo: `INGRESO`, `EGRESO`, `TRANSFERENCIA` (salida/entrada), `CAMBIO_MONEDA` (salida/entrada), `AJUSTE`.
  - fecha, caja_id, moneda (congelada, igual a la de la caja), monto (siempre positivo, el signo lo da el tipo).
  - medio_pago: `EFECTIVO`, `TRANSFERENCIA`, `CHEQUE_PROPIO`, `CHEQUE_TERCERO`.
  - cotizacion (ARS por 1 USD), cotizacion_tipo (`BLUE_COMPRA`, `BLUE_VENTA`, `MANUAL`, `PLANILLA`), monto_ars y monto_usd **calculados y congelados** al guardar.
  - beneficiario_id, categoria_id, descripcion.
  - cheque_id, recibo_id, grupo_id (une las patas de una transferencia o cambio, o los egresos de una liquidación).
  - origen: `MANUAL`, `LIQUIDACION`, `CERTIFICACION`, `CUOTA`, `COMPROMISO`, `MIGRACION`. Más origen_id.
  - obra_id opcional en ingresos (lo usa la etapa 2).
  - estado: `CONFIRMADO`, `ANULADO`, `REVERSA` + anulado_por_id, motivo_anulacion, movimiento_original_id.
  - migracion_fila_id (trazabilidad de la migración hasta archivo, hoja y fila).
- `imputaciones`: movimiento_id, obra_id, monto, porcentaje. **La suma de las imputaciones = monto del movimiento** (se valida en `packages/shared` y en el service).
- `cheques`: tipo (`PROPIO` | `TERCERO`), número, banco, librador o titular, cuit, monto, moneda, fecha_emision, fecha_pago, estado (`EN_CARTERA`, `ENTREGADO`, `DEPOSITADO`, `COBRADO`, `EMITIDO`, `DEBITADO`, `RECHAZADO`, `ANULADO`), beneficiario_id, imágenes opcionales.

**Personas y compromisos**
- `liquidaciones_semanales` → `liquidacion_items` (empleado, días, valor día o semanal, subtotal, descuentos, a pagar, caja, medio, pagado) → `liquidacion_dias` (fecha, días/fracción, **obra_id**). Al confirmar el pago se generan los egresos (`origen = LIQUIDACION`) imputados **proporcionalmente a los días por obra** y un recibo por empleado.
- `vacaciones`: empleado, desde, hasta, días, fecha de pago, movimiento_id.
- `certificaciones`: contratista, obra, número, fecha, descripción, monto, moneda, % avance opcional, adjunto. Saldo = monto − pagos aplicados. Los egresos con `origen = CERTIFICACION` se vinculan a la certificación.
- `contratos_cuotas` (profesionales): profesional, obra, concepto, monto_total, moneda, cantidad_cuotas → `cuotas` (número, monto, vencimiento, estado `PENDIENTE/PAGADA/ANULADA`, movimiento_id).
- `vencimientos_recurrentes`: concepto, obra, categoría, beneficiario, día del mes, monto estimado, moneda, caja habitual, activo. Un cron genera las instancias en `compromisos_pago` (fecha, monto_estimado, estado `PENDIENTE/PAGADO/OMITIDO`, movimiento_id).
- `recibos`: número correlativo, fecha, beneficiario, monto, moneda, concepto, pdf_path, generado_por.

**Migración**
- `migracion_lotes` (archivo, hoja, fecha de importación, estado) → `migracion_filas` (fila, datos crudos en JSON, estado `PENDIENTE`, `MAPEADA`, `OBSERVADA`, `DUPLICADA`, `IMPORTADA`, `DESCARTADA`, observación, movimiento_id).

---

## 5. Reglas de negocio

1. **Una sola carga**: el formulario de egreso pide fecha, monto, moneda (la de la caja), caja, medio, beneficiario, categoría, descripción e imputación. Todo lo demás (cotización, equivalente, recibo) lo resuelve el sistema.
2. **Moneda**: un movimiento siempre está en la moneda de su caja. Un pago en USD descuenta la caja USD. El equivalente en la otra moneda es informativo y se congela con la cotización del momento.
3. **Cotización**: al crear un movimiento se toma la del día (tipo según `configuracion_empresa`). Si no hay snapshot del día, se consulta la API. Si la API falla, se usa la última disponible con aviso visible, o carga manual. **Nunca bloquear la carga por la API del dólar.** Cambiar la cotización a mano requiere permiso y queda en auditoría.
4. **Fuentes del dólar**: primaria `dolarapi.com` (blue del día), respaldo Ámbito (reusar `cotizaciones.service.ts` de Cocoguana), histórico para la migración desde `argentinadatos.com`. Verificar los endpoints al implementar y dejarlos en `.env`.
5. **Transferencia entre cajas y cambio USD→ARS**: dos movimientos con el mismo `grupo_id`, creados en una `prisma.$transaction`. El cambio guarda la cotización pactada. Anular una pata anula el grupo.
6. **Imputación**: 1 obra (100%), varias obras (por monto o porcentaje, la suma tiene que cerrar exacto: el redondeo va a la última línea) o la obra `GENERAL`. No hay prorrateo automático de gastos generales en v1 (decisión abierta).
7. **Anular, nunca borrar**: anular crea la reversa, recalcula saldos y deja motivo y usuario. Editar un movimiento confirmado solo con rol `ADMIN`, con diff en `audit_logs`.
8. **Saldo negativo**: se permite con advertencia (el efectivo real manda). No bloquear.
9. **Cheques**: el de tercero entra a la caja `CHEQUES_TERCEROS` al recibirse y sale cuando se entrega como pago o se deposita. El cheque propio: ver decisión abierta 4.
10. **Liquidación semanal**: borrador editable → confirmar → pagar. El pago genera egresos, recibos y actualiza el histórico del legajo en una sola transacción.
11. **Recibo**: se genera solo, con la fecha del día y el logo de Cardi. Se descarga en PDF, se imprime y se comparte (Web Share API en el celular para mandarlo por WhatsApp).
12. **Presupuesto de obra**: gastado = suma de imputaciones de egresos confirmados, en la moneda del contrato usando la cotización congelada de cada movimiento. Restante = monto contratado − gastado.

---

## 6. Arquitectura

### Backend (NestJS)
- Capas `Controller → Service → Prisma`. **Cero lógica de negocio en controllers.**
- Un módulo por dominio en `backend/src/modules/`: `auth`, `usuarios`, `configuracion`, `obras`, `beneficiarios`, `categorias`, `cajas`, `cotizaciones`, `movimientos` (ingresos, egresos, transferencias, cambio), `cheques`, `liquidaciones`, `certificaciones`, `contratos-cuotas`, `compromisos`, `recibos`, `reportes`, `exportaciones`, `migracion`, `auditoria`, `health`.
- Guards: `JwtAuthGuard` global + `@Public()` solo para login/refresh/health. `PermissionsGuard` con `@RequirePermission('<modulo>', '<accion>')`.
- Toda operación que toca más de una tabla va en `prisma.$transaction`.
- Errores con un catálogo de códigos (`packages/shared/src/error-codes.ts`) y mensajes en español para el usuario.
- Estructura de módulo: `dto/`, `{modulo}.controller.ts`, `{modulo}.service.ts`, `{modulo}.module.ts`, `{modulo}.service.spec.ts`.

### `packages/shared`
- Schemas Zod de cada DTO (los usan backend y frontend).
- `money.ts`: conversión ARS↔USD, reparto de imputaciones y redondeo, con decimal.js. **Con tests unitarios exhaustivos.**
- Enums y tipos compartidos.

### Frontend (React)
- `src/features/<modulo>/` con `api.ts`, `hooks.ts`, `components/`, `pages/` (patrón Cocoguana).
- `src/components/ui` (shadcn), `src/components/layout`, `src/lib` (axios, formatters).
- **Mobile-first en la carga** (egreso rápido, liquidación, cheques). Desktop-first en reportes.
- Loading, error y empty state en toda vista. Totales en ARS y USD en todo listado de movimientos.
- Formato argentino: fechas `dd/MM/yyyy`, `Intl.NumberFormat('es-AR')` para ARS y USD (`US$ 1.800`).
- **Identidad visual de Cardi**: cuando lleguen logo y colores a `assets/`, armar los design tokens del theme y usarlos en layout, login, favicon y recibos. Hasta entonces, theme neutro sobrio. Prohibidos los colores crudos de Tailwind fuera de los tokens y los **emojis** en la UI.

---

## 7. Migración 2026

Es un bloque del alcance, no un detalle. Procedimiento (basado en la skill `client-data-migration`):
1. Originales en `migracion/originales/` (**solo lectura, nunca se modifican**, fuera de git si tienen datos sensibles).
2. Un parser por planilla en `backend/src/modules/migracion/parsers/` → vuelca a `migracion_filas` con el dato crudo.
3. Mapeo con diccionarios (`concepto_alias`, `beneficiario_alias`, obras). Lo que no matchea queda `OBSERVADA` para revisarlo con Cardi. **Ningún movimiento se pierde ni se inventa.**
4. Detección de duplicados entre planillas (misma fecha + monto + beneficiario). La fuente correcta la define el cliente (relevamiento 3.2).
5. Importación con `--dry-run` primero, siempre idempotente (reimportar un lote no duplica).
6. Validación contra los totales que da Cardi (relevamiento 3.3): gastado por obra, por mes y saldo de caja a una fecha. Reporte de diferencias en `migracion/reportes/`.

---

## 8. Proceso de trabajo

### Git y entornos
- `develop` → staging en Railway. `main` → producción.
- **Nunca push ni merge a `main` sin OK explícito de Mateo.** Push a `develop`, Mateo prueba en staging, y recién después se mergea. Pushear y mergear no van en el mismo turno.
- **Build local antes de cada push** (`pnpm build`, `pnpm type-check`, `pnpm lint`, `pnpm test`).
- Commits en español, chicos y descriptivos.
- Worktrees (Orca): crearlos fuera de `/tmp`.

### Migraciones Prisma (reglas de DevelopNet, no negociables)
- Producción corre `prisma migrate deploy` en el arranque. **Nunca `db push` en staging ni en prod.**
- Todo cambio de `schema.prisma` lleva su migration SQL **idempotente** (`IF NOT EXISTS`, `EXCEPTION WHEN duplicate_object`) commiteada en el mismo cambio.
- Detalle y recetas de recuperación (P2022/P3009): `.claude/MIGRATIONS_RULES.md`.

### Workflow por tamaño de tarea
- **Bug / fix chico**: skill `systematic-debugging` → causa raíz → fix mínimo + test → build → push `develop`.
- **Feature de un módulo**: `brainstorming` si hay dudas de alcance → plan → TDD en la lógica de plata → `code-review` → push `develop`.
- **Módulo con lógica crítica** (billetera, liquidación, migración): SDD con documentos en `docs/sdd/`: `exploration-` → `proposal-` → `design-` → `tasks-` → implementación → `verify-`.
- **Siempre**: skill `entrega-completa` (nada a medias, sin TODO, sin mocks, sin botones muertos) y `verification-protocol` (evidencia antes de decir "listo").
- **Un paso por vez y mensajes cortos** con Mateo. Una acción o una pregunta por respuesta.
- **Confirmar antes de gastar**: cualquier acción sobre infraestructura, Railway o datos de producción se pregunta antes.

### Tests mínimos obligatorios
- `packages/shared/money.ts`: conversiones, redondeo e imputaciones repartidas.
- Movimientos: saldos por caja y moneda, transferencia, cambio, anulación con reversa.
- Liquidación: reparto por obra según días y generación de egresos y recibos.
- Migración: idempotencia y detección de duplicados.

---

## 9. Plan de desarrollo (según la propuesta)

| Etapa | Contenido | Plazo |
|---|---|---|
| 0 | Setup: monorepo, Docker, auth, usuarios y permisos, Railway staging | Antes del día 1 |
| 1 | Relevamiento: planillas, obras, categorías, circuitos de pago, cierre de decisiones | Días 1 a 3 |
| 2 | **Primera versión navegable**: obras, beneficiarios, categorías, cajas, cotización automática, ingresos, egresos con imputación, transferencias y cambio | Semana 1 |
| 3 | Cheques, empleados y liquidación semanal con recibos, contratistas y certificaciones, proveedores, profesionales y cuotas, compromisos y proyección, reportes y export Excel | Semanas 2 a 4 |
| 4 | Migración de 2026, validación de saldos y totales, capacitación | Semanas 5 y 6 |
| 5 | Uso pleno con acompañamiento | 2 de enero de 2027 |

Cada etapa deja el sistema funcionando y demostrable en staging. El feedback del cliente reordena prioridades dentro de la etapa, no el alcance.

---

## 10. Decisiones

### Tomadas
- Desarrollo a medida, single-tenant, repo propio (**no** es una implementación del ERP DevelopNet).
- Stack NestJS + Prisma + React + Railway (sección 3).
- Una tabla `beneficiarios` con legajo 1:1 para empleados.
- Gastos generales = obra de tipo `GENERAL`.
- Libro único `movimientos` + `imputaciones`, con cotización y equivalentes congelados.
- Anulación por reversa, auditoría desde el día 1.

### Abiertas (se cierran en la reunión del relevamiento, Fase 4)
1. Blue **compra o venta** por defecto.
2. Migración: cotización anotada en la planilla o la del día de cada pago.
3. Datos del recibo y si se imprime, se firma o se manda por WhatsApp.
4. **Cheque propio**: el egreso impacta la caja banco el día que se entrega o el día que se debita (propuesta por defecto: el gasto se imputa el día del pago y el cheque queda como compromiso en la proyección hasta debitarse).
5. Día de pago semanal a empleados y contratistas. Si hay vales/adelantos que se descuentan en la liquidación.
6. Datos mínimos de cada ingreso o fondeo.
7. Qué ve y carga cada usuario.
8. Obras o conceptos que no se mezclan en los reportes. Si los gastos generales se prorratean.
9. Razones sociales: una o varias (afecta recibos y cajas).

Cuando se cierre cada una, moverla a "Tomadas" y actualizar el modelo si corresponde.

---

## 11. Estructura del repo

```
sistemaCardi/
├── CLAUDE.md
├── inicial.md                 # prompt de arranque
├── README.md
├── .claude/
│   ├── settings.json
│   ├── MIGRATIONS_RULES.md
│   ├── GIT_RULES.md
│   ├── commands/              # crear-crud-completo, crear-modulo-backend, crear-modulo-frontend, crear-migracion, crear-test, revisar-codigo
│   └── skills/                # entrega-completa, systematic-debugging, tdd, verification-protocol, brainstorming, code-review, client-data-migration, sdd-*
├── docs/
│   ├── Propuesta-DevelopNet-Cardi.pdf
│   ├── Relevamiento-DevelopNet-Cardi.pdf
│   ├── runbook.md
│   └── sdd/
├── assets/                    # logo e identidad de Cardi (cuando lleguen)
├── migracion/
│   ├── originales/            # planillas del cliente, solo lectura
│   └── reportes/
├── docker-compose.yml
├── railway.toml
├── pnpm-workspace.yaml
├── turbo.json
├── .env.example
├── packages/shared/
├── backend/
│   ├── prisma/ (schema.prisma, migrations/, seed.ts)
│   └── src/ (main.ts, app.module.ts, common/, config/, prisma/, storage/, modules/)
└── frontend/
    └── src/ (features/, components/, layouts/, lib/, router.tsx)
```

## 12. Comandos

```bash
pnpm install
docker compose up -d            # Postgres local
pnpm db:migrate                 # prisma migrate dev (solo local)
pnpm db:seed                    # admin, obras, categorías, cajas de ejemplo de Cardi
pnpm dev                        # backend + frontend
pnpm build && pnpm type-check && pnpm lint && pnpm test
pnpm migracion -- --lote <archivo> --dry-run
```
