# Exploración: Cheques + reparto por obra en egresos (Bloque B)

**Fecha**: 2026-11-18 (revisión del doc original del 16/11, actualizada al estado real de `main`)
**Módulos**: `cheques`, `movimientos`, `cajas`, `imputaciones` (back) · `BilleteraPage`, `NuevoEgresoDialog`, `NuevoChequeDialog`, `CarteraChequesDialog` (front)
**Origen**: reunión con Dani 16/11/2026 (`docs/reuniones/cardi-reunion-2026-11-16.md`, secciones 3.3 y 3.4)
**Branch**: `main` (al día con producción). Último commit tocando cheques: `6a05e6e` (anulación revierte el INGRESO) y `35800de` (pago con cheque + reparto + disponible en vivo).

> ⚠️ **El exploration original de este archivo (del 16/11) describía el estado _antes_ del fix.** Casi todo lo que listaba como "falta" ya se implementó (commits `8fbf4f1`, `35800de`, `6a05e6e`, `c56f792`). Esta revisión documenta lo que hoy **sí está en prod** y lo que todavía queda pendiente. Se preserva el razonamiento original en § 5 para no perder la discusión de enfoques.

---

## 1. Contexto y pedidos

Dani detectó en la demo del 16/11 cuatro cosas rotas o faltantes en el flujo de cheques (sección 3.3 de la minuta). Estado actual de cada una:

| # | Pedido | Estado al 2026-11-18 |
|---|---|---|
| G1 | Al cargar un cheque, que **sume al saldo de Caja Cheques** | ✅ Resuelto (commit `8fbf4f1`): al crear un cheque TERCERO se genera en la misma transacción un `Movimiento` tipo INGRESO contra la caja `CHEQUES_TERCEROS` que matchee la moneda. |
| G2 | El movimiento generado debe mostrar **detalle del cheque** (nro, banco, titular) | ✅ Resuelto (commit `8fbf4f1`): `ChequesService.descripcionCheque()` genera `"Cheque N° {numero} · {banco} · {librador o titular}"` y se guarda como `descripcion` del INGRESO. El listado de movimientos ya incluye `cheque: true`. |
| G3 | Al pagar un egreso con caja = **Caja Cheques**, listar los cheques en cartera y elegir uno | ✅ Resuelto (commit `35800de`): `NuevoEgresoDialog` detecta `cajaSel.tipo === 'CHEQUES_TERCEROS'` y muestra un combobox con los cheques `EN_CARTERA` filtrados por moneda. Al elegir uno, autocompleta monto y beneficiario. |
| G4 | Al pagar, **repartir en N líneas obra+monto** con **disponible restante en vivo** | ✅ Resuelto (commit `35800de`): el bloque "Imputación a obra(s)" ya era N:1; cuando hay cheque, el monto queda `readOnly` (= monto cheque) y se muestra `"Disponible del cheque: $X"` recalculado por cada cambio de línea. |

**Caso real de la reunión**: cheque Prolectric 2.000.000 → 1.709.xxx a Río Alto + ~291.000 a Galileo. Hoy es soportado end-to-end.

---

## 2. Estado actual (al 2026-11-18)

### 2.1 Modelo (`backend/prisma/schema.prisma`)

Sin cambios respecto al doc original — todos los campos necesarios ya existían.

- **`Caja`** (línea 773): `tipo` (`EFECTIVO`/`BANCO`/`CHEQUES_TERCEROS`/`OTRO`), `moneda`. **El seed crea una sola caja `"Cheques de terceros"` tipo `CHEQUES_TERCEROS` en ARS** (`seed.ts:160`). Para USD no hay caja seed ⇒ ver trampa T3 abajo.
- **`Movimiento`** (línea 816): tiene `chequeId: String?` + relación `cheque: Cheque?`. También `grupoId` (agrupa patas) e `imputaciones: Imputacion[]`. Índices útiles: `[cajaId, fecha]`, `[origen, origenId]`.
- **`Imputacion`** (línea 899): `movimientoId + obraId + monto + porcentaje`, unique `[movimientoId, obraId]`. La suma = `Movimiento.monto` se valida con `repartirMonto` de `@cardi/shared` + check en el service.
- **`Cheque`** (línea 915): `tipo` (PROPIO/TERCERO), estados `EN_CARTERA/ENTREGADO/DEPOSITADO/COBRADO/EMITIDO/DEBITADO/RECHAZADO/ANULADO`. Relación inversa `movimientos: Movimiento[]` (un cheque puede estar vinculado a su INGRESO al cargarlo y a su EGRESO al pagarlo).
- **`EstadoCheque`**: máquina de estados en `common/state-machines.ts`; transiciones validadas con `assertTransition('Cheque', actual, siguiente)`.

