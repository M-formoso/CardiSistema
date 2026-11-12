/**
 * Script CLI: pnpm --filter backend empleados:cargar
 * Usa la misma función que el endpoint POST /empleados/cargar-iniciales.
 */

import { PrismaClient } from '@prisma/client';
import { cargarEmpleadosIniciales } from '../../src/modules/empleados/empleados-seed';

const prisma = new PrismaClient();

async function main() {
  console.log('→ Cargando empleados iniciales del Excel del cliente');
  const r = await cargarEmpleadosIniciales(prisma);
  if (r.categoriasFaltantes) {
    console.warn(
      '⚠  No había CategoriaEmpleado cargadas. Corré "pnpm db:seed" primero para que las categorías queden asignadas.',
    );
  }
  console.log(
    `\n✓ Terminado: ${r.creados} creados · ${r.actualizados} actualizados · ${r.total} total`,
  );
  console.log('\nℹ  Los datos sensibles (DNI, CUIL, empresa, obra, fecha real de ingreso)');
  console.log('   se completan desde la ficha de cada empleado en /empleados/:id.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
