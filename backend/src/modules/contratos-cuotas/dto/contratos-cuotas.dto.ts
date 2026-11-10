import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { MedioPago, Moneda } from '@prisma/client';

export const CreateContratoSchema = z
  .object({
    beneficiarioId: z.string().uuid(),
    obraId: z.string().uuid().optional(),
    concepto: z.string().min(1).max(300),
    montoTotal: z.coerce.number().positive(),
    moneda: z.nativeEnum(Moneda),
    cantidadCuotas: z.coerce.number().int().positive().max(60),
    observaciones: z.string().max(500).optional(),
    // Si viene, cada cuota lleva su fecha y monto. Si no, se reparten iguales
    // con vencimiento cada 30 días desde hoy.
    cuotas: z
      .array(
        z.object({
          numero: z.coerce.number().int().positive(),
          monto: z.coerce.number().positive(),
          vencimiento: z.coerce.date(),
        }),
      )
      .optional(),
  });
export class CreateContratoDto extends createZodDto(CreateContratoSchema) {}

export const PagarCuotaSchema = z.object({
  cajaId: z.string().uuid(),
  medioPago: z.nativeEnum(MedioPago).default('TRANSFERENCIA'),
  fecha: z.coerce.date().optional(),
  categoriaId: z.string().uuid().optional(),
});
export class PagarCuotaDto extends createZodDto(PagarCuotaSchema) {}

export const FiltrosContratoSchema = z.object({
  beneficiarioId: z.string().uuid().optional(),
  obraId: z.string().uuid().optional(),
  activo: z.coerce.boolean().optional(),
});
export class FiltrosContratoDto extends createZodDto(FiltrosContratoSchema) {}