### 2.2 Backend

**`ChequesService.create`** (`backend/src/modules/cheques/cheques.service.ts:78`):

Dentro de `prisma.$transaction`:
1. Si `tipo === TERCERO`, resuelve la caja destino (`cajaIngresoId` del DTO o única caja `CHEQUES_TERCEROS` activa en la moneda — error claro si hay 0 o >1).
2. Crea la fila `Cheque` con `estado = EN_CARTERA` (TERCERO) o `EMITIDO` (PROPIO).
3. **Para TERCERO**: crea el `Movimiento` INGRESO en la caja destino con descripción autogenerada, `chequeId`, `obraIngresoId` opcional, cotización congelada.
4. Para PROPIO: no genera movimiento (diferido — ver trampa T2).

**`ChequesService.cambiarEstado`** (línea 285):

- Valida transición con state machine + reglas por tipo (PROPIO → DEPOSITADO/COBRADO prohibido; TERCERO → EMITIDO/DEBITADO prohibido).
- **Caso `EN_CARTERA → ANULADO` en TERCERO** (línea 309): dentro de una tx busca los INGRESOS CONFIRMADOS asociados al cheque y les crea la reversa (patrón anulación por reversa, idéntico a `MovimientosService.anular`).

**`MovimientosService.crearEgreso`** (`backend/src/modules/movimientos/movimientos.service.ts:128`):

Partes relevantes al flujo cheque:
- Líneas 180-199: si viene `dto.chequeId` valida fuera de la tx que el cheque **existe**, está **EN_CARTERA**, moneda **coincide** con la caja, y monto del egreso es **exactamente igual** al del cheque. (Enfoque "1 cheque = 1 egreso, el reparto es por obra, no por valor del cheque".)
- Líneas 275-288: dentro de la tx, re-lee el cheque y falla con `"El cheque ya no está disponible"` si cambió — evita race condition de dos egresos concurrentes eligiendo el mismo cheque. Pasa el cheque a `ENTREGADO` y linkea el `beneficiarioId` del egreso al cheque si estaba vacío.
- El resto del método mantiene todo lo previo (categoría auto `PAGO_PROV` para proveedores, préstamos a empleados, reparto por obras o vehículos).

**Script de retroactivación** (`backend/prisma/scripts/backfill-cheques-ingresos.ts`, commit `c56f792`):

One-shot idempotente: recorre cheques TERCERO sin `movimientos` y les genera el INGRESO. Correr una vez por entorno donde hubiera cheques pre-fix (prod no tenía porque el reset de demo del 18/11 limpió todo).

### 2.3 Frontend

**`NuevoChequeDialog`** (`frontend/src/pages/billetera/NuevoChequeDialog.tsx`, 367 líneas):

- Formulario con tipo, nro, banco (autocompletado inline), titular/librador, CUIT, monto (MoneyInput), moneda, fechas, OrigenPicker (beneficiario tipo EMPRESA_PAGADORA opcional).
- Si `tipo === TERCERO`: bloque "Ingreso a la caja" con selector de caja destino (visible solo si hay más de una CHEQUES_TERCEROS en la moneda) y obra ingreso opcional.
- El submit llama a `chequesService.create` con `cajaIngresoId` + `obraIngresoId` — el backend hace el resto.
- **Pendiente**: tarea #25 (in_progress) — botón "Pagar / Derivar" que al crear llame un `onDerivar` que abra `NuevoEgresoDialog` con `cajaInicialId` + `chequeInicialId` + `tipoEgreso='PROVEEDOR'`. El `NuevoEgresoDialog` ya acepta esos props (líneas 56-71 de su archivo); falta el disparador en el dialog del cheque y la orquestación en `BilleteraPage`.

**`NuevoEgresoDialog`** (`frontend/src/pages/movimientos/NuevoEgresoDialog.tsx`, 976 líneas):

