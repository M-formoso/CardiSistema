import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { SituacionFiscal } from '@prisma/client';

/**
 * DTOs del módulo empleados (sobre Beneficiario + EmpleadoLegajo).
 * El jornal se cambia en un endpoint aparte (/jornal) que mantiene historial.
 */

export const CreateEmpleadoSchema = z.object({
  nombre: z.string().min(1).max(200),
  dni: z.string().max(20).optional(),
  cuitCuil: z.string().max(20).optional(),
  empresaId: z.string().uuid().optional(),
  situacionFiscal: z.nativeEnum(SituacionFiscal).default(SituacionFiscal.NEGRO),
  fechaIngreso: z.coerce.date(),
  jornal: z.coerce.number().min(0).optional(),
  valorHoraExtra: z.coerce.number().min(0).optional(),
  obraActualId: z.string().uuid().optional(),
  contacto: z.string().max(200).optional(),
  observaciones: z.string().max(500).optional(),
  aliases: z.array(z.string().min(1).max(200)).optional(),
});
export class CreateEmpleadoDto extends createZodDto(CreateEmpleadoSchema) {}

/** Actualiza datos del empleado SIN cambiar el jornal (usar /jornal para eso). */
export const UpdateEmpleadoSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  dni: z.string().max(20).nullable().optional(),
  cuitCuil: z.string().max(20).nullable().optional(),
  empresaId: z.string().uuid().nullable().optional(),
  situacionFiscal: z.nativeEnum(SituacionFiscal).optional(),
  fechaIngreso: z.coerce.date().optional(),
  obraActualId: z.string().uuid().nullable().optional(),
  contacto: z.string().max(200).nullable().optional(),
  observaciones: z.string().max(500).nullable().optional(),
  activo: z.boolean().optional(),
});
export class UpdateEmpleadoDto extends createZodDto(UpdateEmpleadoSchema) {}

/** Cambio de jornal — genera entrada en EmpleadoJornalHistorico. */
export const ActualizarJornalSchema = z.object({
  jornal: z.coerce.number().min(0),
  valorHoraExtra: z.coerce.number().min(0).optional(),
  vigenteDesde: z.coerce.date().optional(), // default: hoy
  motivo: z.string().max(200).optional(),
});
export class ActualizarJornalDto extends createZodDto(ActualizarJornalSchema) {}

export const FiltrosEmpleadoSchema = z.object({
  activo: z.coerce.boolean().optional(),
  empresaId: z.string().uuid().optional(),
  obraId: z.string().uuid().optional(),
  situacionFiscal: z.nativeEnum(SituacionFiscal).optional(),
  q: z.string().optional(),
});
export class FiltrosEmpleadoDto extends createZodDto(FiltrosEmpleadoSchema) {}
