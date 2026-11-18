import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { TipoCategoria } from '@prisma/client';

export const CreateCategoriaSchema = z.object({
  codigo: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'Solo mayúsculas, dígitos y _'),
  nombre: z.string().min(1).max(200),
  orden: z.coerce.number().int().default(0),
  parentId: z.string().uuid().optional(),
  tipo: z.nativeEnum(TipoCategoria).default('GENERAL'),
  vinculadaVehiculo: z.coerce.boolean().default(false),
});
export class CreateCategoriaDto extends createZodDto(CreateCategoriaSchema) {}

export const UpdateCategoriaSchema = CreateCategoriaSchema.partial().extend({
  activo: z.coerce.boolean().optional(),
});
export class UpdateCategoriaDto extends createZodDto(UpdateCategoriaSchema) {}

export const FiltrosCategoriaSchema = z.object({
  tipo: z.nativeEnum(TipoCategoria).optional(),
  soloActivas: z.coerce.boolean().optional(),
  vinculadaVehiculo: z.coerce.boolean().optional(),
});
export class FiltrosCategoriaDto extends createZodDto(FiltrosCategoriaSchema) {}

export const CreateAliasSchema = z.object({
  texto: z.string().min(1).max(200),
  categoriaId: z.string().uuid(),
});
export class CreateAliasDto extends createZodDto(CreateAliasSchema) {}
