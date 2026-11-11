# Análisis cruzado de los 4 Excel principales — Cardi

> Cruzado el 2026-11-11 a partir de `principales/`. Sirve para alinear el modelo con la operación real de Dani antes de rehacer el schema.

---

## 1. El recorrido de un número de punta a punta

Tomemos un pago semanal real como ejemplo. Semana del 06/11/2026, obra General Paz, empleado "Gonzalez":

```
PRECIO DE JORNALES x EMPLEADO
  Gonzalez → categoría (sin asignar en la planilla, se infiere "Ayudante")
  Jornal al 15-12-2024: 42.000
  Con aumento: 50.000  ← el vigente para esta semana

RECIBO DE SUELDO (hoja "Gral Paz", fila 11-19)
  Fecha 06/11/2026 · Gonzalez
  Semana         5 × 50.000 = 250.000
  Boleto         5 × 5.000  =  25.000
  Horas extras   0 × 6.250  =       0
  Total                       275.000

PLANILLA DE CAJA (hoja "Liquidacion", columna Gastos Empresa, "General Paz")
  Paez jornales   $2.000.000
  Paez Viaticos   $50.000
  Lucas           $2.950.000
  Lechu           $35.000
  jornales        $1.225.000   ← acá entra lo de Gonzalez agrupado
  Total           $1.260.000

COSTO POR OBRA (si hubiera hoja General Paz, no existe en el excel actual
  pero el resto de obras siguen el patrón — ver hoja "Leo")
  Fecha | Jornales | Dólar blue | USD | Obra
  06/11/2026 · 275.000 · 1545 · 178.00 · General Paz
```

El número **"275.000" existe 3 veces**: en el recibo, en el agrupado "jornales" dentro de la columna General Paz de la liquidación semanal, y en el reporte por obra. En el sistema tiene que generarse **una sola vez** y propagarse a los otros dos lugares automáticamente.

---

## 2. Categorías de empleado (confirmadas en la planilla)

De la columna CATEGORIA de `Jornales $`:

| Código | Nombre en la planilla |
|---|---|
| OF_CAP | Oficial Capataz |
| OF_SOL | Oficial Soldador |
| OF_ESP | Oficial Especializado |
| OF | Oficial |
| MO_BUENO | 1/2 Oficial Bueno |
| MO | 1/2 Oficial (Medio Oficial) |
| AYU | Ayudante |

Cada categoría tiene **un jornal "de referencia" y un valor de hora extra**. Al editar el jornal de la categoría, se actualiza el de todos los empleados de esa categoría (como pidió Dani). Queda registrado con fecha en el historial de la categoría y de cada empleado.

Individualmente, cada empleado puede tener un jornal propio que difiera del de la categoría (ej. "1/2 oficial bueno" vs "1/2 oficial" son dos categorías porque algunos medio-oficiales ganan más; también hay ajustes por rendimiento).

**Casos especiales de monto:**
- **Pablo (Rialto)**: monto fijo mensual de $1.600.000, no es jornal diario. Se maneja como "monto semanal" o como contratista con pago mensual.

---

## 3. Conceptos que aparecen en los recibos (TODOS)

Esto rompe el modelo que tenía (días + hs extras + descuentos + préstamos aplicados como campos fijos). La realidad es un **conjunto flexible de ítems** por recibo. Lo que vi en los recibos:

| Tipo | Descripción | Suma / Resta | Obra imputada | Ejemplo |
|---|---|---|---|---|
| **JORNAL** | días × jornal del empleado | Suma | La obra de la liquidación | "Semana 5 × 60.000 = 300.000" |
| **JORNAL_ESPECIAL** | días × jornal distinto (otra localidad/obra) | Suma | Puede ser otra obra | "jornal VM 2 × 60.000 = 120.000" (Cochela cobra en Villa María con otro valor) |
| **HORAS_EXTRA** | horas × valor hora extra | Suma | La obra de la liquidación | "Horas extras 8 × 5.875 = 47.000" |
| **VIATICO** | pasajes, boletos, taxi, viajes | Suma | La obra de la liquidación | "Boleto 5 × 5.000", "Taxi", "Viajes y peaje 366.000" |
| **VACACIONES** | pago de días de vacaciones | Suma | Gastos generales (no de obra) | "Vacaciones 300.000" (Ariel) |
| **CERTIFICACION** | trabajo específico por monto, con descripción libre | Suma | **Obra distinta posible** | Jonas "Mon Petit 2.320.000" imputa a Mon Petit; Leo cobra jornales + "1.500.000 cert. Buena Vista 4" + "400.000 Goma" |
| **PRESTAMO_ENTREGADO** | otorgamiento de préstamo (crea saldo deudor) | Suma | Gastos generales | "Prestamo 2.000.000" (Jonas); genera un `PrestamoEmpleado` nuevo |
| **PRESTAMO_APLICACION** | descuento de préstamo existente | Resta | — | "Prestamo 80.000" (Gastón) reduce saldoPendiente |
| **VALE** | adelanto chico informal (no préstamo) | Resta o Suma (¿?) | — | "Vale" (Kike), aparece sin monto en algunos |
| **DEDUCCION** | descuento por herramientas, materiales, etc. | Resta | — | "Percutor y bateria $331772 → -165.886" (mitad) |
| **NOTA_SALDO** | nota informativa, no afecta total | Nada | — | "Prestamo saldo $70.000" (Brian) |
| **SUELDO** | monto mensual fijo (contratistas) | Suma | La obra de la liquidación | "Sueldo 850.000" (Pablo Rialto) |

