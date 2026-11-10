import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { EstadoLiquidacion, MedioPago } from '@prisma/client';

export const CreateLiquidacionSchema = z
  .object({
    semanaInicio: z.coerce.date(),
    semanaFin: z.coerce.date(),
    observaciones: z.string().max(500).optional(),
  })
  .refine((v) => v.semanaFin >= v.semanaInicio, {
    message: 'semanaFin debe ser mayor o igual a semanaInicio',
    path: ['semanaFin'],
  });
export class CreateLiquidacionDto extends createZodDto(CreateLiquidacionSchema) {}

const DiaSchema = z
  .object({
    fecha: z.coerce.date(),
    dias: z.coerce.number().min(0).max(1),
    obraId: z.string().uuid(),
    etiqueta: z.string().max(50).optional(),
  });

export const UpsertItemSchema = z
  .object({
    id: z.string().uuid().optional(), // si viene, actualiza
    beneficiarioId: z.string().uuid().optional(),
    nombreLibre: z.string().min(1).max(200),
    valorDia: z.coerce.number().positive(),
    descuentos: z.coerce.number().min(0).default(0),
    observaciones: z.string().max(500).optional(),
    dias: z.array(DiaSchema).min(1, 'Al menos un día trabajado'),
  });
export class UpsertItemDto extends createZodDto(UpsertItemSchema) {}

export const CambiarEstadoLiquidacionSchema = z.object({
  estado: z.nativeEnum(EstadoLiquidacion),
});
export class CambiarEstadoLiquidacionDto extends createZodDto(CambiarEstadoLiquidacionSchema) {}

export const PagarLiquidacionSchema = z.object({
  cajaId: z.string().uuid(),
  medioPago: z.nativeEnum(MedioPago).default('EFECTIVO'),
  fechaPago: z.coerce.date().optional(),
  categoriaId: z.string().uuid().optional(), // si no se pasa, usa la categoría JORN si existe
  itemIds: z.array(z.string().uuid()).optional(), // si se pasa, paga solo esos items (resto queda pendiente)
});
export class PagarLiquidacionDto extends createZodDto(PagarLiquidacionSchema) {}

export const FiltrosLiquidacionSchema = z.object({
  estado: z.nativeEnum(EstadoLiquidacion).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});
export class FiltrosLiquidacionDto extends createZodDto(FiltrosLiquidacionSchema) {}
