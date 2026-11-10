import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { EstadoCompromiso, MedioPago, Moneda } from '@prisma/client';

export const CreateVencimientoSchema = z.object({
  concepto: z.string().min(1).max(300),
  obraId: z.string().uuid().optional(),
  categoriaId: z.string().uuid().optional(),
  beneficiarioId: z.string().uuid().optional(),
  diaDelMes: z.coerce.number().int().min(1).max(31),
  montoEstimado: z.coerce.number().positive(),
  moneda: z.nativeEnum(Moneda).default('ARS'),
  cajaHabitualId: z.string().uuid().optional(),
});
export class CreateVencimientoDto extends createZodDto(CreateVencimientoSchema) {}

export const UpdateVencimientoSchema = CreateVencimientoSchema.partial();
export class UpdateVencimientoDto extends createZodDto(UpdateVencimientoSchema) {}

export const PagarCompromisoSchema = z.object({
  cajaId: z.string().uuid(),
  medioPago: z.nativeEnum(MedioPago).default('TRANSFERENCIA'),
  monto: z.coerce.number().positive(),
  fecha: z.coerce.date().optional(),
  descripcion: z.string().max(500).optional(),
});
export class PagarCompromisoDto extends createZodDto(PagarCompromisoSchema) {}

export const OmitirCompromisoSchema = z.object({
  motivo: z.string().min(3).max(300),
});
export class OmitirCompromisoDto extends createZodDto(OmitirCompromisoSchema) {}

export const GenerarCompromisosSchema = z.object({
  mes: z.coerce.number().int().min(1).max(12).optional(), // default: mes actual
  anio: z.coerce.number().int().min(2026).max(2100).optional(),
});
export class GenerarCompromisosDto extends createZodDto(GenerarCompromisosSchema) {}

export const FiltrosCompromisoSchema = z.object({
  estado: z.nativeEnum(EstadoCompromiso).optional(),
  obraId: z.string().uuid().optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});
export class FiltrosCompromisoDto extends createZodDto(FiltrosCompromisoSchema) {}
