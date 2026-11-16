# Exploración: Cheques + reparto por obra en egresos (Bloque B)

**Fecha**: 2026-11-16
**Módulos**: `cheques`, `movimientos`, `cajas`, `imputaciones` (back) · `BilleteraPage`, `NuevoEgresoDialog`, `CarteraChequesDialog` (front)
**Origen**: reunión con Dani 16/11/2026 (`docs/reuniones/cardi-reunion-2026-11-16.md`, secciones 3.3 y 3.4)

---

## 1. Contexto y pedidos

Dani detectó en la demo cuatro cosas rotas o faltantes alrededor del flujo de cheques:

| # | Pedido | Estado hoy |
|---|---|---|
| G1 | Al cargar un cheque, que sume al saldo de **Caja Cheques** | No suma: se guarda en tabla `Cheque` sin generar movimiento |
| G2 | El movimiento generado por el cheque debe mostrar el **detalle del cheque** (nro, banco, titular) | No hay movimiento (G1); aunque lo hubiera, hoy no se renderiza el cheque en la descripción |
| G3 | Al pagar un egreso con caja = **Caja Cheques**, listar los cheques en cartera y elegir uno (o varios) | No implementado en UI; el backend ya acepta `chequeId` pero no lo exige ni cambia estado del cheque |
| G4 | Al pagar, **repartir el monto en N líneas obra+monto** y ver **disponible restante** del cheque en vivo | Reparto por obra ya está en `NuevoEgresoDialog`. Falta el ligado con el cheque y el "disponible" |

**Caso real**: cheque Prolectric 2.000.000 → 1.709.xxx a Río Alto + ~291.000 a Galileo (una sola operación).

---

## 2. Estado actual

### 2.1 Modelo (`backend/prisma/schema.prisma`)

- **`Cheque`** (línea 793-827): modelo completo. Campos: `tipo` (PROPIO/TERCERO), `numero`, `banco`, `librador`/`titular`, `cuit`, `monto`, `moneda`, `fechaEmision`, `fechaPago`, `estado` (EN_CARTERA/ENTREGADO/DEPOSITADO/COBRADO/EMITIDO/DEBITADO/RECHAZADO/ANULADO), `beneficiarioId`, `imagenesPaths[]`. Relación `movimientos: Movimiento[]`.
- **`Caja`** (línea 652): `tipo` (`EFECTIVO`/`BANCO`/`CHEQUES_TERCEROS`/`OTRO`), `moneda`, `saldoInicial`. **Ya existe en seed una caja `"Cheques de terceros"` tipo `CHEQUES_TERCEROS` en ARS** (seed.ts:141-145).
- **`Movimiento`** (línea 695): tiene `chequeId: String?` + relación `cheque: Cheque?` — el vínculo 1:1 está. También `grupoId` para agrupar patas de operaciones compuestas, y `imputaciones: Imputacion[]`.
- **`Imputacion`** (línea 777): `movimientoId + obraId + monto + porcentaje`, unique `[movimientoId, obraId]`. Validación "la suma = monto del movimiento" se hace en `@cardi/shared` (`repartirMonto`) y en `MovimientosService.crearEgreso`.
- **`EstadoCheque`**: la máquina de estados está definida; las transiciones se validan con `assertTransition('Cheque', ...)` en `common/state-machines.ts`.

### 2.2 Backend

- **`ChequesService.create`** (líneas 62-92): **solo inserta en tabla `Cheque`**. No crea movimiento, no toca saldos. Audita y sale. → **Raíz del G1**.
- **`ChequesService.cambiarEstado`** (líneas 112-147): valida transición con state machine, valida reglas por tipo (PROPIO no puede ir a DEPOSITADO/COBRADO; TERCERO no puede ir a EMITIDO/DEBITADO), actualiza y audita. **No genera movimientos de caja al cambiar estado.**
- **`MovimientosService.crearEgreso`** (líneas 110-200):
  - Ya acepta `imputaciones` (reparto por obra): valida con `repartirMonto` antes de abrir transacción.
  - Ya acepta `chequeId` opcional (línea 148): lo guarda en el `Movimiento`, pero **no cambia estado del cheque ni valida que esté en cartera**.
  - Convierte montos ARS/USD con cotización congelada.
  - Caso especial de préstamos a empleados (categoría PREST_EMP): crea `PrestamoEmpleado` en la misma transacción. Patrón a reutilizar para "al guardar un egreso con chequeId, cambiar estado del cheque".
