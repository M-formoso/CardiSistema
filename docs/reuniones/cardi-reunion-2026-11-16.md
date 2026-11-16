# Cardi — Reunión con Dani (16/11/2026)

> Proyecto: sistema a medida de Cardi (Dani y Marcelo) — `sistemaCardi`
> Fuente: transcripción de la reunión de revisión de la primera versión
> Objetivo de este documento: que una IA (Claude Code) entienda qué hay que desarrollar, en qué orden y con qué reglas de negocio.

---

## 1. Resumen ejecutivo

Dani probó la primera versión y la validó en general. Los cambios se concentran en cuatro frentes:

1. **Certificaciones flexibles**: poder pagar a cualquier empleado por jornales y, además, por trabajos "por tanto" (subcontratista) repartidos en varias obras, en una sola certificación.
2. **Préstamos a empleados con cuotas**: registrar el préstamo en la certificación del viernes y descontar cuotas automáticamente (opcionales) en las semanas siguientes.
3. **Cajas y cheques**: dejar tres cajas por medio de pago, que el cheque cargado sume a la caja de cheques, y que al pagar con cheque se pueda repartir el monto entre varias obras.
4. **Proveedores y cuenta corriente**: módulo nuevo para cargar el resumen que manda cada proveedor, imputar pagos por obra y ver el saldo.

Compromiso: Mateo entrega mañana con **el sistema en cero** (sin datos de prueba) para que Dani pruebe de nuevo.

---

## 2. Prioridades (orden sugerido de ataque)

| # | Tarea | Prioridad | Por qué |
|---|---|---|---|
| 1 | Limpiar datos y dejar las cajas finales | P0 | Condición para la próxima prueba de Dani |
| 2 | Conectar la cartera de cheques al egreso + que el cheque sume a la caja | P0 | Hoy está roto en la demo: el cheque no aparece al elegir caja cheques |
| 3 | Egreso con reparto por obra (varias líneas obra + monto) | P0 | Es el flujo diario de pago a proveedores |
| 4 | Certificación modo "subcontratista / por tanto" | P0 | Caso Leo y Ariel, lo pidió explícitamente |
| 5 | Préstamos con cuotas y descuento en la certificación | P0 | Lo pidió probar ya ("probémoslo") |
| 6 | Módulo Proveedores y cuenta corriente | P1 | Mateo lo propuso; Dani lo aceptó con matices (ver decisiones abiertas) |
| 7 | Anular movimientos con motivo, editar, reimprimir certificación editada | P1 | Control y trazabilidad |
| 8 | Simplificar la vista de saldos (sacar equivalente en dólares) | P2 | Cambio de UI chico |
| 9 | Botón "gasto general" que reparte entre todas las obras | P2 | Caso IPF |

---

## 3. Requerimientos detallados

### 3.1 Certificaciones: modo normal vs. subcontratista

**Problema.** Leo es empleado (oficial especializado) y a la vez subcontratista. En una misma semana trabajó 4 días con horas extras en "obras generales" y además cobró como contratista en otras obras (se mencionan Buena Vista 4 y Roma). Esa plata de contratista es un monto global (ejemplo: 1,5 M) que él reparte entre su gente; no es detalle de jornales, pero Dani necesita el número para la liquidación y la certificación final con él.

**Qué construir.**
- Al crear una certificación, **antes del paso 1** (obra y semana), un selector: `Normal` / `Subcontratista (por tanto)`.
- Disponible para **toda la nómina**, no solo para Leo o Jonás. Ejemplo: Ariel hizo la instalación de sanitarios en Roma por tanto, y la misma semana se le pueden pagar los días.
- En modo subcontratista, la certificación permite **N líneas**, cada una con:
  - `obra` (obligatoria)
  - `monto`
  - `descripción` libre (qué trabajo se paga)
- En la misma certificación conviven los **jornales** (días + horas extras) y las **líneas por tanto**. Una sola certificación por persona y semana, no dos.
- El monto por tanto **no se cargaría como gasto desde la obra**; se carga desde la certificación y se imputa a la obra elegida en cada línea.
- Guardar un acumulado por persona y obra de lo pagado por tanto, para la certificación final con el subcontratista.

