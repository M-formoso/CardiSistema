import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { EstadoCertificacion, MedioPago, Moneda } from '@prisma/client';

export const CreateCertificacionSchema = z.object({
  beneficiarioId: z.string().uuid(),
  obraId: z.string().uuid(),
  numero: z.string().max(50).optional(),
  fecha: z.coerce.date(),
  descripcion: z.string().max(500).optional(),
  monto: z.coerce.number().positive(),
  moneda: z.nativeEnum(Moneda),
  porcentajeAvance: z.coerce.number().min(0).max(100).optional(),
  adjuntoPath: z.string().max(500).optional(),
});
export class CreateCertificacionDto extends createZodDto(CreateCertificacionSchema) {}

export const UpdateCertificacionSchema = CreateCertificacionSchema.omit({
  beneficiarioId: true,
  obraId: true,
  monto: true,
  moneda: true,
}).partial();
export class UpdateCertificacionDto extends createZodDto(UpdateCertificacionSchema) {}

export const PagarCertificacionSchema = z.object({
  cajaId: z.string().uuid(),
  medioPago: z.nativeEnum(MedioPago).default('TRANSFERENCIA'),
  monto: z.coerce.number().positive(), // cuánto se paga (puede ser parcial)
  fecha: z.coerce.date().optional(),
  categoriaId: z.string().uuid().optional(),
  descripcion: z.string().max(500).optional(),
});
export class PagarCertificacionDto extends createZodDto(PagarCertificacionSchema) {}

export const AnularCertificacionSchema = z.object({
  motivo: z.string().min(3).max(500),
});
export class AnularCertificacionDto extends createZodDto(AnularCertificacionSchema) {}

export const FiltrosCertificacionSchema = z.object({
  obraId: z.string().uuid().optional(),
  beneficiarioId: z.string().uuid().optional(),
  estado: z.nativeEnum(EstadoCertificacion).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});
export class FiltrosCertificacionDto extends createZodDto(FiltrosCertificacionSchema) {}
