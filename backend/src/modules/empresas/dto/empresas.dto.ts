import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateEmpresaSchema = z.object({
  nombre: z.string().min(1).max(200),
  cuit: z.string().max(20).optional(),
  activo: z.boolean().optional().default(true),
});
export class CreateEmpresaDto extends createZodDto(CreateEmpresaSchema) {}

export const UpdateEmpresaSchema = CreateEmpresaSchema.partial();
export class UpdateEmpresaDto extends createZodDto(UpdateEmpresaSchema) {}

export const FiltrosEmpresaSchema = z.object({
  activo: z.coerce.boolean().optional(),
  q: z.string().optional(),
});
export class FiltrosEmpresaDto extends createZodDto(FiltrosEmpresaSchema) {}