- Modo cheque: `modoCheque = cajaSel?.tipo === 'CHEQUES_TERCEROS'`. Cuando se cumple, aparece un bloque "Cheque a entregar *" (líneas 459-489) con:
  - Combobox buscable de cheques EN_CARTERA filtrados por moneda, con label `"N° XXX · Banco · $ monto"` y hint `"pago dd/MM · librador"`.
  - Al elegir, `onChequeChange` setea `monto = cheque.monto` y copia el `beneficiarioId` si estaba vacío.
  - Preview inline del cheque (librador, monto formateado, vencimiento).
- Monto queda `readOnly` cuando hay cheque elegido (línea 498) con tooltip explicando que el reparto es por obra.
- Indicador "Disponible del cheque: $X" (líneas 782-794) debajo de las líneas, color según signo (danger si negativo, warning si sobra, success si cierra exacto).
- `puedeEnviar` bloquea si `modoCheque && !chequeId` (línea 190).
- `onCajaChange` autoselecciona `medioPago = CHEQUE_TERCERO` cuando la caja es CHEQUES_TERCEROS (línea 311).

**`BilleteraPage`** (`frontend/src/pages/billetera/BilleteraPage.tsx`):

- Bloque "Saldos" lee de `cajasService.saldos` (suma `Movimiento` CONFIRMADOS por caja). Como ahora Caja Cheques recibe INGRESOS al cargar cheques y EGRESOS al pagarlos, su saldo refleja real el valor de los cheques en cartera.
- Filtros por caja/tipo/obra/categoría/beneficiario combinables (commit `cccc7ee`).
- No muestra todavía el **detalle del cheque como badge** en la fila del movimiento (`MovimientoRow` muestra solo descripción). El dato viaja (`mov.cheque` está en el payload), falta renderizarlo. **Gap menor, cosmético.**

**`CarteraChequesDialog`**: visor agrupado por vencimiento + cambio de estado manual. Patrón Cocoguana. Sin interacción con el flujo de pago.

---

## 3. Por qué cada punto estaba roto (análisis original) y cómo quedó resuelto

### G1 — Cheque no sumaba a Caja Cheques
**Causa original**: decisión de diseño. `ChequesService.create` solo insertaba en tabla `Cheque` sin tocar el libro de movimientos.
**Resolución**: en la misma transacción se crea un INGRESO contra la caja CHEQUES_TERCEROS. Descripción autogenerada, cotización congelada, `chequeId` seteado, `origen = MANUAL` + `origenId = cheque.id` (para trazabilidad).
**Riesgo residual**: si alguna vez la caja CHEQUES_TERCEROS existe en 0 o >1 variantes para la moneda del cheque, el create falla con `BadRequestException`. El usuario tiene que crearla primero. UX: el `NuevoChequeDialog` ya muestra el mensaje antes del submit.

### G2 — Movimiento sin detalle del cheque
**Causa original**: no había movimiento (G1). Secundariamente la UI no renderizaba el cheque incluido.
**Resolución**: la descripción autogenerada ya trae `"Cheque N° XXX · Banco · Librador"`, visible en la tabla de la Billetera. **Pendiente cosmético**: mostrar un badge explícito en la fila para que se vea el cheque aunque el usuario edite la descripción.

### G3 — Cheques en cartera no aparecían al pagar
**Causa original**: `NuevoEgresoDialog` no filtraba ni mostraba cheques.
**Resolución**: combobox de cheques EN_CARTERA por moneda cuando la caja es CHEQUES_TERCEROS. Backend valida estado/moneda/monto y cambia a ENTREGADO dentro de la tx.

### G4 — Disponible en vivo del cheque
**Causa original**: no había vínculo UI.
**Resolución**: `disponibleCheque = cheque.monto − sum(lineas.monto)`, indicador live con color semántico.

---

## 4. Áreas afectadas (hoy — qué sigue abierto)

