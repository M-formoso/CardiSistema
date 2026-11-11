import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateCategoriaEmpleadoSchema = z.object({
  codigo: z.string().min(1).max(50),
  nombre: z.string().min(1).max(200),
  jornal: z.coerce.number().min(0).optional(),
  valorHoraExtra: z.coerce.number().min(0).optional(),
  orden: z.coerce.number().int().min(0).optional(),
});
export class CreateCategoriaEmpleadoDto extends createZodDto(CreateCategoriaEmpleadoSchema) {}

export const UpdateCategoriaEmpleadoSchema = z.object({
  codigo: z.string().min(1).max(50).optional(),
  nombre: z.string().min(1).max(200).optional(),
  orden: z.coerce.number().int().min(0).optional(),
  activo: z.boolean().optional(),
});
export class UpdateCategoriaEmpleadoDto extends createZodDto(UpdateCategoriaEmpleadoSchema) {}

/**
 * Actualiza el jornal (y opcionalmente el valor hora extra) de la categoría
 * y propaga a TODOS los empleados activos de esa categoría cuyos valores
 * coinciden con los valores previos de la categoría (los que tenían valor
 * propio distinto quedan como estaban, salvo que `propagarATodos = true`).
 */
export const ActualizarJornalCategoriaSchema = z.object({
  jornal: z.coerce.number().min(0),
  valorHoraExtra: z.coerce.number().min(0).optional(),
  vigenteDesde: z.coerce.date().optional(), // default: hoy
  motivo: z.string().max(200).optional(),
  propagarATodos: z.boolean().optional().default(false),
});
export class ActualizarJornalCategoriaDto extends createZodDto(
  ActualizarJornalCategoriaSchema,
) {}

export const FiltrosCategoriaEmpleadoSchema = z.object({
  activo: z.coerce.boolean().optional(),
});
export class FiltrosCategoriaEmpleadoDto extends createZodDto(
  FiltrosCategoriaEmpleadoSchema,
) {}
