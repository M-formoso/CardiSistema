# Análisis — Planilla de Caja (Cardi)

> Fuente: `migracion/originales/planilla-caja.xlsx` (541 KB, 12 pestañas, 2023→2026)
> Fecha de análisis: 2026-11-11

## 1. Inventario de pestañas

| # | Pestaña | Rol | Filas con datos | Mapea a |
|---|---|---|---|---|
| 1 | **Liquidacion** | Resumen "a pagar esta semana", 4 bloques horizontales | 33 | No se migra (es una vista derivable desde Gastos) |
| 2 | **Lechu** | Caja / adelanto rotativo a persona "Lechu" | 12 | `Caja` + `Movimiento`s |
| 3 | **Vehiculos** | Catálogo vehículo-patente (8 vehículos) | 13 | **Fuera de v1** (etapa futura "Flota y combustible") |
| 4 | **Pagos** | Lista acumulada proveedor→monto pendiente | 1041 | **Fuera de v1** (etapa futura "Cuentas corrientes proveedores") |
| 5 | **Gastos 2026** | Libro egresos año actual, 5 cols (Fecha/Desc/ARS/Blue/USD) | 1609 | `Movimiento` tipo EGRESO + `Imputación` |
| 6 | **Ingresos 2026** | Libro ingresos año actual, mismo formato | 306 | `Movimiento` tipo INGRESO |
| 7 | **Aires wo** | Sub-planilla jornales rubro aires acondicionado | 21 | `Movimiento` tipo EGRESO (subset) |
| 8 | **Gastos 2025** | Libro egresos 2025 + columna "N° Orden" | 2069 | `Movimiento` histórico |
| 9 | **Rialto Deuda** | Histórico 2023→ de egresos obra Rialto | 50 | `Movimiento` histórico |
| 10 | **Ingresos 2025** | Libro ingresos 2025 | 462 | `Movimiento` histórico |
| 11 | **Gastos Totales 2024** | Libro 2024, menos estructurado (totales mezclados con detalle) | 2355 | `Movimiento` histórico — parser más tolerante |
| 12 | **Gastos Totales 2023** | Libro 2023, formato antiguo | 2358 | `Movimiento` histórico |

**Volumen total estimado a migrar**: ~9000 movimientos (2023-2026).

## 2. Esquema canónico del libro (Gastos/Ingresos XXXX)

Las 4 pestañas principales (`Gastos 2026`, `Ingresos 2026`, `Gastos 2025`, `Ingresos 2025`) comparten el mismo encabezado:

| Col | Nombre | Tipo | Ejemplo | Mapea a |
|---|---|---|---|---|
| A | Fecha (o N° Orden en 2025) | Date | 2026-01-02 | `Movimiento.fecha` |
| B | Descrip Gasto | string | "Jonas Mon Petit" | `Movimiento.descripcion` + resolución de beneficiarioId/obraId |
| C | Gasto en pesos | number | 1360000 | `Movimiento.monto` (si moneda ARS) |
| D | Valor dólar blue | number | 1510 | `Movimiento.cotizacion` |
| E | Gasto total en dólares | formula | =C/D | `Movimiento.montoUsd` (derivado) |

Observaciones:
- Fila 3 es un **total** (se descarta).
- La fecha a veces aparece solo en la primera fila del grupo semanal → el parser tiene que **propagar la fecha** hacia abajo.
- En las filas "título" (ej. "Gastos Empleados") no hay monto, son headers de agrupación. Se descartan.
- Montos pueden venir como `1360000` o como `"$1.360.000"` (string formateado). El parser normaliza con `/\$/`, `/\./g`, `/\,/g`.

## 3. Patrones de la descripción (parsing)

La columna "Descrip Gasto" **mezcla múltiples conceptos en una celda**. Patrones observados:

| Patrón | Ejemplo | Interpretación |
|---|---|---|
| `<persona>` | "Juampy" | Beneficiario = Juampy, categoría = JORN (si contexto es Jornales) |
| `<persona> <obra>` | "Jonas Mon Petit", "Leo Buena Vista 4" | Beneficiario = Jonas, Obra = Mon Petit |
| `<persona> <concepto>` | "Juampy Viaticos", "Juampy gastos" | Beneficiario = Juampy, Categoría = GRAL/PROF |
| `<rubro>` | "Albañileria", "Plomeria", "Fletes" | Categoría directa + beneficiario = tipo CONTRATISTA sin nombre |
| `<proveedor>` | "Epec", "YPF", "Casa Santos" | Beneficiario tipo PROVEEDOR |
| `<cliente>` (ingresos) | "Fonte", "Bior", "Namba" | Beneficiario tipo OTRO u obra con ingreso |
| `<título de grupo>` | "Gastos Empleados", "Jornales" | Fila meta — descartar |
| `<concepto con monto embebido>` | "Juampy gastos $2,000,000" | Limpiar " $xxx" del final antes de guardar |

