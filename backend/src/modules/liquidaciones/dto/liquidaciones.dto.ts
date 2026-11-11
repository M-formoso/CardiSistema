import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { EstadoLiquidacion, MedioPago } from '@prisma/client';

/**
 * DTOs de liquidaciones semanales — v2.
 * Una liquidación es por obra y por semana. Los días son un número (no por día).
 * Soporta hs. extras y descuentos de préstamos a empleados.
 */

export const CreateLiquidacionSchema = z
  .object({
    semanaInicio: z.coerce.date(),
    semanaFin: z.coerce.date(),
    obraId: z.string().uuid(),
    observaciones: z.string().max(500).optional(),
  })
  .refine((v) => v.semanaFin >= v.semanaInicio, {
    message: 'semanaFin debe ser mayor o igual a semanaInicio',
    path: ['semanaFin'],
  });
export class CreateLiquidacionDto extends createZodDto(CreateLiquidacionSchema) {}

const PrestamoAplicarSchema = z.object({
  prestamoId: z.string().uuid(),
  monto: z.coerce.number().positive(),
});

export const UpsertItemSchema = z.object({
  id: z.string().uuid().optional(), // si viene, actualiza
  beneficiarioId: z.string().uuid().optional(),
  nombreLibre: z.string().min(1).max(200),
  diasTrabajados: z.coerce.number().min(0).max(7),
  valorDia: z.coerce.number().min(0),
  horasExtras: z.coerce.number().min(0).max(100).default(0),
  valorHoraExtra: z.coerce.number().min(0).default(0),
  descuentos: z.coerce.number().min(0).default(0),
  prestamosAplicar: z.array(PrestamoAplicarSchema).default([]),
  observaciones: z.string().max(500).optional(),
});
export class UpsertItemDto extends createZodDto(UpsertItemSchema) {}

export const CambiarEstadoLiquidacionSchema = z.object({
  estado: z.nativeEnum(EstadoLiquidacion),
});
export class CambiarEstadoLiquidacionDto extends createZodDto(CambiarEstadoLiquidacionSchema) {}

/**
 * Pago parcial o total. Si `monto` no viene, se paga el saldo pendiente completo.
 * Si viene menor al saldo, queda la liquidación en PAGADA_PARCIAL.
 */
export const PagarLiquidacionSchema = z.object({
  cajaId: z.string().uuid(),
  medioPago: z.nativeEnum(MedioPago).default('EFECTIVO'),
  fechaPago: z.coerce.date().optional(),
  categoriaId: z.string().uuid().optional(), // default: categoría JORN
  monto: z.coerce.number().positive().optional(), // default: saldo pendiente
  observaciones: z.string().max(500).optional(),
});
export class PagarLiquidacionDto extends createZodDto(PagarLiquidacionSchema) {}

export const FiltrosLiquidacionSchema = z.object({
  estado: z.nativeEnum(EstadoLiquidacion).optional(),
  obraId: z.string().uuid().optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});
export class FiltrosLiquidacionDto extends createZodDto(FiltrosLiquidacionSchema) {}
