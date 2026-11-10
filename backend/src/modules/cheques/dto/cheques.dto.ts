import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { EstadoCheque, Moneda, TipoCheque } from '@prisma/client';

export const CreateChequeSchema = z
  .object({
    tipo: z.nativeEnum(TipoCheque),
    numero: z.string().min(1).max(50),
    banco: z.string().max(100).optional(),
    sucursal: z.string().max(100).optional(),
    librador: z.string().max(200).optional(),
    titular: z.string().max(200).optional(),
    cuit: z.string().max(20).optional(),
    monto: z.coerce.number().positive(),
    moneda: z.nativeEnum(Moneda).default('ARS'),
    fechaEmision: z.coerce.date(),
    fechaPago: z.coerce.date(),
    beneficiarioId: z.string().uuid().optional(),
    observaciones: z.string().max(1000).optional(),
  })
  .refine((v) => v.fechaPago >= v.fechaEmision, {
    message: 'La fecha de pago debe ser mayor o igual a la de emisión',
    path: ['fechaPago'],
  });
export class CreateChequeDto extends createZodDto(CreateChequeSchema) {}

export const UpdateChequeSchema = z
  .object({
    banco: z.string().max(100).optional(),
    sucursal: z.string().max(100).optional(),
    librador: z.string().max(200).optional(),
    titular: z.string().max(200).optional(),
    cuit: z.string().max(20).optional(),
    beneficiarioId: z.string().uuid().optional(),
    observaciones: z.string().max(1000).optional(),
  })
  .partial();
export class UpdateChequeDto extends createZodDto(UpdateChequeSchema) {}

export const CambiarEstadoChequeSchema = z.object({
  estado: z.nativeEnum(EstadoCheque),
  observacion: z.string().max(500).optional(),
});
export class CambiarEstadoChequeDto extends createZodDto(CambiarEstadoChequeSchema) {}

export const FiltrosChequeSchema = z.object({
  tipo: z.nativeEnum(TipoCheque).optional(),
  estado: z.nativeEnum(EstadoCheque).optional(),
  beneficiarioId: z.string().uuid().optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  q: z.string().optional(),
});
export class FiltrosChequeDto extends createZodDto(FiltrosChequeSchema) {}
