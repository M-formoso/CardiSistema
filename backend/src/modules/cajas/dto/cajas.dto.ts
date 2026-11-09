import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Moneda, TipoCaja } from '@prisma/client';

export const CreateCajaSchema = z.object({
  nombre: z.string().min(1).max(200),
  tipo: z.nativeEnum(TipoCaja),
  moneda: z.nativeEnum(Moneda),
  saldoInicial: z.coerce.number().default(0),
  fechaSaldoInicial: z.coerce.date(),
});
export class CreateCajaDto extends createZodDto(CreateCajaSchema) {}

export const UpdateCajaSchema = z
  .object({
    nombre: z.string().min(1).max(200),
    saldoInicial: z.coerce.number(),
    fechaSaldoInicial: z.coerce.date(),
  })
  .partial();
export class UpdateCajaDto extends createZodDto(UpdateCajaSchema) {}
