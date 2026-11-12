/**
 * Carga inicial de empleados — datos del Excel "Precio de Jornales x empleado.xlsx"
 * (hojas "Jornales 2024" + "Jornales $"), noviembre 2026.
 *
 * Es idempotente: identifica al empleado por su nombre canónico y lo upsertea.
 * - Crea Beneficiario (tipo EMPLEADO) + EmpleadoLegajo.
 * - Asocia categoría si el código existe (OF_CAP/OF/MO/AYU/etc.).
 * - Deja alias con el apodo/nombre corto que aparece en la planilla.
 * - Crea entrada en EmpleadoJornalHistorico si el legajo no tenía jornal.
 *
 * Para correrlo:
 *   pnpm --filter backend empleados:cargar
 * En Railway:
 *   railway run --service <backend> pnpm --filter backend empleados:cargar
 */

import { PrismaClient, SituacionFiscal, TipoBeneficiario } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Empleados tomados del Excel del cliente (nov 2026).
 * - nombre: nombre canónico (el "formal" si lo conocemos, si no el que usa Dani).
 * - alias: cómo aparece en la planilla (se guarda en BeneficiarioAlias).
 * - jornal: último valor "con Aumento" de la hoja Jornales 2024.
 * - categoriaCodigo: según la columna CATEGORIA de Jornales $ (cuando hay match).
 * - grupo: VCP / Cordoba / Herreros / Rialto — para separar en el output.
 * - situacion: situación fiscal. Para alinear con v1 dejamos NEGRO por defecto
 *   (no declarado) — si corresponde algo distinto se ajusta desde la UI.
 * - montoSemanal: si en vez de jornal diario cobra un monto fijo (p. ej. Pablo Rialto).
 */
type EmpleadoInput = {
  nombre: string;
  alias?: string[];
  jornal?: number;
  montoSemanal?: number;
  categoriaCodigo?: string;
  grupo: string;
  situacion?: SituacionFiscal;
};

const EMPLEADOS: EmpleadoInput[] = [
  // Grupo VCP (Villa Carlos Paz)
  { nombre: 'Fernandez Leonardo', alias: ['Leo'], jornal: 75000, categoriaCodigo: 'OF_CAP', grupo: 'VCP' },
  { nombre: 'Brian', alias: ['Braian', 'Bryan'], jornal: 60000, categoriaCodigo: 'AYU', grupo: 'VCP' },
  { nombre: 'Ariel Tapia', alias: ['Ariel'], jornal: 60000, categoriaCodigo: 'MO_BUENO', grupo: 'VCP' },
  { nombre: 'Dario Gomez', alias: ['Dario'], jornal: 50000, categoriaCodigo: 'AYU', grupo: 'VCP' },
  { nombre: 'Navarrete Cristian', alias: ['Cristian'], jornal: 60000, categoriaCodigo: 'MO', grupo: 'VCP' },
  { nombre: 'Alexis', jornal: 50000, categoriaCodigo: 'AYU', grupo: 'VCP' },
  { nombre: 'Diego Aguirre', alias: ['Diego'], jornal: 50000, categoriaCodigo: 'AYU', grupo: 'VCP' },
  { nombre: 'Gaston', jornal: 55000, categoriaCodigo: 'MO', grupo: 'VCP' },
  { nombre: 'Gaston Rodriguez', jornal: 50000, categoriaCodigo: 'AYU', grupo: 'VCP' },
  { nombre: 'Patricio', alias: ['Patricio ayudante stefano'], jornal: 55000, categoriaCodigo: 'MO', grupo: 'VCP' },

  // Grupo Cordoba
  { nombre: 'Irusta Matias', alias: ['Matias', 'Irusta Matías CBA'], jornal: 50000, categoriaCodigo: 'AYU', grupo: 'Cordoba' },
  { nombre: 'Pizza', jornal: 65000, categoriaCodigo: 'OF', grupo: 'Cordoba' },
  { nombre: 'Pinino', jornal: 75000, categoriaCodigo: 'OF_ESP', grupo: 'Cordoba' },
  { nombre: 'Guillermo', jornal: 55000, categoriaCodigo: 'MO', grupo: 'Cordoba' },
  { nombre: 'Orodaz', jornal: 50000, categoriaCodigo: 'AYU', grupo: 'Cordoba' },
  { nombre: 'Ricardo Oviedo', jornal: 65000, categoriaCodigo: 'OF', grupo: 'Cordoba' },
  { nombre: 'Agustin Albornoz', jornal: 50000, categoriaCodigo: 'AYU', grupo: 'Cordoba' },
  { nombre: 'Oviedo Leandro', jornal: 50000, categoriaCodigo: 'AYU', grupo: 'Cordoba' },
  { nombre: 'Carlos Moises', alias: ['Carlos'], jornal: 65000, categoriaCodigo: 'OF', grupo: 'Cordoba' },
  { nombre: 'Gonzalez', jornal: 50000, categoriaCodigo: 'AYU', grupo: 'Cordoba' },

  // Grupo Herreros
  { nombre: 'Cochela', jornal: 50000, categoriaCodigo: 'OF', grupo: 'Herreros' },
  { nombre: 'Carlos Nano', alias: ['Carlos (Herreros)', 'Nano'], jornal: 47000, categoriaCodigo: 'MO', grupo: 'Herreros' },
  { nombre: 'Adrian', jornal: 70000, categoriaCodigo: 'OF_SOL', grupo: 'Herreros' },

  // Grupo Rialto (pago mensual fijo, no jornal diario)
  { nombre: 'Pablo (Rialto)', alias: ['Pablo'], montoSemanal: 400000, grupo: 'Rialto' },
] as const;

