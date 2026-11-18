# Cardi — Reunión de revisión con Dani (18/11/2026)

## Contexto
- Dani probó el sistema después del reseteo: movimientos en cero. Se mantuvieron los datos base (cajas, empleados, proyectos).
- Dani está cargando una caja real que imprimió para validar el flujo, y anota lo que va encontrando.
- Compromiso de Mateo: **entre hoy y mañana (19/11)** implementar estos cambios y cargar los datos reales desde principios de octubre hasta hoy.

## Lo más importante (prioridad para atacar)
1. **Egreso por tipo de gasto** (Proveedor / Servicio, con Vehículo como rama de Servicio): es el cambio estructural más grande y define cómo se van a importar los datos de 2026.
2. **Campo Origen (empresa que paga)** en ingresos y cheques, con obra opcional y categoría editable.
3. **Proveedores sin cuenta corriente**: sólo registrar pagos. Hay que ocultar el resumen y arreglar el saldo negativo.
4. **Sección Vehículos** con el detalle de gastos por vehículo.
5. **Formato moneda** en todos los inputs de monto.
6. **PDF imprimible** de la billetera filtrada.
7. **Carga de datos reales** (octubre a noviembre) para que Dani pruebe con datos de verdad.

---

## 1. Ingresos
- **Medio de pago autocompletado según la caja.** Si elige la caja Efectivo, el medio queda en efectivo; si elige Transferencia, queda en transferencia. Hoy es repetitivo.
- **Formato moneda mientras escribe**: separador de miles y 2 decimales. Va en todos los montos del sistema (ingresos, egresos, cheques, certificaciones), porque a Dani se le escapan ceros de más.
- **Origen = empresa que paga** (Grupo Fonte, Marcelo Picardi, Astori, etc.):
  - Lista desplegable con botón **"+" para dar de alta un origen nuevo** desde el mismo modal.
  - **Bug:** hoy el origen está vinculado a empleados. Hay que desvincularlo.
- **Obra opcional.** Hay pagos que no son de una obra puntual (por ejemplo Astori, o ingresos de Marcelo).
  - Uso real: Fonte paga 1,5 M de Luca y 1,5 M de Mont Petit. Dani necesita responderle a Marcelo "¿cuánto nos pagó Fonte de Luca?".
- **Categoría:**
  - Arranca con la lista vacía, con "+" para agregar (mano de obra, devoluciones de IVA, "mensual Marce").
  - Lo que se carga queda guardado para la próxima vez.
- En la billetera y en el reporte por obra tienen que verse el **origen** y la **obra** de cada ingreso.

## 2. Egresos
### Flujo nuevo: primero el tipo de gasto
Fecha, caja, monto, después **tipo**, y según el tipo se abre la subdivisión:
- **Servicio:** abre la lista de servicios (EPEC, Rentas, Municipalidad, Alquilo Todo, etc.). El detalle va en la descripción (por ejemplo "alquiler de andamios").
- **Proveedor:** abre la lista de proveedores, **sin mostrar deuda**. Se elige el proveedor, el monto y la obra o las obras.
- Profesionales (por ejemplo "Arquitecto Nacho") van como categoría o servicio propio.

### Categorías
- Se **filtran según el tipo**. Si es Servicio, no tienen que aparecer "Jornales" ni "Gastos generales".
- Botón "Nueva categoría" (con código y nombre) y **opción para eliminar**.
- Las categorías iniciales salen del Excel: rentas, municipalidad, patentes, expensas, seguros, IIBB, IVA, 931 de cada empresa, etc.

### Gasto general
- El reparto se hace **sólo entre obras activas**: Dani va a quedarse sólo con las activas.
- Queda como está hoy: reparte automáticamente y deja ajustar a mano mostrando la diferencia. Dani dijo que está bueno y que lo prueben así.
- El reparto por porcentaje (por ejemplo 50 % a Fonte y el resto distribuido) lo propuso Mateo. Dani no lo pidió explícitamente; queda como opción.

## 3. Vehículos (sección nueva)
- Sección lateral parecida a Proveedores: lista con nombre, modelo y patente. **La nómina ya la pasó Dani** en los archivos.
- El detalle de cada vehículo muestra todos sus egresos (seguro, rentas, municipalidad, mecánica).
- **Servicios vinculados a vehículo:** Seguro, Municipalidad, Rentas y **Mecánica general**.
  - La mecánica no se desglosa: cubiertas, motor y chapa/pintura van en la descripción (por ejemplo "Toyota, cambio de cubiertas").
