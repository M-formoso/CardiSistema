# Identidad visual — Cardi

> Logo provisto por el cliente: `assets/logo.pdf` (vectorial) y versiones PNG en `assets/brand/`.
>
> **Regla de marca (ver `CLAUDE.md` §1)**: en UI, documentos y recibos la empresa se nombra solo como **"Cardi"**. El logo del cliente dice "CARDI RIEGOS" pero nosotros no describimos a la empresa por rubro — por eso en la UI usamos la isotipia completa como imagen y, cuando hace falta un wordmark en texto, decimos solo "Cardi".

## Paleta

| Rol | Hex | HSL | Uso |
|---|---|---|---|
| `primary` | `#4390B6` | `hsl(201 46% 49%)` | Color principal del logo. Botones de acción, links, acentos. |
| `primary-dark` | `#2E6E8F` | `hsl(201 51% 37%)` | Hover, estados activos. |
| `primary-light` | `#7AB2CF` | `hsl(201 45% 65%)` | Fondos suaves, badges. |
| `primary-foreground` | `#FFFFFF` | `hsl(0 0% 100%)` | Texto sobre primary. |
| `accent` | `#0F2A3A` | `hsl(206 59% 14%)` | Sidebar, headers oscuros. Complementa el azul del logo. |
| `background` | `#FAFBFC` | `hsl(210 20% 98%)` | Fondo general. |
| `surface` | `#FFFFFF` | — | Cards, formularios. |
| `border` | `#E4E7EB` | `hsl(214 15% 91%)` | Separadores. |
| `muted` | `#6B7684` | `hsl(214 11% 47%)` | Texto secundario. |
| `foreground` | `#111827` | `hsl(222 39% 11%)` | Texto principal. |
| `success` | `#10B981` | — | Ingresos, confirmaciones. |
| `warning` | `#F59E0B` | — | Vencimientos próximos, saldos bajos. |
| `danger` | `#EF4444` | — | Egresos, anulaciones, errores. |

**Color primario extraído**: `#4390B6` (muestreado directo del logo con PIL). Usar como fuente de verdad del tema.

## Tipografía

El wordmark del logo usa un sans serif geométrico bold. Para la app:

- **UI**: `Inter` (Google Fonts), fallback `system-ui, -apple-system, sans-serif`.
- **Números/tabular** (montos, fechas): mismo `Inter` con `font-variant-numeric: tabular-nums` para que los importes se alineen en columnas.

## Recibos PDF

- Encabezado: logo PNG (`assets/brand/logo.png`) a la izquierda + razón social + datos de contacto a la derecha.
- Color de líneas y acentos: `#4390B6`.
- Numeración y fechas con tabular-nums.
- Formato argentino: `dd/MM/yyyy`, `$ 1.234,56` para ARS, `US$ 1.234,56` para USD.

## Reglas

- Nada de emojis en la UI (regla del `CLAUDE.md`).
- Colores crudos de Tailwind (ej. `text-blue-500`) prohibidos fuera de los tokens. Siempre vía `theme.extend` + variables CSS.
- Si el cliente envía una variante del logo (versión en blanco sobre fondo, favicon, etc.) va a `assets/brand/` y se referencia desde este archivo.

## Archivos

- `assets/logo.pdf` — original vectorial.
- `assets/brand/logo.png` — PNG a tamaño original.
- `assets/brand/logo-512.png` — versión 512px para uso en app.
- `assets/brand/brand.md` — este documento.