### Implicancia crítica
**Un recibo = un `LiquidacionItem` (una persona) + N conceptos tipados.** No hay forma de modelar esto con columnas fijas.

Además, el total del recibo (lo que resta de la caja al pagar) **se imputa por conceptos a sus obras respectivas**, no todo a la obra de la liquidación. Caso Leo: paga de la obra "donde está liquidando esa semana" pero certifica 1.5M a Buena Vista 4 y 400k a Goma → el costo de cada una se actualiza en su columna.

---

## 4. El dólar blue en cada registro

Toda hoja de Costo por Obra, Gastos y Ingresos tiene el **valor del dólar blue a la fecha** congelado. Ya está en el modelo (`Movimiento.cotizacion`), pero confirmo que **cada movimiento necesita su cotización propia** — no es una tasa global del día aplicada en lectura.

---

## 5. El "verde / celeste" de la planilla de caja

La transcripción menciona que en la planilla:
- **Verde** = pagado con efectivo de la caja → resta de la caja de efectivo física.
- **Celeste** = transferencias / cheques → NO restan de la caja de efectivo, pero sí son costo de obra.

En el Excel esto se maneja con colores de celda. En el sistema se resuelve con el campo `medioPago` del `Movimiento` + la `caja` que afecta:
- Efectivo → caja de efectivo.
- Transferencia / Cheque → caja banco o caja cheques.

La caja de efectivo física ya no "vive" en el Excel: el saldo se deriva de los movimientos confirmados que tocan `caja.tipo = EFECTIVO`.

---

## 6. La hoja "Liquidacion" (tablero semanal de pagos)

Es lo que Dani mira el viernes antes de pagar. Estructura observada:

```
Columnas agrupadas por "bloque":
  - Ingreso (col A-B)
  - Gastos Empleados (col C-D)
  - Gastos Empresa (col E-F)
  - Rialto Complejo (col G-H)
  - Bowuer (dentro de Rialto)
  - Toto (col I-J)
```

Cada bloque tiene su total al pie. El total del bloque "Gastos Empleados" = lo que se descuenta de caja esa semana por sueldos (es el agregado de todas las liquidaciones semanales). La línea **"Bower plomeria ≈ 1 millón"** mencionada por Dani corresponde al total de la liquidación de obra "Bower → Plomería".

En el sistema esto se produce como **dashboard**: para la semana X, sumar liquidaciones por obra + otros egresos. No es una entidad que tenga que persistirse.

---

## 7. Nombres y apodos (migración)

Los nombres en las planillas son muy informales:
- Apodos: "Leo", "Momo", "Pizza", "Pinino", "Cochela", "Kike", "Mami", "Toto".
- Nombre + obra entre paréntesis: "JUAN JOSE GARCIA (C. Paz)" (en nómina de Duwhite, aplica también acá).
- Variantes del mismo: "Brian" / "Braian" / "Bryan"; "Gaston" / "Gaton" (typo); "Jornales" como persona genérica.
- Nombres genéricos tipo "Mami", "Dani", "Nacho" (familia / asociados).

El modelo ya tiene `BeneficiarioAlias` → bien. Durante la migración vamos a necesitar un paso humano para resolver cada nombre al beneficiario correcto.

---

## 8. Obras