- Cuando el servicio está vinculado a vehículos, aparece la lista para **elegir uno o varios**. Ejemplo: el seguro mensual o IPF se reparten entre varios.
- Si el servicio no está vinculado (por ejemplo Rentas por IIBB), **no aparece la nómina** y se imputa a obras.
- Al crear una categoría de servicio, tiene que haber un **checkbox "relacionado a vehículos"**.

## 4. Cheques
- **Bug de diseño:** en el alta del cheque hay que sacar "Beneficiario" (que trae empleados) y poner el mismo componente que en ingresos:
  - **Origen** (empresa que lo dio: Fonte, Marce) **+ obra opcional**. Si lo da Marcelo para un tercero, puede no tener obra.
- **Botón "Pagar / Derivar"** en el modal del cheque nuevo, además de "Crear cheque":
  - Registra la entrada y lleva directo al egreso a proveedor (Casa Santo, etc.), con reparto entre obras.
  - Así no tiene que salir y volver a entrar. Casa Santo se paga casi siempre con cheque.
- **Egreso con caja Cheques:** se elige el cheque de la cartera, el monto se autocompleta y después se elige destino (proveedor o servicio) y obras.

## 5. Proveedores
- **Ocultar (no borrar)** "Cargar nuevo resumen" y la cuenta corriente. Dani lo quiere dejar escondido para cuando tenga secretaria.
  - Motivo: los resúmenes no coinciden con los pagos (pagos postergados, cheques por montos distintos). Lleva la previsión en su planilla.
- En su lugar, botón **"Registrar pago"** con el mismo modal del egreso.
- **Bug:** pagar a un proveedor sin resumen deja un **saldo de -100**.
- Período o factura que se paga: **va en la descripción libre** (Dani lo confirmó). No hacen falta campos extra.

## 6. Billetera, filtros e impresión
- Filtro por **obra + categoría/proveedor**. Ejemplo: "pagos a Fadepa de Tierra Alta" desde la billetera, sin entrar a la obra.
- **Bug:** con la obra Droma y el beneficiario Casa Santo, el filtro no trae el movimiento que se registró.
- **Botón "Imprimir"** al lado de "Limpiar": genera un **PDF con logo** de los movimientos filtrados. Es interno; Dani lo imprime para hacer anotaciones.

## 7. Certificaciones
- Inputs numéricos **sin el 0 por defecto** (días, cantidades): campo vacío para escribir directo. En la impresión, el 0 confunde.
- Obra por línea: después de la explicación, Dani **aprobó que quede como está**. Un subcontratista puede certificar por Bior y aparte dos días en Droma.
- **Comprobante de pago:** algunos montos se desbordan o desalinean. Hay que acomodar el tamaño.
- Ya están configurados 4 comprobantes por hoja. Falta probarlo con varios.

## 8. Carga de datos reales (próximo paso)
- Fuente: **Planilla de cajas → pestaña "Gastos 2026"**, cargada hasta el **13/11**. Cargar **desde principios de octubre a hoy**.
- Ahí aparecen obras como Casa Dani, Power/Bower, Alto General Paz, Bior, Droma, Mont Petit, Luca, Rialto y Tierra Alta.
- Pestaña **"Ingresos 2026"**: ingresos por obra, por persona y por cliente, **actualizados al dólar**.
- Criterio acordado: en la importación, Mateo marca los casos dudosos ("esto es proveedor / servicio / obra") y Dani los corrige. Esa primera corrección fija los criterios para la importación masiva de todo 2026.
  - Ejemplo: "Andamios" en el Excel en realidad es el servicio **Alquilo Todo**, con "alquiler de andamios" en la descripción.

## Fuera de alcance de esta versión (anotado para el futuro)
- Secretaria que cargue las facturas por vehículo (por ejemplo IPF) con más detalle.
- Cuenta corriente de proveedores con conciliación del resumen.
- Empleados que registren los retiros con foto desde el sistema, conciliados contra el resumen del proveedor.
- Esto refuerza el futuro módulo gerencial para Marcelo.

---