async function main() {
  console.log(`→ Cargando ${EMPLEADOS.length} empleados del Excel del cliente`);

  // Mapa de categorías disponibles (se seedean en seed.ts)
  const categorias = await prisma.categoriaEmpleado.findMany();
  const categoriaPorCodigo = new Map(categorias.map((c) => [c.codigo, c]));

  if (categorias.length === 0) {
    console.warn(
      '⚠  No hay CategoriaEmpleado cargadas. Corré "pnpm --filter backend db:seed" primero.',
    );
  }

  let creados = 0;
  let actualizados = 0;

  for (const emp of EMPLEADOS) {
    // Busco por nombre exacto (case-insensitive)
    const existente = await prisma.beneficiario.findFirst({
      where: {
        tipo: TipoBeneficiario.EMPLEADO,
        nombre: { equals: emp.nombre, mode: 'insensitive' },
      },
      include: { legajo: true, aliases: true },
    });

    const categoriaId = emp.categoriaCodigo
      ? (categoriaPorCodigo.get(emp.categoriaCodigo)?.id ?? null)
      : null;

    const legajoData = {
      fechaIngreso: new Date('2026-01-01'), // provisorio — se ajusta desde UI
      categoriaId,
      situacionFiscal: emp.situacion ?? SituacionFiscal.NEGRO,
      jornal: emp.jornal ?? null,
      montoSemanal: emp.montoSemanal ?? null,
      // Hora extra default: jornal / 8 * 1.5 (si hay jornal)
      valorHoraExtra: emp.jornal ? Math.round((emp.jornal / 8) * 1.5) : null,
    };

    if (existente) {
      // Update: completo datos solo si están vacíos (no piso ediciones manuales)
      await prisma.empleadoLegajo.update({
        where: { beneficiarioId: existente.id },
        data: {
          categoriaId: existente.legajo?.categoriaId ?? categoriaId,
          jornal: existente.legajo?.jornal ?? emp.jornal,
          montoSemanal: existente.legajo?.montoSemanal ?? emp.montoSemanal,
          valorHoraExtra:
            existente.legajo?.valorHoraExtra ??
            (emp.jornal ? Math.round((emp.jornal / 8) * 1.5) : null),
        },
      });
      // Alias nuevos
      if (emp.alias) {
        for (const a of emp.alias) {
          const yaExiste = existente.aliases?.some((x) => x.alias.toLowerCase() === a.toLowerCase());
          if (!yaExiste) {
            try {
              await prisma.beneficiarioAlias.create({
                data: { beneficiarioId: existente.id, alias: a },
              });
            } catch {
              // ignoro dupes (alias es @unique global)
            }
          }
        }
      }
      actualizados++;
      console.log(`  ↻ ${emp.nombre} (${emp.grupo}) — actualizado`);
    } else {
      const beneficiario = await prisma.beneficiario.create({
        data: {
          tipo: TipoBeneficiario.EMPLEADO,
          nombre: emp.nombre,
          observaciones: `Grupo: ${emp.grupo}`,
          legajo: { create: legajoData },
          aliases: emp.alias?.length
            ? { createMany: { data: emp.alias.map((alias) => ({ alias })), skipDuplicates: true } }
            : undefined,
        },
        include: { legajo: true },
      });
      // Entrada inicial en historial de jornales si hay jornal
      if (emp.jornal && beneficiario.legajo) {
        await prisma.empleadoJornalHistorico.create({
          data: {
            legajoId: beneficiario.legajo.id,
            jornal: emp.jornal,
            valorHoraExtra: emp.jornal ? Math.round((emp.jornal / 8) * 1.5) : null,
            vigenteDesde: new Date('2026-11-01'),
            motivo: 'Carga inicial desde Excel del cliente (Jornales 2024 "con Aumento")',
          },
        });
      }
      creados++;
      console.log(`  + ${emp.nombre} (${emp.grupo}) — creado`);
    }
  }

  console.log(`\n✓ Terminado: ${creados} creados · ${actualizados} actualizados · ${EMPLEADOS.length} total`);
  console.log('\nℹ  Los datos sensibles (DNI, CUIL, empresa, obra actual, fecha real de ingreso)');
  console.log('   se completan desde la ficha de cada empleado en /empleados/:id.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
