# SDD: Módulo Proveedores + Cuenta corriente (#9)

**Fecha**: 2026-11-16
**Alcance**: reunión 16/11 sección 3.5 — **solo pagos y saldos** (no compras/OC/cotizaciones)
**Decisión de arranque**: Mateo confirmó que el módulo se desarrolla con la interpretación #1 (proveedores + cta cte), no el módulo general de compras (que está fuera de scope en CLAUDE.md §2).

---

## 1. Lo que ya existe (no construir)

- **`Beneficiario`** con `tipo = PROVEEDOR`: los proveedores ya viven ahí. Casa Santos, Prolectric, IPF se cargan como beneficiarios.
- **`Movimiento` (EGRESO) + `Imputacion[]`**: el flujo de pago a proveedor es exactamente un egreso con `beneficiarioId = proveedor` + reparto por obra. **Ya funciona end-to-end** (lo acabamos de arreglar con el pago con cheque).
- **`MovimientosService.findAll`** ya filtra por `beneficiarioId` — listar los pagos a un proveedor es una query sin cambios.
- **Botón "Gasto general"** en `NuevoEgresoDialog` (#12): reparte un monto entre todas las obras activas en partes iguales. Funciona desde cualquier flujo de egreso, incluido el de pago a proveedor.

**Lo único nuevo que hace falta es la "foto" del saldo (resumen) que manda el proveedor**. Todo el resto es composición de piezas existentes.

---

## 2. Modelo de datos (2 entidades nuevas)

```prisma
/// Foto del estado de cuenta de un proveedor en una fecha. Lo manda el
/// proveedor cada tanto (no se actualiza todos los días). Usada para
/// calcular el saldo = resumen - pagos posteriores.
model ProveedorResumen {
  id            String   @id @default(uuid())
  proveedorId   String   // Beneficiario tipo PROVEEDOR
  fecha         DateTime @db.Date
  montoTotal    Decimal  @db.Decimal(14, 2)  // suma de los items, se recalcula al guardar
  observaciones String?

  proveedor Beneficiario @relation(fields: [proveedorId], references: [id])
  items     ProveedorResumenItem[]

  createdById String?
  updatedById String?
  createdBy   Usuario? @relation("ResumenCreadoPor", fields: [createdById], references: [id])
  updatedBy   Usuario? @relation("ResumenActualizadoPor", fields: [updatedById], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([proveedorId, fecha])  // 1 resumen por fecha por proveedor
  @@index([proveedorId, fecha])
}

/// Línea del resumen: cuánto debíamos por cada obra al cliente a esa fecha.
model ProveedorResumenItem {
  id        String  @id @default(uuid())
  resumenId String
  obraId    String
  monto     Decimal @db.Decimal(14, 2)

  resumen ProveedorResumen @relation(fields: [resumenId], references: [id], onDelete: Cascade)
  obra    Obra             @relation(fields: [obraId], references: [id])

  @@unique([resumenId, obraId])
  @@index([obraId])
}
```

**Lo que NO hay**: `ProveedorPago` separado. El pago **es** un `Movimiento` EGRESO. No duplicamos modelo.

---

## 3. Cálculo del saldo (la lógica)

```
Saldo total del proveedor:
  (último resumen cargado).montoTotal
  − Σ (movimientos EGRESO CONFIRMADO con beneficiarioId=proveedor y fecha >= resumen.fecha).monto

Saldo por obra:
  (último resumen).items[obra].monto
  − Σ (imputaciones.monto de esos mismos movimientos, agrupadas por obra)

Casos borde:
  - Si no hay ningún resumen cargado: saldo = − Σ pagos (negativo informativo:
    "les hemos pagado X sin tener saldo cargado"). UI muestra banner "Cargá el
    primer resumen para calcular el saldo real".
  - Si una obra tiene pagos pero no está en el último resumen: aparece con
    saldo negativo (pagamos de más contra lo que figuraba en la foto).
```

**Fechas**: convención `>=`. Un resumen con fecha 15/11 incluye todo hasta el 14/11; los pagos del 15/11 en adelante se restan. Alineado con "la foto es a las 00:00 del día".

---

## 4. Backend: módulo `proveedores`

Un solo controller + service. Endpoints:

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/proveedores` | Lista: `[{ id, nombre, cuitCuil, ultimoResumenFecha, saldoTotal, cantPagosRecientes }]` — con saldo calculado |
| GET | `/proveedores/:id` | Detalle: proveedor + último resumen + saldos por obra + lista de resúmenes históricos + pagos recientes |
| POST | `/proveedores/:id/resumenes` | Body: `{ fecha, items: [{obraId, monto}], observaciones? }` — crea resumen; unique [proveedorId, fecha] |
| DELETE | `/proveedores/:id/resumenes/:resumenId` | Elimina (caso "cargué mal, quiero rehacer"). Cascade borra items |

Permisos: `proveedores:ver` para GET, `proveedores:editar` para POST/DELETE. Default CARGA = ambos (no es sensible como anular movimientos).

**Pagos**: **sin endpoint propio**. Se usa el existente `POST /movimientos/egresos` con `beneficiarioId = proveedor` + `imputaciones` que reparten entre obras (o una sola).

---

## 5. Frontend: página + detalle

### 5.1 `/proveedores` (lista)
- Tabla: Nombre · CUIT · Último resumen (fecha) · **Saldo total** · [Ver detalle]
- Botón "Nuevo pago a proveedor" → abre `NuevoEgresoDialog` con el beneficiario tipo PROVEEDOR pre-seleccionable
- Filtro: buscar por nombre

### 5.2 `/proveedores/:id` (detalle)
Tres secciones:

1. **Resumen actual**
   - Si hay resumen: fecha + tabla por obra con `resumen − pagos posteriores = saldo actual`, total abajo
   - Si no hay: banner "Cargá el primer resumen"
   - Botón "Cargar nuevo resumen" → dialog con fecha + N líneas obra+monto (reusar el patrón visual del reparto por obra)

2. **Historial de pagos**
   - Tabla de movimientos EGRESO con `beneficiarioId = este proveedor`, estado = CONFIRMADO
   - Click en fila → abre el `MovimientoDetalleDialog` existente (que ya muestra todo, incluye cheque si pagaste con uno)
   - Botón "Nuevo pago" → `NuevoEgresoDialog` con beneficiario pre-seleccionado

3. **Resúmenes históricos** (colapsable)
   - Lista de resúmenes anteriores con fecha + monto total
   - Click → abre modal solo-lectura con el desglose por obra
   - Botón "Eliminar" solo en el más reciente (para corregir el último cargado)

### 5.3 Sidebar
- Nuevo item "Proveedores" entre "Empleados" y "Certificaciones" (o donde tenga sentido).

---

## 6. Decisiones que tomo por default (si no las corregís)

| # | Default | Razón |
|---|---|---|
| D1 | 1 resumen por fecha por proveedor (unique) | Evita ambigüedad. Si querés corregir, eliminás y cargás de nuevo. |
| D2 | Pagos van por el endpoint de egresos existente, sin modelo propio | Reusa todo el flujo (incluido pago con cheque + reparto). Cero duplicación. |
| D3 | Sin importar resúmenes desde Excel en V1 | Carga manual. Si Dani lo pide después, se agrega. |
| D4 | Sin pagos múltiples a varios proveedores en un solo click | El flujo de "un egreso por vez" cubre el 90%. V2 si aparece el caso. |
| D5 | Cuando no hay resumen, saldo = −Σ pagos (negativo) con banner | Evita bloquear el módulo si Dani tarda en cargar el primer resumen. |
| D6 | Permiso `proveedores:editar` para crear/borrar resúmenes = CARGA por default | No es sensible como anular; el ADMIN sigue bypaseando todo. |

---

## 7. Lo que necesito que confirmes antes de arrancar código

**Solo dos cosas**:

1. **¿El modelo propuesto te cierra?** Dos tablas nuevas (`ProveedorResumen` + `ProveedorResumenItem`), reutilizando Beneficiario y Movimiento para todo lo demás. No creo `ProveedorPago`.
2. **¿La UX de "sin resumen = saldo negativo con banner"** (D5) está bien, o preferís que sin resumen no se muestre saldo en absoluto?

Si están OK, arranco por **modelo + migración + endpoints backend** y después frontend.

---

## 8. Plan de implementación (secuencia)

1. **Migración Prisma**: dos tablas nuevas + unique + índices. SQL idempotente.
2. **Módulo backend**: `proveedores.module.ts`, controller, service, DTOs. Cálculo de saldo con una query agrupada (`$queryRaw` o agregación en service).
3. **Frontend service** + types en `proveedoresService.ts`.
4. **Página lista** + item en sidebar.
5. **Página detalle** con las 3 secciones.
6. **Dialog "Cargar resumen"** (reutilizando patrones de reparto por obra).
7. **Build + type-check + lint** + commits chicos (mismo patrón de la sesión).

Estimación: ~600-800 líneas totales + migración. 1 sesión focalizada.

---

## 9. Lo que NO está en V1 (diferido, queda por escrito)

- Compras / OC / cotizaciones (CLAUDE.md §2 — nunca en v1).
- Pagos múltiples a varios proveedores en un solo paso.
- Import de resúmenes desde Excel.
- Alertas de vencimiento de pago a proveedor.
- Flujo de reclamos / notas de crédito.
