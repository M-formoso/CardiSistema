import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CrearVehiculoSchema = z.object({
  nombre: z.string().min(1).max(100),
  modelo: z.string().max(50).optional(),
  patente: z.string().min(1).max(20),
  observaciones: z.string().max(500).optional(),
});
export class CrearVehiculoDto extends createZodDto(CrearVehiculoSchema) {}

export const ActualizarVehiculoSchema = z
  .object({
    nombre: z.string().min(1).max(100).optional(),
    modelo: z.string().max(50).nullable().optional(),
    patente: z.string().min(1).max(20).optional(),
    observaciones: z.string().max(500).nullable().optional(),
    activo: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nada para actualizar' });
export class ActualizarVehiculoDto extends createZodDto(ActualizarVehiculoSchema) {}

export const FiltrosVehiculoSchema = z.object({
  q: z.string().optional(),
  activo: z.coerce.boolean().optional(),
});
export class FiltrosVehiculoDto extends createZodDto(FiltrosVehiculoSchema) {}