Lista real (40 obras en Costo por Obra): Buena Vista IV, Namba, Mon Petit, Droma, Stefano VIII, Leo, Galpones Brasil, Derki, Bior, Buena Vista III, Wo, BIro Oliva, Vigore Pilar, Stefano V, Stefano VI, Neper, Cibeles, Paseo Quatro, Buenos aires, Jesus María, Ortiz y Herrera, Constantino VI, Buena Vista, Buena Vista II, Reggio, Cañitas Ruben Mers, Bere 4, Avellaneda, Florida, Cañitas Olmedo, Sileno, Alante Leones, Tucuman, Mont Oncativo, James Craik, Marcos Juarez, Matienzo, Jose Ing, Cañuelas-Scurti, Friulli.

El seed actual tiene 17 obras (General Paz, Mont Petit, Rialto, Doma, Bower, Galpones Brasil, Tierra Alta, Fonte, Bior, Namba, Namba 2, Duvet, Impero, Reggio, Vicente, Stefano, Gastos generales). Hay inconsistencias:
- **Mont Petit** (seed) vs **Mon Petit** (planilla) — uniformar a "Mon Petit".
- **Doma** (seed) vs **Droma** (planilla) — uniformar a "Droma".
- **Bower** (seed) vs **Bowuer** (planilla) — uniformar.
- **Stefano** aparece como VIII, V, VI → son obras distintas, no una sola.
- Faltan: Buena Vista, II, III, IV; Derki; Wo; Neper; Cibeles; Paseo Quatro; etc.

**Obra "Varios"** mencionada por Dani: para "gente que reparte tareas en varias obras o trabajos puntuales para clientes que no son obras en sí". Agregar al seed como obra tipo `UNIDAD_NEGOCIO` o nueva tipo `VARIOS`.

---

## 9. Pagos parciales confirmados por la planilla

Hoja `Contratistas`, caso Jonas:
```
Jonas Mon Petit     2.320.000   (jornales/certificación de la semana)
Prestamo            2.000.000   (otorgamiento de préstamo)
Total               4.320.000   (lo que se le entrega en efectivo)
```

El préstamo entregado **suma** al total del recibo. Después, en liquidaciones futuras, el `PRESTAMO_APLICACION` resta del total hasta saldarlo. Confirma el flujo del punto 3.

Caso **saldo a favor** (Ariel 3.000.000 certificado, 1.500.000 pagado esta semana, 1.500.000 pendiente): confirma `PAGADA_PARCIAL`. El saldo pendiente queda en la cuenta del empleado.

---

## 10. Inconsistencias detectadas

- **Mon Petit / Mont Petit / Mont oncativo** son 3 cosas distintas, pero en el seed hay solo "Mont Petit". Aclarar con Dani.
- **Leo 75.000** confirmado en nómina; **Pablo (Rialto) 1.600.000** es monto fijo, no jornal diario.
- En "Jornales 2024" hay nombres duplicados: "Gaston" y "Gaston Rodriguez" (son dos personas distintas).
- En "Jornales $" hay typo "Gaton" (una fila vacía) que probablemente es "Gaston".
- La mención "Oliva 10 millones" (planilla con montos mal cargados) todavía no la vi en los principales — debe estar en `obras-historicas/` cuando aparezca.
- Montos históricos en USD mencionados por Dani (jornales USD 400): no aparecen en los principales que leí; probablemente en planillas 2023 y anteriores.

---

## 11. Preguntas abiertas para Dani (con mi recomendación)

1. **"VM" = Villa María**? ¿Tiene su propio jornal fijo o depende del empleado? Mi lectura: cada empleado tiene un valor distinto para VM (caso Cochela: 50.000 normal / 60.000 VM). → Modelar como **jornal especial por obra** en el recibo, no como atributo del empleado.
2. **"Vale"** aparece sin monto en algunos recibos (ej. Kike). ¿Es adelanto en efectivo que después se descuenta? ¿Un préstamo chico?
3. **"Percutor y bateria $331.772 → -165.886"** (Pablo Rialto): se le descuenta la mitad. ¿Es un acuerdo informal? ¿Hay que modelar "compartir herramienta"? → Por ahora dejar como `DEDUCCION` libre con descripción.
4. **Pablo Rialto = 1.600.000** fijo mensual: ¿contratista con pago mensual, o empleado con `montoSemanal`? → Modelar como `montoSemanal` (existe el campo) o como contratista con `ContratoCuota` mensual.
5. **Agrupaciones de la nómina (VCP / Cordoba / Herreros / Rialto)**: ¿son localidades, cuadrillas, o grupos de capataz? → Probablemente cuadrillas/grupos. Agregar campo `grupo` o manejarlo con `obraActualId`.
