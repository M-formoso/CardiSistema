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

const OBRAS_CONOCIDAS = [
  { nombre: 'General Paz', tipo: TipoObra.OBRA },
  { nombre: 'Mont Petit', tipo: TipoObra.OBRA },
  { nombre: 'Rialto', tipo: TipoObra.OBRA },
  { nombre: 'Doma', tipo: TipoObra.OBRA },
  { nombre: 'Bower', tipo: TipoObra.OBRA },
  { nombre: 'Galpones Brasil', tipo: TipoObra.OBRA },
  { nombre: 'Gastos generales', tipo: TipoObra.GENERAL },
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
  { codigo: 'RET', nombre: 'Retiros', orden: 100 },
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
  const email = process.env.ADMIN_EMAIL ?? 'admin@cardi.local';
  const password = process.env.ADMIN_PASSWORD ?? 'cambiar-en-primer-login';
  const nombre = process.env.ADMIN_NOMBRE ?? 'Administrador Cardi';

  const passwordHash = await bcrypt.hash(password, 12);

  return prisma.usuario.upsert({
    where: { email },
    create: { email, nombre, passwordHash, rol: RolUsuario.ADMIN, activo: true },
    update: { nombre, rol: RolUsuario.ADMIN, activo: true },
  });
}

async function seedObras() {
  for (const obra of OBRAS_CONOCIDAS) {
    await prisma.obra.upsert({
      where: { nombre: obra.nombre },
      create: {
        nombre: obra.nombre,
        tipo: obra.tipo,
        estado: EstadoObra.ACTIVA,
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

async function main() {
  console.log('→ Sembrando datos provisorios (idempotente)');
  await seedConfiguracion();
  const admin = await seedAdmin();
  await seedObras();
  await seedCategorias();
  await seedCajas();
  console.log(`✓ Admin: ${admin.email}`);
  console.log(`✓ Obras: ${OBRAS_CONOCIDAS.length} (incluye "Gastos generales")`);
  console.log(`✓ Categorías: ${CATEGORIAS.length}`);
  console.log(`✓ Cajas: ${CAJAS.length}`);
  console.log('→ Listo. Reemplazar con datos reales tras el relevamiento con Cardi.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
