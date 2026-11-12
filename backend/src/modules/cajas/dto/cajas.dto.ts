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

/**
 * Ajuste manual del saldo. En vez de pisar `saldoInicial`, se crea un
 * Movimiento con origen=AJUSTE por la diferencia (INGRESO si falta plata,
 * EGRESO si sobra). Queda en el libro con usuario y motivo.
 */
export const AjustarSaldoSchema = z.object({
  saldoObjetivo: z.coerce.number(),
  motivo: z.string().min(3).max(500),
  fecha: z.coerce.date().optional(),
});
export class AjustarSaldoDto extends createZodDto(AjustarSaldoSchema) {}