| Archivo | Estado | Pendiente |
|---|---|---|
| `backend/src/modules/cheques/cheques.service.ts` | ✅ `create` genera INGRESO; `cambiarEstado` revierte al anular desde CARTERA | — |
| `backend/src/modules/cheques/dto/cheques.dto.ts` | ✅ `cajaIngresoId?`, `obraIngresoId?` opcionales | — |
| `backend/src/modules/movimientos/movimientos.service.ts` | ✅ validaciones de cheque + cambio de estado en tx | — |
| `backend/src/modules/movimientos/dto/movimientos.dto.ts` | ✅ `chequeId: uuid().optional()` | — |
| `packages/shared/` | ✅ `repartirMonto` centralizado | — |
| `frontend/src/pages/movimientos/NuevoEgresoDialog.tsx` | ✅ selector + disponible + autocompletar + acepta `cajaInicialId`/`chequeInicialId` | — |
| `frontend/src/pages/billetera/NuevoChequeDialog.tsx` | 🟡 crea bien el cheque | **#25**: botón "Pagar / Derivar" que dispare onDerivar al padre |
| `frontend/src/pages/billetera/BilleteraPage.tsx` | 🟡 lista funciona | Orquestar #25 (state `derivandoCheque`, abrir egreso con props); badge cheque en fila |
| `backend/prisma/seed.ts` | 🟡 crea Caja Cheques solo en ARS | Decidir si se agrega variante USD o se deja bajo demanda |
| `backend/prisma/scripts/backfill-cheques-ingresos.ts` | ✅ one-shot idempotente | Solo correr si aparecen entornos con cheques pre-fix |

---

## 5. Enfoques posibles (histórico — para no perder la discusión)

### Enfoque A — Unidireccional 1 cheque = 1 egreso (**el que se implementó**)
Al crear un cheque TERCERO → INGRESO en Caja Cheques. Al pagar → se elige UN cheque, se usa entero, y la **repartición es por obra** (no por valor del cheque).
- **Pros**: mínimo cambio de modelo (ya existía `chequeId` 1:1), UX simple, cubre el 100% del caso Prolectric.
- **Cons**: si alguna vez se paga con 2 cheques juntos, hay que hacer 2 egresos.
- **Esfuerzo**: 1-2 días. **Implementado en commits `8fbf4f1` + `35800de` + `6a05e6e`.**

### Enfoque B — N cheques por egreso (modelo puente)
Modelo `MovimientoCheque(movimientoId, chequeId)` muchos-a-muchos.
- **Pros**: soporta "pagué con 3 cheques distintos a 2 obras".
- **Cons**: migración en prod, reescritura de includes, UI más compleja.
- **Esfuerzo**: 3-4 días. **Descartado por ahora. A revisar si Dani lo pide con un caso concreto.**

### Enfoque C — Híbrido (recomendado y aplicado)
Empezar con A, migrar a B si pasa. Alineado con CLAUDE.md § "no diseñar para requerimientos hipotéticos".

---

## 6. Trampas y dependencias con otros módulos

### T1 — Reset de demo y datos reales
El `reset-para-demo.ts` corre en prod antes de cada demo (commit `3fcce51`). Limpia cheques, movimientos, cajas (mantiene estructura). Si se va a correr el backfill, hacerlo **después** del próximo reset con datos reales, no antes. El backfill es idempotente pero vacío si no hay cheques.

### T2 — Cheques PROPIOS (emitidos por Cardi)
Hoy el `create` NO genera movimiento para PROPIO (línea 83 del service). Razón: un cheque propio no toca el banco al emitirse — recién al **debitarse** descuenta de la caja Banco. Esto está diferido conscientemente. Impacto: si Cardi empieza a emitir cheques propios, va a ver el egreso recién cuando cambie estado a DEBITADO, y hoy ese cambio tampoco genera movimiento (`cambiarEstado` solo revierte al ANULAR desde CARTERA). **Decisión abierta #4 de CLAUDE.md**: propuesta por defecto = el egreso se registra el día del pago (manual, egreso normal), el cheque propio queda como compromiso visible en cartera hasta que se debite. Si se avanza en este tema, es otro SDD.

### T3 — Caja CHEQUES_TERCEROS en USD
El seed solo crea la caja en ARS. Si entra un cheque USD, el `create` falla con "No hay ninguna caja CHEQUES_TERCEROS en USD. Creala primero en Billetera → Cuentas." El UI se puede crear a mano desde `GestionCuentasDialog`. **Decisión pendiente**: agregar al seed la variante USD (simple) vs seguir requiriendo creación manual (más explícito). Dani no ha pedido operar con cheques USD hasta ahora.

### T4 — Transferencia a banco (DEPOSITADO → COBRADO)
Hoy `cambiarEstado` NO genera movimiento al pasar un cheque de EN_CARTERA a DEPOSITADO/COBRADO. Esto significa que si se cobra un cheque en banco, el saldo de Caja Cheques NO baja ni el de Caja Banco sube — hay que registrarlo como transferencia manual. **Fuera del alcance de la reunión del 16/11**; marcarlo como gap conocido para iteración futura. Si entra con un caso real, es otro SDD chico.

