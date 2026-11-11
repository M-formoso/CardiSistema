# Índice de Excel del cliente — Cardi

Planillas reales de Dani (Cardi). Son la fuente funcional para el módulo de empleados, liquidaciones y costo por obra.

Las 4 "principales" son las que mandan en este módulo (recibos / jornales / caja / costo). Las obras históricas y otros documentos de carga inicial se moverán cuando aparezcan — por ahora solo hay archivos principales.

## principales/

| Archivo | Hojas | Qué contiene |
|---|---|---|
| **Recibos de sueldo.xlsx** | 10 hojas (Bouwer Plomeria, JOULE, Gral Paz, Rialto, vcp, Herreros, Contratistas, Albañileria, Ivan, Kempes Plomeria) | Formato del recibo real, una hoja por obra. Cada recibo son ~8-10 filas con los conceptos del período: días × jornal, hs. extra, boleto/taxi/pasajes, vacaciones, préstamo, certificaciones libres, descuentos (herramientas, bateria), total. Varios recibos por hoja A4. Casos clave: `vcp` → Villa Carlos Paz (Brian, Ariel, Dario, Cristian, Gaston, etc.); `Contratistas` → Jonas y Fernandez Leonardo con monto grueso + préstamo. `Kempes Plomeria` está vacía. |
| **Planilla de Caja.xlsx** | 12 hojas (Liquidacion, Lechu, Vehiculos, Pagos, Gastos 2026, Ingresos 2026, Aires wo, Gastos 2025, Rialto Deuda, Ingresos 2025, Gastos Totales 2024, Gastos Totales 2023) | Hoja `Liquidacion`: tablero semanal con columnas agrupadas (Ingreso / Gastos Empleados / Gastos Empresa / Rialto / Bowuer / Toto). Totales por bloque y total general (ej. 22.712.000 ingreso vs 10.400.625 empleados). Al pie hay un **arqueo por denominación** (Fajos: 20000, 10000, 2000, 1000...). `Gastos 2026`: libro cronológico con fecha + descripción + monto ARS + dólar blue + equivalente USD, agrupado por bloques (Gastos Empleados, General Paz, Bower, Rialto Complejo). `Ingresos 2026`: igual estructura. `Pagos`: lista cronológica de egresos (Proelctrik, YPF, Sanifer, Casa Santos por obra). `Rialto Deuda`: cuenta corriente Rialto. Hojas 2023-2025: histórico idéntico a 2026. |
| **Precio de Jornales x empleado.xlsx** | 2 hojas (Jornales 2024, Jornales $) | Nómina + historial de valor del jornal. `Jornales 2024`: nombre, jornal inicial, actual, al 15-12, actual y con aumento (5 snapshots). Agrupaciones por bloque: VCP, Cordoba, Herreros, Rialto. Último bloque (Rialto) tiene a Pablo con 1.600.000 fijo (mensual). `Jornales $`: histórico desde ene-2021 hasta 2024 con 32 columnas de snapshots fechados + columna **CATEGORIA** (1/2 oficial, Ayudante, Oficial, Oficial Capataz, Oficial Soldador, 1/2 oficial bueno) + nota de **ajuste** (18.4% + / - redondeo, Ajuste Hoy, Ajuste Hoy (+), Ajuste Hoy (-)). |
| **Costo Por Obra  hasta 2025.xlsx** (notar doble espacio en "Obra  hasta") | 40 hojas (una por obra) | Reporte derivado: pagos agrupados por obra y por persona, con fecha, monto ARS, dólar blue y equivalente USD. Hoja `Leo`: pagos a Leo imputados a distintas obras (Certificacion, Punto de Fuga, Flia, Droma) — confirma que **una persona recibe pagos imputados a obras distintas**. Hojas como `Mon Petit`, `Buena Vista III`, `Namba` tienen columnas por persona dentro de cada obra. Útil para carga histórica. |

## obras-historicas/
(vacía por ahora — van las planillas de obras ya cerradas: Galilea, Oliva, etc. cuando aparezcan)

## otros/
(vacía — van planillas secundarias: riego, herramientas Leo, pagos mensuales Diego Schul)

## No movidos (no son del cliente Cardi)
- **Cuentas Corrientes.xlsx** (~/Downloads): 143 hojas con cuentas corrientes de clientes variados (Villa María, Siglo 21, UTN, Cordoba Turismo, SUOEM...). Pertenece a otro proyecto, no a Cardi.
- Movimientos bancarios (`Frances 23-10.xls`, `Macro 23-10.xls`, `Nacion 23-10.xls`, `Bancor ultimos dos meses.csv`, `Movimientos*.xls`): están en Downloads sin mover. **Pendiente de confirmar si alguno es cuenta de Cardi** — son .xls legacy; si Dani los facilitó, moverlos a `principales/` o `otros/`.
- `Reservations Inquiry`, `RVAS MINI`, `ocupacion-hotel`: del rubro hotel, no de Cardi.
- `Morelatto_catalogo_normalizado`: otro proyecto.
- `15 - Gestion Integral de Negocios v6`: otro proyecto.
