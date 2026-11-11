import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { EstadoPrestamoEmpleado } from '@prisma/client';

export const CreatePrestamoSchema = z.object({
  beneficiarioId: z.string().uuid(),
  fecha: z.coerce.date(),
  monto: z.coerce.number().positive(),
  observaciones: z.string().max(500).optional(),
  // movimientoId opcional: viene cuando el préstamo nace de un egreso en billetera
  movimientoId: z.string().uuid().optional(),
});
export class CreatePrestamoDto extends createZodDto(CreatePrestamoSchema) {}

export const UpdatePrestamoSchema = z.object({
  observaciones: z.string().max(500).nullable().optional(),
});
export class UpdatePrestamoDto extends createZodDto(UpdatePrestamoSchema) {}

export const AnularPrestamoSchema = z.object({
  motivo: z.string().min(1).max(500),
});
export class AnularPrestamoDto extends createZodDto(AnularPrestamoSchema) {}

export const FiltrosPrestamoSchema = z.object({
  beneficiarioId: z.string().uuid().optional(),
  estado: z.nativeEnum(EstadoPrestamoEmpleado).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});
export class FiltrosPrestamoDto extends createZodDto(FiltrosPrestamoSchema) {}
