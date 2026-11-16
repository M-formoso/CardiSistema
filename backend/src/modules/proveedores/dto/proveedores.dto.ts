import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CrearResumenSchema = z.object({
  fecha: z.coerce.date(),
  observaciones: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        obraId: z.string().uuid(),
        monto: z.coerce.number().min(0),
      }),
    )
    .min(1, 'El resumen tiene que tener al menos una obra'),
});
export class CrearResumenDto extends createZodDto(CrearResumenSchema) {}

export const FiltrosProveedoresSchema = z.object({
  q: z.string().optional(),
  activo: z.coerce.boolean().optional(),
});
export class FiltrosProveedoresDto extends createZodDto(FiltrosProveedoresSchema) {}
