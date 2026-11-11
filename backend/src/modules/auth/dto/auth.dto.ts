import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const LoginSchema = z.object({
  username: z.string().min(1, 'Usuario requerido').max(100),
  password: z.string().min(1, 'Contraseña requerida'),
});
export class LoginDto extends createZodDto(LoginSchema) {}

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken requerido'),
});
export class RefreshDto extends createZodDto(RefreshSchema) {}

export const ChangePasswordSchema = z
  .object({
    passwordActual: z.string().min(1, 'passwordActual requerido'),
    passwordNuevo: z
      .string()
      .min(8, 'La contraseña nueva debe tener al menos 8 caracteres'),
  })
  .refine((data) => data.passwordActual !== data.passwordNuevo, {
    message: 'La contraseña nueva no puede ser igual a la actual',
    path: ['passwordNuevo'],
  });
export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
