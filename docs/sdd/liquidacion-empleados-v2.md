# Empleados, liquidaciones y pago desde tesorería — v2

**Estado:** diseño aprobado por Mateo (2026-11-11), implementación en curso.
**Alcance:** bloque 04 de la propuesta (empleados y pagos semanales) + enganche con billetera (bloque 02).
**Objetivo:** rehacer el flujo actual de liquidaciones para que coincida con cómo trabaja Dani: una liquidación por obra por semana, hs. extras, préstamos con saldo, pago en partes, recibos imprimibles compactos.

---

## 1. Qué hay hoy

- `Beneficiario` (tipo EMPLEADO) + `EmpleadoLegajo` 1:1 con `jornal` o `montoSemanal`.
- `LiquidacionSemanal` con `@@unique([semanaInicio, semanaFin])` → **bloquea más de una por semana**. Hay que sacarlo.
- `LiquidacionItem` con `diasTrabajados`, `valorDia`, `subtotal`, `descuentos`, `aPagar`, `pagado` (bool). No hay hs. extras, no hay préstamos aplicados.
- `LiquidacionDia` con `obraId` por día → el reparto por obra se hace día por día. Según Dani (reunión 2026-11-11), él arma una liquidación por obra, cargando el total de días. **Simplificación: la obra pasa a la cabecera, los días quedan como número en el item, se elimina `LiquidacionDia`.**
- No hay `Empresa`, no hay `PrestamoEmpleado`, no hay historial de jornales, no hay pago parcial.
- `LiquidacionesService.pagar` genera un `Movimiento` por item imputado proporcionalmente a las obras del `LiquidacionDia`. Se simplifica: un solo pago (o varios parciales) imputado 100% a la obra de la liquidación.

## 2. Qué se cambia

> **Actualización 2026-11-11 (post-análisis de planillas reales):** se agregan
> `CategoriaEmpleado` + historial, `LiquidacionItemConcepto` tipado, y se
> remueven los campos fijos de `LiquidacionItem` (hs extras, valor hora extra,
> descuentos, préstamos aplicados). Ahora un recibo es una persona con N
> conceptos tipados; el subtotal se deriva de la suma firmada de conceptos.
> Ver [`/docs/excels-cliente/ANALISIS.md`](../excels-cliente/ANALISIS.md).

### 2.1 Modelos nuevos

**`Empresa`** — razón social a la que pertenece cada empleado (Cardi, Picardi u otra configurable).
Campos: `id`, `nombre` (unique), `cuit?`, `activo`, auditoría, timestamps.

**`EmpleadoJornalHistorico`** — congela cada cambio de jornal del empleado para que una liquidación vieja no se descalabre si después se actualiza.
Campos: `id`, `legajoId`, `jornal`, `valorHoraExtra`, `vigenteDesde` (Date), `motivo?`, `createdById`, `createdAt`.
Al liquidar se toma el registro con mayor `vigenteDesde <= fecha de la liquidación`.
El jornal "vigente" en `EmpleadoLegajo.jornal` es siempre la última entrada del histórico.

**`PrestamoEmpleado`** — un préstamo nace como egreso en billetera con concepto "Préstamo a empleado".
Campos: `id`, `beneficiarioId` (EMPLEADO), `fecha` (Date), `monto` (Decimal 14,2, siempre ARS), `saldoPendiente` (Decimal 14,2), `estado` (VIGENTE/SALDADO/ANULADO), `movimientoId` (el egreso), `observaciones?`, auditoría, timestamps.
Se descuenta de la caja (típicamente efectivo) e impacta obra `GENERAL` (no es costo de obra).

**`PrestamoAplicacion`** — cada vez que un préstamo se descuenta parcial o totalmente en una liquidación.
Campos: `id`, `prestamoId`, `liquidacionItemId`, `monto`, `createdAt`.
La suma de aplicaciones de un préstamo nunca supera `monto` original. `saldoPendiente = monto − sum(aplicaciones)`. Cuando llega a 0, el préstamo pasa a `SALDADO`.