- **`MovimientosService.findAll`**: ya incluye `cheque: true` y `imputaciones: { include: { obra: true } }` → los datos del cheque ya viajan al frontend con cada movimiento.

### 2.3 Frontend

- **`NuevoEgresoDialog`** (`frontend/src/pages/movimientos/NuevoEgresoDialog.tsx`, 452 líneas):
  - Formulario completo con N líneas de imputación (obra+monto), validación en vivo de que la suma cierre, botón "Dividir en partes iguales".
  - Selector de `cajaId` + `medioPago` (incluye `CHEQUE_TERCERO`), pero **NO filtra cheques en cartera ni los muestra** cuando la caja es `CHEQUES_TERCEROS`.
  - No envía `chequeId` al backend.
  - Es el componente **a modificar** para G3 y G4.
- **`CarteraChequesDialog`** (`frontend/src/pages/billetera/CarteraChequesDialog.tsx`, 310 líneas): visor de la cartera agrupada por vencimiento con cambio de estado manual. No se usa para seleccionar cheque en el pago — es solo visor.
- **`BilleteraPage`**: el bloque "Saldos" lee de `cajasService.saldos` (que suma movimientos CONFIRMADOS de la caja). Si Caja Cheques no recibe movimientos, su saldo es 0 permanente → se ve el bug.

---

## 3. Por qué falla cada punto

### G1 — Cheque no suma a Caja Cheques
**Causa**: decisión de diseño actual. `ChequesService.create` guarda el cheque como entidad independiente, sin impacto en el libro único de la billetera. El saldo de las cajas se deriva de `Movimiento`, por eso la caja de cheques queda siempre en 0.

**Fix**: al crear un cheque TERCERO (EN_CARTERA), generar en la misma transacción un `Movimiento` tipo INGRESO contra la caja de tipo `CHEQUES_TERCEROS` que matchee la moneda del cheque, con `chequeId` seteado y una descripción autogenerada tipo *"Cheque 00012345 · Banco Nación · Librador Prolectric SA"*. Origen = `MANUAL` (o nuevo valor `CHEQUE`), origenId = cheque.id.

### G2 — Movimiento del cheque sin detalle
**Causa**: no hay movimiento (G1). Secundariamente, aunque el movimiento existiera, hoy la UI de `BilleteraPage` muestra `descripcion` plana — hay que renderizar el `cheque` incluido en la respuesta.