## Auditoría contra el proyecto
> No pude abrir el código de `sistemaCardi` (no se dio el acceso a la carpeta). Esta auditoría se basa en lo que se vio en la demo y en la estructura que implican los pedidos. Conviene verificarla en Claude Code.

### Bugs vistos en la reunión
| # | Bug | Dónde |
|---|-----|-------|
| B1 | Origen del ingreso vinculado a empleados | Ingresos |
| B2 | Beneficiario del cheque trae empleados | Cheques |
| B3 | Saldo -100 al pagar un proveedor sin resumen | Proveedores |
| B4 | El filtro obra Droma + Casa Santo no trae el movimiento | Billetera |
| B5 | Montos desbordados en el comprobante de pago | Certificaciones |
| B6 | 0 por defecto en los inputs numéricos | Certificaciones (y revisar el resto) |

### Cambios de modelo de datos a revisar
- **Entidad Origen / Empresa pagadora**, separada de empleados y proveedores. Se reusa en ingresos y cheques.
- **Obras con estado activo/inactivo**: hace falta para que el gasto general reparta sólo entre activas. Revisar si hoy existe el campo.
- **Categorías con `tipo`** (ingreso / servicio / proveedor / general) y **flag `vinculada_vehiculo`**.
  - **Baja lógica** (soft delete) para no romper los movimientos históricos que ya usan una categoría.
- **Tabla Vehículos** (nombre, modelo, patente) y **relación N:N movimiento–vehículo con monto por vehículo**, para repartir seguro o IPF.
- **Rentas tiene doble uso** (automotor vs IIBB/IVA/931). Recomiendo que la decisión dependa del flag de la categoría y no del nombre del servicio. Por ejemplo: "Rentas – Automotor" con flag de vehículo, y "Rentas – IIBB" imputada a obras.
- **Cheque derivado:** al pagar con un cheque, cambiar su estado (en cartera → entregado) y que no quede sumando en la caja Cheques. Esto aplica tanto al flujo "Derivar" como al egreso con caja Cheques.

### Riesgos y recomendaciones
- **Importación:**
  - Usar una tabla intermedia (staging) con una columna de clasificación sugerida y una de "dudoso", para que Dani valide antes de confirmar.
  - Que sea idempotente (por fecha + monto + descripción) para poder reimportar sin duplicar.
- **Dólar en Ingresos 2026:** confirmar que el sistema guarde la moneda y el tipo de cambio por movimiento. Si no, los reportes en pesos y en dólares no van a cerrar.
- **Feature flag para la cuenta corriente** de proveedores: queda oculta sin perder el código, como pidió Dani.
- **Formato moneda:** hacer un único componente de input de monto, reutilizado en todos los modales, para no arreglarlo módulo por módulo.
- **PDF de billetera:** que tome exactamente los filtros activos y muestre en el encabezado qué filtros se aplicaron (obra, proveedor, fechas). Si no, al imprimirlo se pierde el contexto.

## Checklist para Claude Code
- [ ] Componente único de monto con formato moneda en todos los modales
- [ ] Medio de pago autocompletado por caja
- [ ] Entidad Origen + alta inline; usarla en ingresos y cheques (quitar empleados)
- [ ] Obra opcional en ingresos y cheques
- [ ] Categorías con tipo, flag de vehículo, alta y baja lógica; filtrado por tipo de gasto
- [ ] Egreso: selector Proveedor / Servicio y la subdivisión correspondiente
- [ ] Gasto general sólo entre obras activas (estado en obras)
- [ ] Sección Vehículos (lista + detalle) e imputación a uno o varios vehículos
- [ ] Cheque: botón "Pagar / Derivar" que lleve al egreso a proveedor; estado del cheque
- [ ] Proveedores: ocultar resumen y cuenta corriente, botón "Registrar pago", arreglar el saldo -100
- [ ] Billetera: filtro por proveedor/categoría + obra; arreglar el filtro Droma/Casa Santo
- [ ] Botón Imprimir PDF con logo, según los filtros
- [ ] Certificaciones: sin 0 por defecto; arreglar el desborde del comprobante; probar 4 por hoja
- [ ] Importar "Gastos 2026" e "Ingresos 2026" desde octubre hasta el 13/11, marcando los casos dudosos
- [ ] Avisarle a Dani cuando esté listo (19/11)