**Criterios de aceptación.**
- Certificación de Leo, semana 16 al 22: 4 jornales + extras en Obras Generales, más una línea de 400.000 en otra obra con descripción. El total suma ambos y cada obra recibe su parte.
- Se puede elegir cualquier empleado de la nómina en modo subcontratista.

### 3.2 Préstamos a empleados

**Flujo real de Dani.** El viernes paga la semana y, si el empleado pide, le hace un préstamo en ese momento.

**Qué construir.**
- Dentro de la certificación, sección **Préstamo**: monto + cantidad de cuotas (semanas). Ejemplo: 100.000 en 4 cuotas de 25.000.
- Al guardar se crean **la certificación y el préstamo juntos**. Al pagar la certificación, Dani elige la caja de donde sale el jornal y la caja de donde sale el préstamo (puede ser una caja general).
- **Saldo deudor por empleado**: cuánto debe, cuotas pagadas y pendientes.
- En la certificación siguiente, **alerta automática**: "Adrián debe la cuota 1 de 4 del préstamo de 100.000: 25.000".
  - La cuota es **opcional**: un checkbox para aplicarla o no (a veces el empleado pide que no se le descuente esa semana).
  - Si no se aplica, la deuda sigue y la cuota pasa a la próxima semana (el plan se corre).
- **Compensación, no ingreso**: el descuento reduce el neto a pagar. No entra plata a ninguna caja. Ejemplo: le corresponden 400.000, se descuenta 25.000, sale de la caja 375.000 y la cuota queda marcada como pagada.

**Criterios de aceptación.**
- Préstamo de 100.000 en 4 cuotas. Semana siguiente: alerta, se aplica, egreso de caja = neto, saldo deudor = 75.000.
- Semana sin descuento: el saldo no cambia y la alerta vuelve la semana siguiente.

**Descartado en la reunión.** Registrar el préstamo como egreso con categoría "Préstamo" desde la billetera. Dani prefiere hacerlo en la certificación.

### 3.3 Cajas

- Dejar **solo** estas cajas para arrancar: **Caja Efectivo**, **Caja Cheques**, **Caja Transferencia**. Dani también mencionó una **Caja Dólares**: confirmarla.
- Eliminar las cajas de prueba (Banco Macro, Caja Dani, Caja Marce y otras).
- Las cajas se organizan **por medio de pago, no por persona**. La plata viene de muchos lados (clientes, terceros, cambios del hermano) y no le interesa separarla por dueño.
- Se mantiene la función de alta y edición de cajas (ya existe en Billetera, Herramientas, Cuentas).
- **A futuro (no ahora):** usuario secretaria con su propia caja, y que Dani le pueda transferir efectivo y cheques desde el sistema.

### 3.4 Cheques

**Carga.** Nuevo cheque: número, banco, titular, monto, fecha de emisión, fecha de pago. El **beneficiario no es obligatorio** al cargarlo: entra a la cartera propia y se asigna después.

**Gap detectado en la demo.** Hoy el cheque cargado queda en la cartera pero **no suma a ninguna caja**. Dani espera que, al cargarlo, aparezca en el saldo de **Caja Cheques**.

**Pago con cheque (egreso).**
1. Nuevo egreso, caja = Caja Cheques.
2. El sistema lista los **cheques en cartera** y se elige uno o varios. *En la demo no aparecía el cheque de 2 M: falta conectar esto.*
3. Se elige el proveedor.
4. Se reparte el monto en **N líneas obra + monto**. En el egreso, el campo "categoría" se reemplaza por **obra**.
5. Se muestra en vivo el **disponible restante** del cheque mientras se reparten las líneas.

**Ejemplo real (Prolectric).** Cheque de 2.000.000: 1.709.xxx a la obra Río Alto (liquidar total) y la diferencia (~291.000) a cuenta de la obra Galileo.

### 3.5 Proveedores y cuenta corriente (módulo nuevo)

**Alcance acordado.** Solo **pagos y saldos**. Compras, solicitudes, cotizaciones y órdenes de compra quedan para mucho más adelante.

**Qué construir.**
- Lista de proveedores con **debe / haber / saldo** a primera vista.
- Detalle del proveedor:
  - **Carga del resumen de cuenta corriente** que manda el proveedor: fecha, monto total y desglose por obra. Ejemplo: Casa Santos al 15/11 con 3.239.000 repartido en obras.
  - El resumen es una **foto de referencia** a una fecha; no se actualiza todos los días.
  - **Subcuentas por obra** dentro del proveedor.
  - **Pagos imputados** a una o varias obras, totales o parciales, o a cuenta.
  - **Saldo = último resumen cargado − pagos posteriores**, total y por obra.
  - Historial: qué se pagó, con qué (cheque o efectivo), a qué obra y cuándo.
