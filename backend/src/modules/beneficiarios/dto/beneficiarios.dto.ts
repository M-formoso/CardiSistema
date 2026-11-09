import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Moneda, TipoBeneficiario } from '@prisma/client';

export const CreateBeneficiarioSchema = z.object({
  tipo: z.nativeEnum(TipoBeneficiario),
  nombre: z.string().min(1).max(200),
  cuitCuil: z.string().max(20).optional(),
  rubro: z.string().max(200).optional(),
  contacto: z.string().max(300).optional(),
  condicionPago: z.string().max(200).optional(),
  observaciones: z.string().max(1000).optional(),
  // Si tipo = EMPLEADO, puede traer su legajo en la misma llamada
  legajo: z
    .object({
      fechaIngreso: z.coerce.date(),
      jornal: z.coerce.number().positive().optional(),
      montoSemanal: z.coerce.number().positive().optional(),
      moneda: z.nativeEnum(Moneda).default('ARS'),
      obraActualId: z.string().uuid().optional(),
      observaciones: z.string().max(1000).optional(),
    })
    .optional(),
  aliases: z.array(z.string().min(1).max(200)).optional(),
});
export class CreateBeneficiarioDto extends createZodDto(CreateBeneficiarioSchema) {}

export const UpdateBeneficiarioSchema = CreateBeneficiarioSchema.omit({
  legajo: true,
  aliases: true,
  tipo: true,
}).partial();
export class UpdateBeneficiarioDto extends createZodDto(UpdateBeneficiarioSchema) {}

export const FiltrosBeneficiarioSchema = z.object({
  tipo: z.nativeEnum(TipoBeneficiario).optional(),
  activo: z.coerce.boolean().optional(),
  q: z.string().optional(),
});
export class FiltrosBeneficiarioDto extends createZodDto(FiltrosBeneficiarioSchema) {}

export const UpsertLegajoSchema = z.object({
  fechaIngreso: z.coerce.date(),
  jornal: z.coerce.number().positive().optional(),
  montoSemanal: z.coerce.number().positive().optional(),
  moneda: z.nativeEnum(Moneda).default('ARS'),
  obraActualId: z.string().uuid().optional(),
  observaciones: z.string().max(1000).optional(),
});
export class UpsertLegajoDto extends createZodDto(UpsertLegajoSchema) {}

export const CreateBeneficiarioAliasSchema = z.object({
  alias: z.string().min(1).max(200),
});
export class CreateBeneficiarioAliasDto extends createZodDto(CreateBeneficiarioAliasSchema) {}