**Conclusión**: necesitamos el `BeneficiarioAlias` y `ConceptoAlias` bien poblados antes de parsear. Si hay un alias, resuelve a Beneficiario/Categoría. Si no, queda como `OBSERVADA` para que vos confirmes.

## 4. Catálogos a cargar al sistema

### 4.1 Obras adicionales (fuera del seed inicial)

Encontradas en la planilla pero **no están en el seed actual**:

- Tierra Alta (24 menciones en Gastos 2026)
- Buena Vista 4 / BV4 (varias)
- Namba / Namba 2 / Namba 3
- Bior
- Fonte
- Impero
- Duvet / Dubet (= mismo, hay typo)
- Reggio
- Altea
- Amalfi / Amalfi 2
- Droma
- Punto de Fuga / Punto de Fuga 4
- Vicente
- VI / Vi / Vi 2 (parece misma obra con typos)
- Stefano
- Quiros
- Mirar
- Semina
- Matienzo
- Derqui
- Kempes
- Conte 7
- Citta
- Piscui
- ST8
- Monte Buey (solo 2024)
- Obra Agua Mompetit (sub-obra)
- Obra Externa Mon Petit (sub-obra)
- Obra Incendio Dubet (sub-obra)
- Casa Dani (?)
- Juampy Obra Casa (?)

**Decisión necesaria**: ¿cuáles son obras formales, cuáles son sub-obras (con obra madre), cuáles son clientes? Ver §7.

### 4.2 Beneficiarios — empleados internos recurrentes

Aparecen 10+ veces en Gastos 2026:

- Juampy (Juan Pablo?)
- Jonas
- Leo
- Paez
- Lechu (también maneja una caja propia)
- Mami
- Nacho
- Dani
- Momo
- Ivan
- Vi (persona, no obra en este contexto)
- Diego (Pintor)
- Sotelo
- Braian

Hay además grupos: **Empleados VCP** (Villa Carlos Paz) y **Empleados CBA** (Córdoba) → se registran como totales semanales, no individuales. En el sistema conviene representarlos como **categorías o conceptos de agrupación**, no como beneficiarios.

### 4.3 Contratistas por rubro

Se cargan como beneficiarios tipo `CONTRATISTA` con el rubro literal:

- Albañileria
- Plomeria
- Herreros / Herrereria (consolidar)
- Fletes
- Diego Pintor
- Innova (carteleria)
- Jony Electricista
- Sierra Buena

Cuando aparece "Albañileria" sin más dato = beneficiario genérico de ese rubro. Cuando aparece "Diego Pintor" = beneficiario específico.

### 4.4 Proveedores de materiales (de la pestaña Pagos)

Top por monto pendiente:

- Casa Santos (Jonas / Riego / Picard / Joule / Herrería) — es el mismo proveedor con 5 líneas de productos
- Sanifer ($3M)
- YPF ($2.8M combustible)
- Proelctrik ($1.4M)
- Reggio artefactos

### 4.5 Clientes / origen de ingresos (Ingresos 2026)

- Fonte, Bior, Namba, Droma, Impero, Duvet, Altea, Vicente, Mirar, Quiros, Reggio → **estos son contratantes/clientes** que pagan por cada obra, no son "obras" en sí mismas.

**Decisión**: ver §7.

## 5. Gaps detectados — qué agregar al sistema

### 5.1 Al schema (NINGUNO urgente)

El schema actual cubre todos los campos visibles de la planilla. No veo necesidad de agregar columnas nuevas al modelo `Movimiento` para absorber estos datos.

Opcional, para considerar:
- `Movimiento.encargadoId` (apunta a `Usuario`) → "Toto" aparece como columna propia en Liquidacion. Puede ser un encargado de pagos. **Esperar a ver más planillas antes de decidir.**

### 5.2 Al seed

- Cargar las ~30 obras adicionales detectadas (de §4.1)
- Cargar los ~15 empleados recurrentes (de §4.2)
- Cargar los ~10 contratistas por rubro (de §4.3)
- Cargar los principales proveedores (de §4.4)

### 5.3 A la UI (ninguno urgente)

Todos los flujos actuales soportan la carga. El único punto de fricción es que la descripción libre de la planilla mezcla cosas — pero eso se resuelve con el **diccionario de aliases** no con cambios de UI.

## 6. Diccionario preliminar de `ConceptoAlias`

Pre-cargar en `concepto_alias` para que el matching del parser funcione:

