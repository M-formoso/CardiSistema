/**
 * Seed del Sistema Cardi.
 *
 * Datos provisorios para arrancar: admin, obras conocidas,
 * categorías base y cajas ARS/USD de ejemplo. Se reemplazan con
 * datos reales durante la Fase 1 del relevamiento con Cardi.
 *
 * Es idempotente: se puede correr varias veces sin duplicar
 * (usa upsert por campos únicos).
 */

import {
  CotizacionTipo,
  EstadoObra,
  Moneda,
  PrismaClient,
  RolUsuario,
  TipoCaja,
  TipoObra,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Obras conocidas tomadas de las 40 hojas del Excel "Costo Por Obra hasta 2025.xlsx"
 * del cliente, más las obras nuevas de 2026 y la obra administrativa "Gastos
 * generales" (bucket obligatorio para costos de empresa). "Varios" es el
 * destino de pagos a gente que trabaja repartido o en trabajos puntuales
 * que no son una obra formal. Los nombres respetan la ortografía del cliente
 * (ej. "Mon Petit", "Droma", "Bowuer") — en la migración los alias resuelven
 * las variantes ("Bower" → "Bowuer", etc.).
 */
const OBRAS_CONOCIDAS = [
  // Obras activas / recientes (seed original)
  { nombre: 'General Paz', tipo: TipoObra.OBRA },
  { nombre: 'Mon Petit', tipo: TipoObra.OBRA },
  { nombre: 'Rialto', tipo: TipoObra.OBRA },
  { nombre: 'Droma', tipo: TipoObra.OBRA },
  { nombre: 'Bowuer', tipo: TipoObra.OBRA },
  { nombre: 'Galpones Brasil', tipo: TipoObra.OBRA },
  { nombre: 'Tierra Alta', tipo: TipoObra.OBRA },
  { nombre: 'Fonte', tipo: TipoObra.OBRA },
  { nombre: 'Bior', tipo: TipoObra.OBRA },
  { nombre: 'Namba', tipo: TipoObra.OBRA },
  { nombre: 'Namba 2', tipo: TipoObra.OBRA },
  { nombre: 'Duvet', tipo: TipoObra.OBRA },
  { nombre: 'Impero', tipo: TipoObra.OBRA },
  { nombre: 'Reggio', tipo: TipoObra.OBRA },
  { nombre: 'Vicente', tipo: TipoObra.OBRA },
  { nombre: 'Wo', tipo: TipoObra.OBRA },
  { nombre: 'Stefano V', tipo: TipoObra.OBRA },
  { nombre: 'Stefano VI', tipo: TipoObra.OBRA },
  { nombre: 'Stefano VIII', tipo: TipoObra.OBRA },
  // Obras históricas (Costo Por Obra hasta 2025)
  { nombre: 'Buena Vista', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Buena Vista II', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Buena Vista III', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Buena Vista IV', tipo: TipoObra.OBRA },
  { nombre: 'Derki', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Neper', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Cibeles', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Paseo Quatro', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Buenos Aires', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Jesús María', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Ortiz y Herrera', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Constantino VI', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Cañitas Ruben Mers', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Bere 4', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Avellaneda', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Florida', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Cañitas Olmedo', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Sileno', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Alante Leones', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Tucumán', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Mont Oncativo', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'James Craik', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Marcos Juárez', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Matienzo', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'José Ing', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Cañuelas Scurti', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Friulli', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Vigore Pilar', tipo: TipoObra.OBRA, estadoHistorico: true },
  { nombre: 'Biro Oliva', tipo: TipoObra.OBRA, estadoHistorico: true },
  // Especiales
  { nombre: 'Varios', tipo: TipoObra.UNIDAD_NEGOCIO },
  { nombre: 'Gastos generales', tipo: TipoObra.GENERAL },
] as const;

/**
 * Categorías laborales con jornal y hora extra "de referencia" según la
 * columna CATEGORIA del excel "Jornales $" y la nómina actual. Los valores
 * iniciales salen del snapshot "con aumento" de noviembre 2026 de la nómina.
 * Hora extra default = jornal / 8 × 1.5.
 */
const CATEGORIAS_EMPLEADO = [
  { codigo: 'OF_CAP', nombre: 'Oficial Capataz', jornal: 75000, orden: 10 },
  { codigo: 'OF_SOL', nombre: 'Oficial Soldador', jornal: 70000, orden: 20 },
  { codigo: 'OF_ESP', nombre: 'Oficial Especializado', jornal: 75000, orden: 30 },
  { codigo: 'OF', nombre: 'Oficial', jornal: 65000, orden: 40 },
  { codigo: 'MO_BUENO', nombre: '1/2 Oficial Bueno', jornal: 60000, orden: 50 },
  { codigo: 'MO', nombre: '1/2 Oficial', jornal: 55000, orden: 60 },
  { codigo: 'AYU', nombre: 'Ayudante', jornal: 50000, orden: 70 },
] as const;

const CATEGORIAS = [
  { codigo: 'JORN', nombre: 'Jornales', orden: 10 },
  { codigo: 'CONTR', nombre: 'Contratistas', orden: 20 },
  { codigo: 'MAT', nombre: 'Materiales', orden: 30 },
  { codigo: 'FLETE', nombre: 'Fletes', orden: 40 },
  { codigo: 'COMB', nombre: 'Combustible', orden: 50 },
  { codigo: 'PROF', nombre: 'Profesionales', orden: 60 },
  { codigo: 'IMP', nombre: 'Impuestos', orden: 70 },
  { codigo: 'SERV', nombre: 'Servicios', orden: 80 },
  { codigo: 'GRAL', nombre: 'Gastos generales', orden: 90 },
  { codigo: 'PREST_EMP', nombre: 'Préstamos a empleados', orden: 95 },
  { codigo: 'RET', nombre: 'Retiros', orden: 100 },
] as const;

const EMPRESAS = [
  { nombre: 'Cardi' },
  { nombre: 'Picardi' },
] as const;

const CAJAS = [
  {
    nombre: 'Efectivo ARS',
    tipo: TipoCaja.EFECTIVO,
    moneda: Moneda.ARS,
  },
  {
    nombre: 'Efectivo USD',
    tipo: TipoCaja.EFECTIVO,
    moneda: Moneda.USD,
  },
  {
    nombre: 'Banco (pendiente de definir)',
    tipo: TipoCaja.BANCO,
    moneda: Moneda.ARS,
  },
  {
    nombre: 'Cheques de terceros',
    tipo: TipoCaja.CHEQUES_TERCEROS,
    moneda: Moneda.ARS,
  },
] as const;

async function seedConfiguracion() {
  const existente = await prisma.configuracionEmpresa.findFirst();
  if (existente) return existente;
  return prisma.configuracionEmpresa.create({
    data: {
      razonSocial: 'Cardi',
      nombreFantasia: 'Cardi',
      cuit: '0', // a cargar en el relevamiento
      cotizacionTipoDefault: CotizacionTipo.BLUE_VENTA,
      diaPagoSemanal: 5, // viernes por defecto; se confirma con Cardi
    },
  });
}

async function seedAdmin() {
  const username = (process.env.ADMIN_USERNAME ?? 'admin').trim().toLowerCase();
  const email = process.env.ADMIN_EMAIL ?? null;
  const password = process.env.ADMIN_PASSWORD ?? 'cambiar-en-primer-login';
  const nombre = process.env.ADMIN_NOMBRE ?? 'Administrador Cardi';

  const passwordHash = await bcrypt.hash(password, 12);

  return prisma.usuario.upsert({
    where: { username },
    create: { username, email, nombre, passwordHash, rol: RolUsuario.ADMIN, activo: true },
    // También actualiza passwordHash: si cambiás ADMIN_PASSWORD y re-corrés
    // el seed, queda aplicada la nueva clave.
    update: { email, nombre, passwordHash, rol: RolUsuario.ADMIN, activo: true },
  });
}

async function seedObras() {
  for (const obra of OBRAS_CONOCIDAS) {
    const esHistorica = 'estadoHistorico' in obra && obra.estadoHistorico;
    await prisma.obra.upsert({
      where: { nombre: obra.nombre },
      create: {
        nombre: obra.nombre,
        tipo: obra.tipo,
        estado: esHistorica ? EstadoObra.TERMINADA : EstadoObra.ACTIVA,
        activo: true,
      },
      update: {}, // no pisar ediciones manuales si ya existe
    });
  }
}

async function seedCategorias() {
  for (const cat of CATEGORIAS) {
    await prisma.categoriaGasto.upsert({
      where: { codigo: cat.codigo },
      create: { codigo: cat.codigo, nombre: cat.nombre, orden: cat.orden, activo: true },
      update: {},
    });
  }
}

async function seedCajas() {
  for (const caja of CAJAS) {
    await prisma.caja.upsert({
      where: { nombre: caja.nombre },
      create: {
        nombre: caja.nombre,
        tipo: caja.tipo,
        moneda: caja.moneda,
        saldoInicial: 0,
        fechaSaldoInicial: new Date('2026-01-01'),
        activo: true,
      },
      update: {},
    });
  }
}

async function seedEmpresas() {
  for (const empresa of EMPRESAS) {
    await prisma.empresa.upsert({
      where: { nombre: empresa.nombre },
      create: { nombre: empresa.nombre, activo: true },
      update: {},
    });
  }
}

async function seedCategoriasEmpleado() {
  for (const cat of CATEGORIAS_EMPLEADO) {
    const horaExtra = Math.round((cat.jornal / 8) * 1.5);
    await prisma.categoriaEmpleado.upsert({
      where: { codigo: cat.codigo },
      create: {
        codigo: cat.codigo,
        nombre: cat.nombre,
        jornal: cat.jornal,
        valorHoraExtra: horaExtra,
        orden: cat.orden,
        activo: true,
      },
      update: {}, // no pisamos jornales actuales si ya existen
    });
  }
}

async function main() {
  console.log('→ Sembrando datos provisorios (idempotente)');
  await seedConfiguracion();
  const admin = await seedAdmin();
  await seedObras();
  await seedCategorias();
  await seedCajas();
  await seedEmpresas();
  await seedCategoriasEmpleado();
  console.log(`✓ Admin: ${admin.username}${admin.email ? ` (${admin.email})` : ''}`);
  console.log(`✓ Obras: ${OBRAS_CONOCIDAS.length} (incluye "Gastos generales" y "Varios")`);
  console.log(`✓ Categorías de gasto: ${CATEGORIAS.length} (incluye "Préstamos a empleados")`);
  console.log(`✓ Cajas: ${CAJAS.length}`);
  console.log(`✓ Empresas: ${EMPRESAS.length}`);
  console.log(`✓ Categorías de empleado: ${CATEGORIAS_EMPLEADO.length} (Of. Capataz, Of., 1/2 Of., Ayudante, etc.)`);
  console.log('→ Listo. Reemplazar con datos reales tras el relevamiento con Cardi.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
