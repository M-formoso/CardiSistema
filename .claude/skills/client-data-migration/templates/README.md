# Templates de Migración

Templates `.xlsx` que se envían al cliente para que complete con sus datos antes de importar.

## Convenciones

Cada template tiene 2 hojas:
- **Datos**: fila 1 con nombres técnicos (`sku`, `unitPrice`, ...), fila 2 con descripción humana, fila 3 con ejemplo.
- **Instrucciones**: cómo completarlo, valores válidos, ejemplos.

Campos obligatorios: fondo amarillo. Opcionales: sin color.

## Templates a crear

Cuando llegue el primer cliente que necesite migración, generar el template correspondiente y guardar en esta carpeta:

- [ ] `usuarios.xlsx`
- [ ] `sucursales.xlsx`
- [ ] `plan-cuentas.xlsx`
- [ ] `centros-costo.xlsx`
- [ ] `proveedores.xlsx`
- [ ] `clientes.xlsx`
- [ ] `categorias.xlsx`
- [ ] `unidades-medida.xlsx`
- [ ] `productos.xlsx`
- [ ] `stock-inicial.xlsx`
- [ ] `listas-precios.xlsx`
- [ ] `saldos-iniciales.xlsx`

La spec exacta de columnas por template está en `../SKILL.md` sección "Templates Excel por Módulo".

## Regla

Los templates son la única fuente de verdad de qué se le pide al cliente. Si cambia el esquema del backend, actualizar templates + SKILL.md en el mismo commit.
