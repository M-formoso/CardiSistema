---
name: "client-data-migration"
description: "Migración de datos iniciales de un cliente a DevelopNet — templates Excel, validaciones y orden de carga por módulo"
version: "1.0.0"
trigger: "Cuando el usuario pide cargar datos iniciales de un cliente (Excel, CSV, migración desde otro sistema), o el orquestador client-onboarding delega la fase MIGRATION"
---

# Client Data Migration - DevelopNet ERP

Sos el sub-skill que ejecuta la **carga de datos iniciales** de un cliente. Trabajás bajo la coordinación de `client-onboarding` pero podés ser invocado directo cuando el usuario ya sabe qué quiere cargar.

## Rol

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT DATA MIGRATION                                          │
│  - Genera templates Excel por módulo                            │
│  - Valida archivos recibidos del cliente                        │
│  - Ejecuta la carga respetando dependencias                     │
│  - Registra resultado en state.md del cliente                   │
│  - NUNCA carga sin validar primero un archivo de muestra        │
└─────────────────────────────────────────────────────────────────┘
```

## Reglas Estrictas

1. **NUNCA cargar el archivo completo sin validar una muestra de 5-10 filas primero.**
2. **NUNCA saltar el orden de dependencias** (usuarios antes que roles, productos antes que stock, etc.).
3. **SIEMPRE hacer backup** de la tabla destino antes de importar en producción.
4. **SIEMPRE contra-verificar** cantidad de filas cargadas vs. filas del Excel.
5. **Multi-tenancy obligatorio**: cada import filtra/setea `organizationId` del cliente destino.
6. **NO usar `any`** en scripts TypeScript de importación.
7. **Registrar en `.developnet/clients/<slug>/state.md`** cada carga: qué módulo, fecha, filas, errores.

## Orden de Carga (Dependencias)

Este orden NO se altera. Si el cliente pide algo antes, explicá por qué no se puede y ofrecé alternativa.

```
1. ORGANIZACIÓN        (Org + settings iniciales)
2. USUARIOS + ROLES    (mínimo 1 OWNER, luego el resto)
3. SUCURSALES/BRANCHES (si aplica)
4. PLAN DE CUENTAS     (si Treasury/Accounting activo)
5. CENTROS DE COSTO    (si aplica)
6. PROVEEDORES         (necesario antes de compras)
7. CLIENTES            (necesario antes de ventas)
8. CATEGORÍAS/RUBROS   (para productos)
9. UNIDADES DE MEDIDA  (para productos)
10. PRODUCTOS/SERVICIOS
11. STOCK INICIAL      (StockMovement tipo IN referenceType='INITIAL')
12. LISTAS DE PRECIOS  (opcional)
13. SALDOS INICIALES CTAS. CTES. (proveedores/clientes)
14. COMPROBANTES HISTÓRICOS (opcional — solo si el cliente insiste)
```

## Templates Excel por Módulo

Los templates viven en `.claude/skills/client-data-migration/templates/`. Formato: `.xlsx` con una hoja "Datos" + una hoja "Instrucciones".

### Convenciones de todos los templates
- Primera fila: encabezado con nombre técnico exacto (`sku`, `unitPrice`, `taxRate` — camelCase, en inglés como en la API).
- Segunda fila: descripción humana en español (para que el cliente entienda).
- Tercera fila: ejemplo real.
- Campos obligatorios: fondo amarillo. Opcionales: sin color.
- Fecha en formato `YYYY-MM-DD`. Números con punto decimal. Booleanos: `TRUE`/`FALSE`.
- Sin celdas fusionadas, sin fórmulas, sin filtros aplicados.

### Templates por módulo

#### `usuarios.xlsx`
| Campo | Tipo | Obligatorio | Notas |
|-------|------|-------------|-------|
| email | string | ✅ | Único, en minúscula |
| firstName | string | ✅ | |
| lastName | string | ✅ | |
| role | enum | ✅ | OWNER / ADMIN / MANAGER / CASHIER / VIEWER |
| branchCode | string | ⬜ | Vacío = acceso a todas |
| tempPassword | string | ⬜ | Si vacío, se genera random y se envía por mail |

#### `sucursales.xlsx`
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| code | string | ✅ |
| name | string | ✅ |
| address | string | ⬜ |
| city | string | ⬜ |
| province | string | ⬜ |
| phone | string | ⬜ |
| isMain | bool | ✅ |

#### `plan-cuentas.xlsx`
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| code | string | ✅ | Jerárquico: `1`, `1.1`, `1.1.01` |
| name | string | ✅ |
| type | enum | ✅ | ASSET / LIABILITY / EQUITY / INCOME / EXPENSE |
| parentCode | string | ⬜ | Vacío = raíz |
| allowsMovements | bool | ✅ |

#### `proveedores.xlsx`
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| taxId | string | ✅ | CUIT sin guiones |
| businessName | string | ✅ |
| fantasyName | string | ⬜ |
| ivaCondition | enum | ✅ | RI / MONO / EX / CF |
| email | string | ⬜ |
| phone | string | ⬜ |
| address | string | ⬜ |
| paymentTermDays | int | ⬜ | Default 0 |
| initialBalance | decimal | ⬜ | Positivo = les debemos |

#### `clientes.xlsx`
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| taxId | string | ⬜ | CUIT/DNI. Vacío = Consumidor Final |
| firstName | string | ✅ si personaFisica |
| lastName | string | ✅ si personaFisica |
| businessName | string | ✅ si personaJuridica |
| ivaCondition | enum | ✅ | RI / MONO / EX / CF |
| email | string | ⬜ |
| phone | string | ⬜ |
| creditLimit | decimal | ⬜ |
| initialBalance | decimal | ⬜ | Positivo = nos deben |

#### `productos.xlsx`
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| sku | string | ✅ | Único |
| name | string | ✅ |
| description | string | ⬜ |
| category | string | ✅ | Nombre exacto de categoría existente |
| unit | string | ✅ | UN / KG / LT / MT / ... |
| costPrice | decimal | ⬜ | Sin IVA |
| salePrice | decimal | ✅ | Sin IVA |
| taxRate | decimal | ✅ | 0, 10.5, 21, 27 |
| trackStock | bool | ✅ |
| minStock | decimal | ⬜ |
| barcode | string | ⬜ |

#### `stock-inicial.xlsx`
| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| sku | string | ✅ |
| branchCode | string | ✅ |
| quantity | decimal | ✅ |
| unitCost | decimal | ⬜ | Si vacío usa costPrice del producto |
| observations | string | ⬜ |

## Flujo de Trabajo

### Paso 1 — Preparar template
```
1. Identificar módulo y cliente destino.
2. Copiar template desde .claude/skills/client-data-migration/templates/<modulo>.xlsx
3. Enviar al cliente con instrucciones claras (usar la hoja "Instrucciones" del template).
4. Registrar en state.md: "Template <modulo> enviado el <fecha>".
```

### Paso 2 — Validar muestra
Antes de cargar el completo, pedir al cliente una muestra de 5-10 filas y validarla. Checks obligatorios:

- [ ] Todos los campos obligatorios están completos.
- [ ] Formatos correctos (fechas, decimales, enums).
- [ ] Sin filas duplicadas por clave natural (sku, email, taxId).
- [ ] Referencias existen: si `productos.category="Bebidas"`, la categoría "Bebidas" debe existir.
- [ ] Valores dentro de rango razonable (precios > 0, stock >= 0, etc.).

Si falla → devolver reporte al cliente con filas específicas y errores. NO avanzar.

### Paso 3 — Backup + Import dry-run
```
1. Backup de la tabla destino (dump SQL o snapshot Railway).
2. Correr importación en modo dry-run (validación completa sin escribir).
3. Reportar: N filas OK, N con warnings, N con errores.
4. Si hay errores → volver al paso 2 con el cliente.
```

### Paso 4 — Import definitivo
```
1. Correr importación real.
2. Contra-verificar: SELECT COUNT(*) vs. filas del Excel.
3. Muestrear 5 registros random y validar contra Excel.
4. Registrar en state.md: fecha, cantidad, módulo, usuario que ejecutó.
```

### Paso 5 — Sign-off del cliente
Pedirle al cliente que valide en la UI que los datos se ven bien antes de dar por cerrada la carga de ese módulo.

## Endpoints de Importación (backend)

Todos requieren JWT del OWNER/ADMIN del cliente. Se pueden invocar desde el dashboard o vía script.

| Módulo | Endpoint | Método |
|--------|----------|--------|
| Usuarios | `POST /api/users/bulk-import` | multipart/form-data |
| Sucursales | `POST /api/branches/bulk-import` | multipart/form-data |
| Plan cuentas | `POST /api/accounting/chart-of-accounts/bulk-import` | multipart/form-data |
| Proveedores | `POST /api/suppliers/bulk-import` | multipart/form-data |
| Clientes | `POST /api/customers/bulk-import` | multipart/form-data |
| Productos | `POST /api/products/bulk-import` | multipart/form-data |
| Stock inicial | `POST /api/inventory/stock/initial-load` | multipart/form-data |
| Saldos iniciales | `POST /api/accounts-receivable/initial-balances` | JSON |

Query param `?dryRun=true` en todos para simular sin escribir.

Respuesta estándar:
```json
{
  "totalRows": 250,
  "imported": 247,
  "skipped": 2,
  "errors": [
    { "row": 34, "field": "email", "message": "Email inválido: 'juan@'" },
    { "row": 89, "field": "taxRate", "message": "Debe ser 0, 10.5, 21 o 27" }
  ],
  "warnings": [
    { "row": 12, "message": "Categoría 'Otros' no existía, se creó automáticamente" }
  ]
}
```

## Transformaciones Comunes (Recetas)

### Precios con IVA → sin IVA
```
salePrice_sin_iva = precio_con_iva / (1 + taxRate/100)
```

### CUIT con guiones → sin guiones
```
taxId = raw.replace(/-/g, '')
```

### Fecha DD/MM/YYYY → YYYY-MM-DD
Usar el "text-to-columns" de Excel primero para no perder ceros, luego formato.

### Stock desde Tango/Bejerman
- Tango exporta como `.dbf` — abrir con LibreOffice y guardar como `.xlsx`.
- Bejerman exporta CSV con separador `;` y decimal `,` — usar Excel > Datos > Desde texto y forzar separadores.

## Comandos del Usuario

| Comando | Acción |
|---------|--------|
| "Migrar [módulo] de [cliente]" | Ejecutar flujo completo Paso 1-5 |
| "Validar Excel de [cliente]" | Solo Paso 2 |
| "Dry-run [módulo] de [cliente]" | Solo Paso 3 |
| "Templates disponibles" | Listar todos los `.xlsx` de `templates/` |
| "Estado de migración de [cliente]" | Leer state.md sección MIGRATION |

## Registro en state.md

Añadir sección al `state.md` del cliente:

```markdown
## Migración de Datos

| Módulo | Estado | Fecha | Filas | Errores | Observaciones |
|--------|--------|-------|-------|---------|---------------|
| Usuarios | ✅ DONE | 2026-10-02 | 8/8 | 0 | - |
| Proveedores | ✅ DONE | 2026-10-03 | 145/150 | 5 | 5 filas con CUIT inválido, cliente los va a corregir |
| Productos | 🔄 IN PROGRESS | 2026-10-04 | - | - | Esperando template completo del cliente |
| Stock inicial | ⬜ PENDING | - | - | - | Depende de productos |
```

## Red Flags

- ⚠️ Cliente manda Excel con celdas fusionadas → devolvelo y pedí sin fusionar.
- ⚠️ Cliente insiste en cargar históricos de 5 años → advertí que impacta reportes y costos, ofrecé cargar solo saldos.
- ⚠️ Import da 100% éxito pero suenan pocas filas → contra-verificá con COUNT(*), puede ser un dedup silencioso.
- ⚠️ Se pidió cargar productos sin categorías → parar, cargar categorías primero.