**Fix**: (a) poblar `descripcion` autogenerada al crear el ingreso (lo hace el service, no el frontend). (b) en el listado de movimientos y en el modal de detalle (task #10 pendiente), mostrar el badge del cheque cuando `mov.cheque` esté presente.

### G3 — Cheques en cartera no aparecen al pagar
**Causa**: `NuevoEgresoDialog` no tiene selector de cheques. El backend ya acepta `chequeId` pero no lo valida ni cambia el estado del cheque elegido.

**Fix**: en el frontend, cuando `cajaSel.tipo === 'CHEQUES_TERCEROS'` **y** `medioPago === 'CHEQUE_TERCERO'`, cargar `cheques.list({ estado: 'EN_CARTERA' })` filtrados por moneda de la caja y mostrarlos. Al elegir uno, autocompletar `monto` con `cheque.monto`. En el backend, extender `crearEgreso`:
- Validar que si `chequeId` presente → cheque existe + EN_CARTERA + moneda coincide con la caja + monto coincide con el egreso.
- En la transacción, pasar el cheque a ENTREGADO (usando `assertTransition`) y linkear beneficiario del egreso al cheque si no lo tenía.

### G4 — Disponible en vivo del cheque
**Causa**: no hay vínculo UI entre el cheque elegido y las líneas.

**Fix**: cuando hay cheque elegido, el total del egreso = `cheque.monto` (fijo, readonly). El disponible = `cheque.monto − sum(lineas.monto)`. Visualmente, mostrar "Disponible: $291.000,00" al lado del botón "Agregar obra". La validación `sumaLineas === total` ya existe.

---

## 4. Áreas afectadas

| Archivo | Tipo de cambio | Riesgo |
|---|---|---|
| `backend/src/modules/cheques/cheques.service.ts` | Agregar generación de movimiento en `create` (en `prisma.$transaction`) | Medio |
| `backend/src/modules/cheques/dto/cheques.dto.ts` | Posible campo `cajaIngresoId?` opcional | Bajo |
| `backend/src/modules/movimientos/movimientos.service.ts` | Validar cheque en `crearEgreso` y cambiar estado dentro de tx | Medio |
| `backend/src/modules/movimientos/dto/movimientos.dto.ts` | `chequeId` ya existe, confirmar | Bajo |
| `packages/shared/` | Posible helper `validarChequeParaEgreso` | Bajo |
| `frontend/src/pages/movimientos/NuevoEgresoDialog.tsx` | Selector de cheque + disponible en vivo + autocompletar monto | Medio |
| `frontend/src/pages/billetera/BilleteraPage.tsx` | Mostrar detalle del cheque en la fila de movimiento | Bajo |
| `frontend/src/services/chequesService.ts` | Si falta, endpoint para listar `enCartera` por moneda | Bajo |
| `backend/prisma/schema.prisma` | **Sin cambios de modelo** si vamos por 1 cheque/egreso. Cambio si vamos por N cheques (nuevo modelo puente) | Alto si cambia |

---

## 5. Enfoques posibles

### Enfoque A — Unidireccional desde el cheque (1 cheque = 1 egreso)
Al crear un cheque TERCERO se genera un INGRESO en Caja Cheques. Al pagar, se elige UN cheque y se usa entero. Si quedan "sobras" se reparten en obras (contablemente), pero el cheque sale entero de la caja.

- **Pros**: Mínimo cambio de modelo (ya existe `chequeId` 1:1 en Movimiento). UX simple. Cubre el 100% del caso de Dani (Prolectric 2M repartido en 2 obras).
- **Cons**: Si alguna vez se paga con 2 cheques juntos, hay que hacer 2 egresos (feos en la lista). No es lo que literalmente Dani pidió (*"uno o varios"*).
- **Esfuerzo**: 1-2 días.

### Enfoque B — N cheques por egreso (modelo puente)
Crear modelo `MovimientoCheque(movimientoId, chequeId)` muchos-a-muchos. Reemplazar `chequeId` escalar por la relación. UI multi-select.

- **Pros**: Soporta el caso "pagué con 3 cheques distintos a 2 obras".
- **Cons**: Migración de modelo (en prod). Reescritura del `include` en todos los services que usan `cheque`. UI más compleja.
- **Esfuerzo**: 3-4 días.

### Enfoque C — Híbrido: empezar con A, migrar a B si pasa
Entregar A ahora (cumple el caso de Dani), dejar nota en decisión abierta. Si aparece el caso real de N cheques, migrar al modelo puente.

- **Pros**: velocidad + no sobredimensionar. Alineado con la filosofía de CLAUDE.md ("Don't design for hypothetical future requirements").
- **Cons**: eventual retrabajo.
- **Esfuerzo**: 1-2 días ahora + posible 2-3 después.

---

## 6. Recomendación

**Enfoque C** (empezar con A). Razones:
1. Dani describió UN caso real concreto (Prolectric 2M) que se resuelve con 1 cheque + reparto a obras. La frase *"uno o varios"* es aspiracional, no viene con un caso.
2. Un modelo puente `MovimientoCheque` toca prod (migración) y quintuplica la complejidad para algo que puede no aparecer nunca.
3. El 95% del alcance del Bloque B es el flujo de 1 cheque. Lo liberamos y Dani prueba. Si vuelve con "esta semana pagué 3 cheques juntos al mismo proveedor", migramos.
4. Alineado con la nota del enfoque Cocoguana (patrón 1:1 `chequeId`).

---

## 7. Riesgos identificados

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Al retroactivar el movimiento para cheques ya cargados en prod sin movimiento asociado, hay inconsistencia entre cheques "viejos" (sin mov) y "nuevos" (con mov). | Script one-shot en `backend/prisma/scripts/` que recorra cheques EN_CARTERA sin movimiento y les genere el ingreso. Idempotente (filtra por `movimientos.length === 0`). Correr una vez en prod. |
| R2 | Anular un cheque hoy no revierte nada (porque no genera movimiento). Después del fix sí tiene que generar la reversa del INGRESO. | Extender `cambiarEstado` para que al pasar a ANULADO (desde EN_CARTERA) genere la reversa del movimiento asociado, igual que `MovimientosService.anular`. |
| R3 | La "Caja Cheques" es única en el seed (ARS). Si entra un cheque en USD → error. | Validación clara: si no hay caja CHEQUES_TERCEROS de esa moneda, pedir crearla primero. El seed ya puede crear la variante USD si se necesita. |
| R4 | Transferencia a banco (cheque DEPOSITADO) debería mover saldo de Caja Cheques a Caja Banco. Hoy no lo hace. | **Fuera del scope de Bloque B.** Anotar como gap conocido para iteración futura. La reunión no lo pidió explícitamente. |
| R5 | Cheques PROPIOS (emitidos por Cardi): hoy el estado inicial es EMITIDO. ¿Se registra como "compromiso de pago" o no toca caja? Reunión decisión abierta #4. | Diferir — PROPIOS tienen su propia discusión pendiente. El Bloque B se enfoca en TERCEROS. |
| R6 | Si un cheque se anuló en prod y ya se pagó un egreso con él, la reversa del INGRESO deja el saldo negativo. | Validar que solo se anule si no está ENTREGADO ni después. La state machine ya ayuda (EN_CARTERA → ANULADO sí, ENTREGADO → ANULADO también pero con cuidado). Revisar en implementación. |
| R7 | Concurrencia: dos usuarios eligen el mismo cheque al mismo tiempo para dos egresos distintos. | `crearEgreso` validar dentro de la transacción que el cheque sigue EN_CARTERA (SELECT FOR UPDATE o chequeo antes del UPDATE). |

---

## 8. Preguntas abiertas

1. **Caja Cheques por moneda**: ¿cuando entre un cheque USD, se crea automáticamente la caja o se pide crearla primero? *Sugerencia: pedir crearla primero (más explícito, menos "magia").*
2. **Beneficiario del cheque en cartera**: al crear un cheque TERCERO, muchas veces aún no sabemos a quién se lo vamos a dar. La reunión lo dijo: *"El beneficiario no es obligatorio al cargarlo: entra a la cartera propia y se asigna después"*. Confirmar que al pagar un egreso con ese cheque, se setea el beneficiario del cheque = beneficiario del egreso.
3. **Descripción autogenerada del ingreso**: ¿"Cheque {numero} · {banco} · {librador}" alcanza, o se quiere más info? Dejar que el usuario la edite si quiere.
4. **Cheques COBRADOS que impactan banco**: fuera de alcance del Bloque B; confirmar que diferimos.
5. **Caja Cheques en el seed para prod**: ya existe en ARS. Para el reset limpio futuro confirmar si se agrega USD también.
6. **Al cambiar un cheque de EN_CARTERA a DEPOSITADO** manualmente (sin pagar egreso): hoy solo cambia estado. ¿Quiere Dani que eso genere una transferencia Caja Cheques → Caja Banco? (Alineado con R4, probablemente no en esta iteración.)

---

## 9. Próximo paso sugerido

Pasar a **`sdd-propose`** con esta exploración + la recomendación de **Enfoque C**. El proposal cierra:
- Decisión 1 cheque / egreso (contra N).
- Qué de la decisión 2 (beneficiario del cheque) y 3 (descripción) se incorpora.
- Fuera de alcance explícito: cheques propios, transferencia a banco por depósito.

Después `sdd-design` baja esto a cambios de DTOs, servicios y UI concretos, y `sdd-tasks` lo parte en #4 + #2 + #3 ya creadas.