**`LiquidacionPago`** — un pago parcial o total de una liquidación.
Campos: `id`, `liquidacionId`, `movimientoId` (el egreso en billetera), `monto`, `fecha`, `medioPago`, `cajaId`, `createdById`, `createdAt`.
Una liquidación puede tener N pagos. `totalPagado = sum(LiquidacionPago.monto − reversas)`.

**`CategoriaEmpleado`** (v3) — categoría laboral con jornal y hora extra "de referencia".
Campos: `id`, `codigo` (unique: OF_CAP, OF_SOL, OF, MO_BUENO, MO, AYU, etc.), `nombre`, `jornal`, `valorHoraExtra`, `orden`, `activo`, auditoría.
Al editar el jornal de la categoría, el service propaga a todos los empleados activos y crea un `EmpleadoJornalHistorico` por empleado + un `CategoriaEmpleadoHistorico`.

**`CategoriaEmpleadoHistorico`** (v3) — snapshot de cada cambio de jornal de una categoría. Campos: `id`, `categoriaId`, `jornal`, `valorHoraExtra`, `vigenteDesde`, `motivo`, `empleadosAfectados` (contador), `createdById`, `createdAt`.

**`LiquidacionItemConcepto`** (v3) — línea del recibo. Un recibo (`LiquidacionItem`) ahora tiene N conceptos tipados.
Campos: `id`, `liquidacionItemId`, `tipo` (enum TipoConceptoLiquidacion), `descripcion`, `cantidad`, `valorUnitario`, `monto` (ya signado), `obraId?` (para certificaciones imputadas a otra obra), `prestamoId?` (para aplicaciones y entregas), `orden`.
El tipo determina el signo del monto (la DB lo guarda firmado). El service aplica el signo al guardar según `SIGNO_POR_TIPO`.

**`TipoConceptoLiquidacion`** (enum v3):
- Positivos (suman al subtotal): `JORNAL`, `JORNAL_ESPECIAL`, `HORAS_EXTRA`, `VIATICO`, `VACACIONES`, `CERTIFICACION`, `SUELDO`, `PRESTAMO_ENTREGADO`.
- Negativos (restan): `PRESTAMO_APLICACION`, `DEDUCCION`, `VALE`.
- Neutros (informativos): `NOTA_SALDO`.

### 2.2 Modelos modificados

**`EmpleadoLegajo`** — agregar:
- `dni: String?`
- `empresaId: String?` → FK a `Empresa`
- `categoriaId: String?` → FK a `CategoriaEmpleado` (v3). Si está seteado y el empleado no tiene jornal propio, se hereda al crear/actualizar.
- `situacionFiscal: SituacionFiscal` (default `NEGRO`)
- `valorHoraExtra: Decimal?` (14,2) → por defecto `jornal / 8 * 1.5`, pero editable
- Mantener `jornal`, `montoSemanal`, `moneda` (siempre ARS pero dejamos la columna por simetría).

**`LiquidacionSemanal`** — cambios:
- Agregar `obraId: String` (NOT NULL — una liquidación por obra).
- Remover `@@unique([semanaInicio, semanaFin])`. No reemplazar por `[semanaInicio, semanaFin, obraId]` (Dani podría necesitar varias por obra en una semana, p. ej. complementos).
- Agregar estado `PAGADA_PARCIAL` al enum.
- Agregar campo calculado persistido `totalAPagar` (suma de `aPagar` de items). `saldoPendiente` se deriva: `totalAPagar − totalPagado`.
- Mantener totales (`totalBruto`, `totalDescuentos`, `totalPagado`).

**`LiquidacionItem`** (v3) — **simplificado**:
Campos finales: `id`, `liquidacionId`, `beneficiarioId`, `nombreLibre`, `subtotal`, `aPagar`, `pagado`, `fechaPago`, `observaciones`.
Se eliminaron `diasTrabajados`, `valorDia`, `horasExtras`, `valorHoraExtra`, `descuentos`, `prestamosAplicados` — todos se derivan de los conceptos.

