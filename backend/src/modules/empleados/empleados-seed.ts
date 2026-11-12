/**
 * Datos de carga inicial de empleados — tomados del Excel del cliente
 * "Precio de Jornales x empleado.xlsx" (hojas Jornales 2024 + Jornales $),
 * noviembre 2026.
 *
 * Esta lista se usa tanto desde el script CLI `pnpm empleados:cargar` como
 * desde el endpoint POST /empleados/cargar-iniciales.
 */

import type {
  Prisma,
  PrismaClient,
  SituacionFiscal,
} from '@prisma/client';
import { SituacionFiscal as SF, TipoBeneficiario } from '@prisma/client';

export type EmpleadoInicial = {
  nombre: string;
  alias?: string[];
  jornal?: number;
  montoSemanal?: number;
  categoriaCodigo?: string;
  grupo: string;
  situacion?: SituacionFiscal;
};

export const EMPLEADOS_INICIALES: EmpleadoInicial[] = [
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

  // Grupo Rialto (pago mensual fijo, aproximado a semanal / 4)
  { nombre: 'Pablo (Rialto)', alias: ['Pablo'], montoSemanal: 400000, grupo: 'Rialto' },
];

export type ResultadoCarga = {
  total: number;
  creados: number;
  actualizados: number;
  categoriasFaltantes: boolean;
};

/**
 * Carga (o completa) los empleados iniciales en la DB.
 * Idempotente: busca por nombre case-insensitive, crea si no existe, o
 * completa campos vacíos y agrega alias nuevos sin pisar lo ya cargado.
 */
export async function cargarEmpleadosIniciales(
  prisma: PrismaClient | Prisma.TransactionClient,
): Promise<ResultadoCarga> {
  // Catálogo de categorías disponibles
  const categorias = await (prisma as PrismaClient).categoriaEmpleado.findMany();
  const categoriaPorCodigo = new Map(categorias.map((c) => [c.codigo, c]));
  const categoriasFaltantes = categorias.length === 0;

  let creados = 0;
  let actualizados = 0;

  for (const emp of EMPLEADOS_INICIALES) {
    const existente = await (prisma as PrismaClient).beneficiario.findFirst({
      where: {
        tipo: TipoBeneficiario.EMPLEADO,
        nombre: { equals: emp.nombre, mode: 'insensitive' },
      },
      include: { legajo: true, aliases: true },
    });

    const categoriaId = emp.categoriaCodigo
      ? (categoriaPorCodigo.get(emp.categoriaCodigo)?.id ?? null)
      : null;

    const valorHoraExtra = emp.jornal ? Math.round((emp.jornal / 8) * 1.5) : null;

    if (existente) {
      // Update: completo solo campos vacíos (no piso ediciones manuales)
      await (prisma as PrismaClient).empleadoLegajo.update({
        where: { beneficiarioId: existente.id },
        data: {
          categoriaId: existente.legajo?.categoriaId ?? categoriaId,
          jornal: existente.legajo?.jornal ?? emp.jornal,
          montoSemanal: existente.legajo?.montoSemanal ?? emp.montoSemanal,
          valorHoraExtra: existente.legajo?.valorHoraExtra ?? valorHoraExtra,
        },
      });
      if (emp.alias) {
        for (const a of emp.alias) {
          const yaExiste = existente.aliases?.some(
            (x) => x.alias.toLowerCase() === a.toLowerCase(),
          );
          if (!yaExiste) {
            try {
              await (prisma as PrismaClient).beneficiarioAlias.create({
                data: { beneficiarioId: existente.id, alias: a },
              });
            } catch {
              // Ignoro dupes (alias es @unique global)
            }
          }
        }
      }
      actualizados++;
    } else {
      const beneficiario = await (prisma as PrismaClient).beneficiario.create({
        data: {
          tipo: TipoBeneficiario.EMPLEADO,
          nombre: emp.nombre,
          observaciones: `Grupo: ${emp.grupo}`,
          legajo: {
            create: {
              fechaIngreso: new Date('2026-01-01'),
              categoriaId,
              situacionFiscal: emp.situacion ?? SF.NEGRO,
              jornal: emp.jornal ?? null,
              montoSemanal: emp.montoSemanal ?? null,
              valorHoraExtra,
            },
          },
          aliases: emp.alias?.length
            ? {
                createMany: {
                  data: emp.alias.map((alias) => ({ alias })),
                  skipDuplicates: true,
                },
              }
            : undefined,
        },
        include: { legajo: true },
      });
      if (emp.jornal && beneficiario.legajo) {
        await (prisma as PrismaClient).empleadoJornalHistorico.create({
          data: {
            legajoId: beneficiario.legajo.id,
            jornal: emp.jornal,
            valorHoraExtra,
            vigenteDesde: new Date('2026-11-01'),
            motivo: 'Carga inicial desde Excel del cliente',
          },
        });
      }
      creados++;
    }
  }

  return { total: EMPLEADOS_INICIALES.length, creados, actualizados, categoriasFaltantes };
}
