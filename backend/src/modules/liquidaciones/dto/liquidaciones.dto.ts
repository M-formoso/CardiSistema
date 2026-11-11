import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { EstadoLiquidacion, MedioPago, TipoConceptoLiquidacion } from '@prisma/client';

/**
 * DTOs de liquidaciones semanales — v3.
 * Un recibo (LiquidacionItem) es una persona con N conceptos tipados.
 * El subtotal y aPagar se derivan de los conceptos; no se envían.
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

export const ConceptoSchema = z.object({
  tipo: z.nativeEnum(TipoConceptoLiquidacion),
  descripcion: z.string().min(1).max(500),
  cantidad: z.coerce.number().min(0).optional(),
  valorUnitario: z.coerce.number().min(0).optional(),
  monto: z.coerce.number(), // bruto, siempre positivo; el service aplica signo según tipo
  obraId: z.string().uuid().optional(),
  prestamoId: z.string().uuid().optional(), // requerido para PRESTAMO_APLICACION
  orden: z.coerce.number().int().min(0).optional(),
});
export type ConceptoInput = z.infer<typeof ConceptoSchema>;

export const UpsertItemSchema = z.object({
  id: z.string().uuid().optional(), // si viene, actualiza
  beneficiarioId: z.string().uuid().optional(),
  nombreLibre: z.string().min(1).max(200),
  observaciones: z.string().max(500).optional(),
  conceptos: z.array(ConceptoSchema).min(1, 'El recibo tiene que tener al menos un concepto'),
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
  categoriaId: z.string().uuid().optional(),
  monto: z.coerce.number().positive().optional(),
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