El subtotal pasa a:
```
subtotal = Σ monto_signado(concepto) con signo según tipo, excluyendo NOTA_SALDO
aPagar   = subtotal (los descuentos ya están incluidos como conceptos negativos)
```

**`LiquidacionDia`** — se elimina. La obra ya está en la cabecera, los días son un número. Si en el futuro se necesita granularidad diaria, se vuelve a agregar.

**`OrigenMovimiento`** — agregar `PRESTAMO`.

**`CategoriaGasto`** — seed agrega "Préstamos a empleados" (código `PREST_EMP`). Ya existe "Jornales" (JORN).

### 2.3 Enums nuevos

```prisma
enum SituacionFiscal {
  BLANCO
  NEGRO
}

enum EstadoPrestamoEmpleado {
  VIGENTE
  SALDADO
  ANULADO
}
```

`EstadoLiquidacion` queda: `BORRADOR`, `APROBADA`, `PAGADA_PARCIAL`, `PAGADA`, `CERRADA`.

## 3. Flujos

### 3.1 Crear liquidación semanal

1. Dani selecciona semana (desde/hasta), obra, y empleados (selección múltiple).
2. Por cada empleado, el back toma su jornal y `valorHoraExtra` vigentes y crea un `LiquidacionItem` con `diasTrabajados = 0`, `horasExtras = 0`, `descuentos = 0`.
3. Estado = `BORRADOR`. Dani ajusta días, hs, descuentos, selecciona préstamos a aplicar.
4. Al confirmar, el estado pasa a `APROBADA`. Se recalculan totales. Los préstamos seleccionados se registran en `PrestamoAplicacion` y reducen el saldo del `PrestamoEmpleado`.

### 3.2 Pagar (total o parcial)

Desde la liquidación `APROBADA` o `PAGADA_PARCIAL`:
1. Dani abre modal "Pagar" con monto propuesto = `saldoPendiente`. Puede editar (pagar menos).
2. Elige caja (default: efectivo) y medio de pago.
3. En una `$transaction`:
   - Crea `LiquidacionPago` con monto y fecha.
   - Crea `Movimiento` (EGRESO) con imputaciones por obra calculadas a partir de los conceptos positivos de todos los items (v3). Conceptos con `obraId` van a esa obra; conceptos sin `obraId` van a la obra de la liquidación. Si el pago es parcial, los aportes por obra se escalan proporcionalmente. `origen = LIQUIDACION`, `origenId = liquidacionId`.
   - Actualiza `totalPagado` y `estado` (`PAGADA_PARCIAL` si saldo > 0, `PAGADA` si saldo <= 0; saldo < 0 queda como "a favor" informativo, no bloquea).
   - Marca `LiquidacionItem.pagado = true` solo cuando `totalPagado >= totalAPagar`.

Desde billetera (ruta alternativa):
- Nuevo egreso, categoría "Liquidación" (seed), selector de liquidaciones `APROBADA` o `PAGADA_PARCIAL` por obra. El flujo termina en el mismo endpoint `/liquidaciones/:id/pagar` para no duplicar lógica.

### 3.3 Préstamo a empleado

Desde billetera:
1. Dani crea un egreso con categoría "Préstamos a empleados".
2. El form pide seleccionar empleado (beneficiario tipo EMPLEADO activo).
3. En una `$transaction`: se crea el `Movimiento` (imputado a obra `GENERAL`, `origen = PRESTAMO`) y el `PrestamoEmpleado` con `saldoPendiente = monto`, `estado = VIGENTE`.

En la liquidación:
- El form muestra, por empleado, los préstamos vigentes con su saldo pendiente.
- Dani elige cuánto descontar de cada préstamo en este item. El back valida `montoAplicar <= saldoPendiente`.
- Al confirmar la liquidación, se crea `PrestamoAplicacion`, se actualiza `prestamosAplicados` del item y `saldoPendiente` del préstamo. Si llega a 0, `estado = SALDADO`.
- Si se anula la liquidación (reversa), se anulan las aplicaciones y los saldos vuelven.

