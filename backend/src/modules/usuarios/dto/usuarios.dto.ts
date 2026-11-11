import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { RolUsuario } from '@prisma/client';

export const CreateUsuarioSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Solo letras, números, puntos, guiones y _'),
  nombre: z.string().min(1).max(200),
  email: z.string().email('Email inválido').optional(),
  rol: z.nativeEnum(RolUsuario),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});
export class CreateUsuarioDto extends createZodDto(CreateUsuarioSchema) {}

export const UpdateUsuarioSchema = z
  .object({
    nombre: z.string().min(1).max(200),
    email: z.string().email().optional().nullable(),
    rol: z.nativeEnum(RolUsuario),
  })
  .partial();
export class UpdateUsuarioDto extends createZodDto(UpdateUsuarioSchema) {}

export const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});
export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}

export const SetPermisosSchema = z.object({
  permisos: z.array(
    z.object({
      recurso: z.string().min(1).max(50),
      accion: z.string().min(1).max(50),
      concedido: z.boolean().default(true),
    }),
  ),
});
export class SetPermisosDto extends createZodDto(SetPermisosSchema) {}