### T5 — Dependencia con `certificaciones` y `liquidaciones`
Verificado por `grep` — ninguno de los dos módulos referencia `chequeId` directamente. Ambos crean egresos vía `crearEgreso` y heredan todo el soporte cheque de forma gratuita.
- **Certificaciones**: cuando se registra un pago parcial y el usuario elige caja CHEQUES_TERCEROS, el flujo de `NuevoEgresoDialog` aplica igual. Falta probar end-to-end (no vimos este caso en vivo).
- **Liquidaciones semanales**: el pago se hace en lote desde `LiquidacionesService.marcarPagado`. Si ese método cablea con caja CHEQUES_TERCEROS (poco probable para empleados — se paga en efectivo o transferencia) habría que decidir si se permite un cheque por empleado. **Por ahora no se permite** (UI del flujo de liquidación no ofrece el selector). No es un caso de uso real de Cardi.

### T6 — Pago a proveedor
`ProveedorDetallePage` tiene un botón "Registrar pago" que abre `NuevoEgresoDialog` con `beneficiarioInicialId` + `imputacionesSugeridas` (saldo por obra). Si el proveedor eligió caja CHEQUES_TERCEROS, aparece el bloque de cheque también. Es el camino más usado en la demo. **Punto de intersección con #25**: la derivación desde "Nuevo cheque → Pagar/Derivar" cae acá, con el cheque ya pre-seleccionado y `tipoEgreso` forzado a `PROVEEDOR`.

### T7 — Edición de movimientos con cheque
`MovimientosService.editar` prohíbe explícitamente modificar `chequeId`, monto, caja, moneda y cotización (comentario línea 644). Para corregir un pago con cheque mal cargado hay que **anular** y volver a cargar. La anulación del EGRESO hoy **NO revierte el estado del cheque** (que pasó a ENTREGADO): queda ENTREGADO aunque el pago se haya revertido. **Gap conocido** — si se detecta como problema real, el fix es devolver el cheque a EN_CARTERA en el bloque de reversas de `anular`. Mitigación actual: el usuario puede cambiar manualmente el estado del cheque desde la cartera.

### T8 — Concurrencia
Dos usuarios eligiendo el mismo cheque al mismo tiempo: resuelto parcialmente — el `crearEgreso` re-lee dentro de la tx y falla si cambió el estado (línea 277). No es un SELECT FOR UPDATE, pero el write-after-read fail es suficiente para el throughput esperado (una oficina chica).

---

## 7. Preguntas abiertas

1. **Badge visual del cheque en la fila de movimiento**: ¿se agrega chip "🧾 N° 12345" al lado del tipo en `BilleteraPage`? Es cosmético, mejora la lectura. Costo: bajo.
2. **Caja Cheques USD en el seed**: ¿se precrea o se deja bajo demanda? Esperar a que aparezca el caso real.
3. **Anular EGRESO con cheque**: ¿devolver el cheque a EN_CARTERA automáticamente? Decidir con Dani si es mejor eso o dejar que lo mueva a mano (le da control pero cuesta un paso extra).
4. **Transferencia Caja Cheques → Banco al cobrar**: alcance futuro. No es de esta iteración.
5. **Cheques PROPIOS**: decisión abierta #4 de CLAUDE.md sigue abierta. Fuera del Bloque B.
6. **Permitir cheque en liquidación semanal**: no hay caso de uso hoy. Si aparece, un SDD aparte.

---

## 8. Próximo paso sugerido

El Bloque B está **95% implementado**. Resta:

1. **Cerrar #25** (en progreso): botón "Pagar / Derivar" en `NuevoChequeDialog` + orquestación en `BilleteraPage`. Esfuerzo: medio día. No requiere nuevo SDD — el diseño está en el comentario de `NuevoEgresoDialog` (props `cajaInicialId`/`chequeInicialId` ya aceptadas).
2. **Gap cosmético**: badge del cheque en la fila del listado de movimientos (T1 de preguntas abiertas). Esfuerzo: 1 hora. No es bloqueante.
3. **Pendientes diferidos** (ver T2/T3/T4/T7): cada uno un mini-SDD si aparece caso real. No agendarlos sin señal del cliente.

Sin cambios de modelo ni migraciones Prisma para completar el Bloque B. El exploration del 16/11 proponía Enfoque C y así se implementó.