### 3.4 Historial de jornales

- Al actualizar el `jornal` o `valorHoraExtra` del legajo, el service crea una entrada en `EmpleadoJornalHistorico` con `vigenteDesde = hoy`. El legajo guarda el valor vigente (desnormalizado).
- Alternativa que descartamos: calcular el vigente al vuelo. Agrega un query en cada lectura; prefiero desnormalizar.

## 4. Caja en rojo

La caja de efectivo puede quedar negativa (el físico real manda). No se bloquea el pago. El balance se muestra en rojo en la UI. Esto ya está en la regla 8 del CLAUDE.md, acá solo lo confirmamos.

## 5. Datos existentes

El proyecto tiene una sola migración (`0_init`) y no hay data real en prod. En staging puede haber data de prueba. La migración:
- Agrega las tablas nuevas.
- Agrega columnas nuevas (`dni`, `empresaId`, `situacionFiscal`, `valorHoraExtra`) con defaults seguros.
- **Elimina `LiquidacionDia`** (DROP TABLE). Si hubiera data, se perdería; es aceptable porque es data de prueba.
- Elimina el unique de `LiquidacionSemanal`.
- Agrega `obraId NOT NULL` a `LiquidacionSemanal`. Para data existente: se setea a la primera obra activa (fallback) o se vacía la tabla si está vacía. Antes de aplicar la migración, en staging corremos `TRUNCATE liquidacionSemanal CASCADE` si hace falta.
- Migration SQL idempotente (reglas `.claude/MIGRATIONS_RULES.md`): `IF NOT EXISTS`, `EXCEPTION WHEN duplicate_object` para enums.

## 6. Preguntas abiertas (no bloquean el schema)

Siguen abiertas, se cierran con Dani y se reflejan en UI:
- Moneda del jornal y préstamos: **siempre ARS** (decisión confirmada 2026-11-11).
- Saldo a favor del empleado: ¿se compensa automáticamente o Dani lo aplica a mano? → se muestra en la ficha, aplicación manual en la próxima liquidación.
- Recibo con pago parcial: ¿lleva el total de la liquidación o solo lo pagado? → por ahora lleva el total (es un recibo semanal, no de pago). Confirmar.

## 7. Plan de implementación

| Paso | Qué | Dónde |
|---|---|---|
| 1 | Design doc (este) | `docs/sdd/liquidacion-empleados-v2.md` |
| 2 | Schema Prisma + migración SQL idempotente | `backend/prisma/` |
| 3 | Seed con empresas y categoría préstamos | `backend/prisma/seed.ts` |
| 4 | Ajustar `liquidaciones.service` para que compile con el nuevo schema | `backend/src/modules/liquidaciones/` |
| 5 | Módulo `empresas` (CRUD) | `backend/src/modules/empresas/` |
| 6 | Módulo `empleados` (sobre Beneficiario+Legajo) con historial de jornales | `backend/src/modules/empleados/` |
| 7 | Módulo `prestamos-empleados` | `backend/src/modules/prestamos-empleados/` |
| 8 | Rehacer completo `liquidaciones.service` con la nueva lógica | `backend/src/modules/liquidaciones/` |
| 9 | Enganche billetera → préstamos | `backend/src/modules/movimientos/` |
| 10 | Frontend página empleados | `frontend/src/pages/empleados/` |
| 11 | Frontend liquidaciones v2 | `frontend/src/pages/liquidaciones/` |
| 12 | Recibos PDF compactos | `backend/src/modules/recibos/` |
| 13 | Frontend billetera: concepto Préstamo a empleado | `frontend/src/pages/billetera/` |
| 14 | Build + tests + commits por fase | — |

Cada paso con su commit. Push a `develop` solo con OK explícito de Mateo.
