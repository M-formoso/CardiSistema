import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { EstadoObra, Moneda, TipoObra } from '@prisma/client';

export const CreateObraSchema = z.object({
  nombre: z.string().min(1).max(200),
  tipo: z.nativeEnum(TipoObra),
  comitente: z.string().max(200).optional(),
  constructora: z.string().max(200).optional(),
  ubicacion: z.string().max(200).optional(),
  fechaInicio: z.coerce.date().optional(),
  estado: z.nativeEnum(EstadoObra).default(EstadoObra.ACTIVA),
  montoContratado: z.coerce.number().nonnegative().optional(),
  monedaContrato: z.nativeEnum(Moneda).optional(),
});
export class CreateObraDto extends createZodDto(CreateObraSchema) {}

export const UpdateObraSchema = CreateObraSchema.partial();
export class UpdateObraDto extends createZodDto(UpdateObraSchema) {}

export const FiltrosObraSchema = z.object({
  tipo: z.nativeEnum(TipoObra).optional(),
  estado: z.nativeEnum(EstadoObra).optional(),
  activo: z.coerce.boolean().optional(),
  q: z.string().optional(),
});
export class FiltrosObraDto extends createZodDto(FiltrosObraSchema) {}