```
"Jornales"              → JORN
"jornales"              → JORN
"Empleados VCP"         → JORN
"Empleados CBA"         → JORN
"Gastos Empleados"      → JORN   (fila título)
"Albañileria"           → CONTR
"Plomeria"              → CONTR
"Herreros"              → CONTR
"Herrereria"            → CONTR
"Diego Pintor"          → CONTR
"Innova"                → CONTR  (o categoría nueva "Carteleria"?)
"Jony Electricista"     → CONTR
"Sierra Buena"          → CONTR
"Fletes"                → FLETE
"Epec"                  → SERV
"YPF"                   → COMB
"IERIC"                 → IMP
"Rentas"                → IMP
"Seguros"               → SERV
"Alquiler deposito"     → SERV
"Casa Santos"           → MAT
"Reggio artefactos"     → MAT
"Sanifer"               → MAT
"Proelctrik"            → MAT
"Juampy Viaticos"       → GRAL   (viáticos del encargado)
"Paez Viaticos"         → GRAL
"Juampy gastos"         → GRAL
"Abogados"              → PROF
"Ingeniero"             → PROF
```

## 7. Decisiones pendientes para vos

1. **"Fonte", "Bior", "Namba", "Duvet", "Impero", "Reggio", "Vicente", "Stefano"**: ¿son **clientes** (contratantes que pagan por una obra) o **obras formales** (proyectos)? Impactan diferente: cliente → Beneficiario tipo OTRO; obra → tabla Obra.

2. **"Tierra Alta"**: 24 menciones, parece una obra activa importante no mencionada en el relevamiento inicial. ¿Confirmás que es obra y la agregamos?

3. **"Toto"**: aparece como columna separada en Liquidacion (pagos que maneja Toto) y también como receptor en Ingresos ("Toto" recibe 500k, por ej.). ¿Es una persona/socio de la empresa? ¿Debería ser un **usuario del sistema** (rol CARGA) o solo un beneficiario?

4. **"Lechu"**: tiene caja propia (saldo que se consume con retiros) + es receptor frecuente de pagos (100× en 2026). ¿Es un empleado con "caja chica personal" (adelantos a cuenta)?

5. **Sub-obras**: aparecen cosas como "Obra Agua Mompetit", "Obra Externa Mon Petit", "Obra Incendio Dubet". ¿Querés manejarlas como obras separadas o como **categoría/descripción libre** dentro de la obra madre (Mon Petit, Duvet)?

6. **Histórico**: ¿migramos 2023 + 2024 + 2025 + 2026 completo (~9000 movimientos) o solo 2026 como dice la propuesta? El esfuerzo de parser es el mismo, pero los datos viejos requieren limpieza extra.

7. **Vehículos**: hay 8 vehículos listados con patente. La propuesta los deja para etapa 2 ("Flota y combustible"), pero son 3 campos. ¿Querés que ya agregue el modelo `Vehiculo` (solo nombre + patente + obra_actual) para empezar a imputar combustible, o lo dejamos para después?

8. **"Empleados VCP" / "Empleados CBA"**: los jornales de muchos empleados se cargan como un solo monto semanal agregado por sucursal. ¿Esto se va a seguir cargando agregado (1 línea por semana) o querés llegar al detalle por empleado como pensamos con el módulo Liquidaciones?

## 8. Plan de carga sugerido

Una vez cerradas las decisiones arriba:

1. **Actualizar seed** con obras/beneficiarios/categorías adicionales.
2. **Cargar `ConceptoAlias` y `BeneficiarioAlias`** iniciales (§4, §6) — hacer un script `admin:seed-aliases`.
3. **Escribir parser** `backend/src/modules/migracion/parsers/caja-estandar.ts` para las 4 pestañas con formato canónico (Gastos/Ingresos 2025/2026).
4. **Parser más tolerante** para `Gastos Totales 2023/2024` y `Rialto Deuda` (sin columnas estándar).
5. **Dry-run**: importar 2026 primero, validar totales contra los que te pase Dani/Marcelo.
6. **Importar histórico** si se decide.
7. **Reporte de filas OBSERVADAS**: lista de descripciones que el parser no pudo resolver con los aliases → las revisás y agregás aliases nuevos → re-corres (idempotente).

## 9. Tamaño del trabajo restante

- Carga de catálogos ampliados: 1 h.
- Diccionario de aliases: 2 h (va a ser iterativo).
- Parser caja-estandar: 4 h.
- Parsers tolerantes 2023/2024: 4-6 h.
- Validación y ajustes: 3-4 h.

**Total estimado** para dejar los datos 2026 cargados y auditables: **1-2 jornadas**. Con el histórico: +1 jornada.
