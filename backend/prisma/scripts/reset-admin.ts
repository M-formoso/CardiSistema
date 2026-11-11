/**
 * Resetea/crea el usuario admin leyendo variables de entorno:
 *   ADMIN_USERNAME (default: "admin")
 *   ADMIN_PASSWORD (required)
 *   ADMIN_EMAIL (opcional)
 *   ADMIN_NOMBRE (default: "Administrador Cardi")
 *
 * A diferencia del seed general, este script SIEMPRE actualiza la
 * contraseña (hace hash nuevo con bcrypt). Útil cuando olvidaste
 * la clave o cuando querés rotar credenciales.
 *
 * Uso:
 *   pnpm --filter @cardi/backend admin:reset
 *
 * En Railway (desde "Run Command"):
 *   pnpm --filter @cardi/backend admin:reset
 */

import { PrismaClient, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const username = (process.env.ADMIN_USERNAME ?? 'admin').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL ?? null;
  const nombre = process.env.ADMIN_NOMBRE ?? 'Administrador Cardi';

  if (!password) {
    console.error('✗ Falta ADMIN_PASSWORD en las variables de entorno');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('✗ ADMIN_PASSWORD muy corta (mínimo 6 caracteres)');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existente = await prisma.usuario.findUnique({ where: { username } });

  const usuario = await prisma.usuario.upsert({
    where: { username },
    create: {
      username,
      email,
      nombre,
      passwordHash,
      rol: RolUsuario.ADMIN,
      activo: true,
    },
    update: {
      email,
      nombre,
      passwordHash, // forzar reset
      rol: RolUsuario.ADMIN,
      activo: true,
    },
  });

  // Invalidar todas las sesiones activas (por seguridad)
  const sesiones = await prisma.refreshToken.updateMany({
    where: { usuarioId: usuario.id, revocado: false },
    data: { revocado: true },
  });

  console.log(existente ? '→ Admin actualizado' : '→ Admin creado');
  console.log(`  username: ${usuario.username}`);
  console.log(`  email:    ${usuario.email ?? '—'}`);
  console.log(`  nombre:   ${usuario.nombre}`);
  console.log(`  rol:      ${usuario.rol}`);
  console.log(`  activo:   ${usuario.activo}`);
  console.log(`  sesiones revocadas: ${sesiones.count}`);
  console.log('✓ Listo. Probá login ahora.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