- **Doble canal**: el pago se puede registrar desde Billetera (nuevo egreso) **y** desde Proveedores, igual que hoy la certificación se paga desde su propia pantalla. Ambos impactan la misma caja.
- **Pagos múltiples**: varios proveedores de una vez desde la sección Proveedores.
- **Gasto general**: botón para repartir un pago entre todas las obras (caso IPF). Dani aceptó partes iguales.

### 3.6 Billetera: movimientos

- Al tocar un movimiento, abrir un **modal de detalle** más grande.
- **Anular con motivo obligatorio** (no borrar sin dejar rastro).
- **Editar** movimientos.
- Al **editar una certificación**, se puede **reimprimir** con los datos actualizados.

### 3.7 Saldos de caja (UI)

- Mantener el **saldo** y los **ingresos** como están.
- **Sacar el equivalente en dólares** que aparece al lado del saldo. Si hay dólares, van en su propia caja.
- Vista más simple y limpia.

---

## 4. Decisiones abiertas (validar con Dani antes o durante la próxima prueba)

1. **Cuenta corriente del proveedor.** Dani dijo al principio que no cargaría lo que debe porque los saldos cambian todo el tiempo. Mateo explicó que sin el resumen no hay saldo, y se avanzó con la propuesta, pero Dani no lo confirmó de forma explícita. Mostrarlo funcionando y validar.
2. **Caja Dólares.** Pidió tres cajas (efectivo, cheques, transferencia) y después nombró una de dólares. Confirmar si son tres o cuatro.
3. **Gasto general en partes iguales.** Aceptó, pero las obras tienen tamaños muy distintos. Proponer como opción reparto proporcional o manual.
4. **Editar vs. anular.** Pareció preferir anular con motivo antes que editar libremente. Sugerencia: permitir editar dejando registro de auditoría (quién, cuándo, valor anterior).
5. **Cuota no aplicada.** Definir si el plan se corre una semana o si la cuota se acumula con la siguiente. Propuesta: se corre.

---

## 5. Gaps y riesgos detectados

- **Cheque no conectado al egreso** (falló en vivo). Es lo primero a resolver.
- **Cartera de cheques sin impacto en caja**: el modelo tiene que tratar el cheque como un valor dentro de Caja Cheques, con estados (en cartera, entregado, depositado o cobrado).
- **Préstamo como compensación**: la certificación tiene que registrar bruto, descuentos y neto, y la caja egresa solo el neto. Si se registra como ingreso más egreso, los saldos de caja quedan inflados.
- **Imputación por obra en tres lugares** (certificación por tanto, egreso con cheque, pago a proveedor): conviene un solo componente y un solo modelo de "líneas de imputación por obra" reutilizado en los tres.
- **Reset a cero**: hacerlo con script o seed reproducible, no a mano, porque va a hacer falta de nuevo en cada ronda de prueba.

---

## 6. Próximos pasos

- [ ] Mateo: reset de datos y cajas finales.
- [ ] Mateo: implementar del P0 al P2 de la tabla de prioridades.
- [ ] Mateo: avisar a Dani cuando esté listo y coordinar una nueva reunión.
- [ ] Dani: probar con datos reales (Leo, Ariel, Adrián, cheque de Prolectric, resumen de Casa Santos).

---

## 7. Glosario y datos del caso

- **Personas:** Dani (cliente, usuario principal), Marcelo (hermano), Leo Fernández (oficial especializado y subcontratista), Jonás, Ariel/Adrián (empleado del ejemplo de préstamo; en la transcripción aparece con los dos nombres), Juan Pablo.
- **Proveedores:** Casa Santos, Prolectric, IPF.
- **Obras mencionadas:** Obras Generales, Buena Vista 4, Roma, Río Alto, Galileo. *Algunos nombres pueden estar mal transcriptos (por ejemplo "Bior", "Doman", "Tierra Alta"): confirmar contra las obras cargadas.*
- **"Por tanto":** trabajo pagado por monto global acordado, no por jornal.
