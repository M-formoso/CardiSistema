/**
 * Importa los gastos de octubre y noviembre 2026 desde la planilla de Cardi.
 *
 * Fuente: Copia de Planilla de Caja.xlsx — solapa "Gastos 2026"
 * Columnas:
 *   A fecha, B descripción, C monto ARS, D cotización blue, E monto USD
 *
 * Estructura implícita de la planilla:
 * Hay filas "header" sin monto cuya descripción identifica la OBRA / agrupador.
 * Las filas subsiguientes con monto son los gastos imputados a esa obra hasta
 * el próximo header. Headers detectados:
 *   - Gastos Empleados → obra "GENERAL" + cat "Jornales"
 *   - Gastos Empresa → obra "GENERAL" + cat "Gastos generales"
 *   - Juampy gastos → obra "Juan Pablo Casa Obra" (empleado-obra)
 *   - General Paz / Bowuer / Rialto Complejo / Casa Dani / Joule / Riego → obra homónima
 *
 * Mapping de beneficiarios: diccionario inline por "contains" del lowercase
 * de la descripción. Caso especial "Mami" → beneficiario "Adriana Picardi"
 * (CONTRATISTA) imputado SIEMPRE a Rialto Complejo (override del header).
 *
 * Caso especial decidido con Mateo (18/11 tarde):
 *   - Oficios genéricos (Albañileria, Plomeria, Herreros, jornales sin dueño)
 *     se dejan SIN beneficiario, solo descripción + obra del header.
 *   - Retiros aparentes (Cardi, Dani, Daniel) se imputan a GENERAL sin beneficiario.
 *
 * Idempotencia: crea un MigracionLote por archivo+hoja. Por cada fila del
 * Excel crea un MigracionFila (@@unique [loteId, fila]). Si la fila ya tiene
 * movimiento, skipea. Reejecutar el mismo lote NO duplica.
 *
 * Uso:
 *   # dry-run (no escribe, solo reporte):
 *   pnpm --filter @cardi/backend exec ts-node \
 *     prisma/scripts/importar-gastos-planilla.ts --dry-run
 *
 *   # importación real:
 *   pnpm --filter @cardi/backend exec ts-node \
 *     prisma/scripts/importar-gastos-planilla.ts
 *
 * Variables:
 *   DATABASE_URL  — obligatoria (prod: Railway)
 *   PLANILLA_PATH — ruta al xlsx (default: /Users/mateoformoso/Downloads/Copia de Planilla de Caja.xlsx)
 */
import ExcelJS from 'exceljs';
import {
  EstadoMigracionFila,
  EstadoMigracionLote,
  EstadoMovimiento,
  CotizacionTipo,
  MedioPago,
  Moneda,
  OrigenMovimiento,
  Prisma,
  PrismaClient,
  TipoBeneficiario,
  TipoCaja,
  TipoMovimiento,
  TipoObra,
} from '@prisma/client';

type FilaCruda = {
  fila: number;
  fecha: string;
  desc: string;
  pesos: number | null;
  cot: number | null;
};

type FilaResuelta = {
  fila: number;
  fecha: Date;
  desc: string;
  pesos: number;
  cot: number;
  obraNombre: string;
  beneficiarioNombre: string | null;
  beneficiarioTipo: TipoBeneficiario | null;
  categoriaCodigo: string | null;
  headerOriginal: string;
};

const ARCHIVO =
  process.env.PLANILLA_PATH ??
  '/Users/mateoformoso/Downloads/Copia de Planilla de Caja.xlsx';
const HOJA = 'Gastos 2026';
const DRY_RUN = process.argv.includes('--dry-run');
const DESDE = '2026-10-01';
const HASTA = '2026-11-30';

// ============================================================
// Diccionarios de mapping
// ============================================================

/** Normaliza una descripción para matcheo case/accent-insensitive. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mapa de header (normalizado) → obra destino. */
const HEADER_A_OBRA: Record<string, { nombre: string; tipo: TipoObra }> = {
  'rialto complejo': { nombre: 'Rialto', tipo: TipoObra.OBRA },
  'general paz': { nombre: 'General Paz', tipo: TipoObra.OBRA },
  bowuer: { nombre: 'Bower', tipo: TipoObra.OBRA },
  bower: { nombre: 'Bower', tipo: TipoObra.OBRA },
  'casa dani': { nombre: 'Casa Dani', tipo: TipoObra.OBRA },
  joule: { nombre: 'Joule', tipo: TipoObra.OBRA },
  riego: { nombre: 'Riego', tipo: TipoObra.OBRA },
  'juampy gastos': { nombre: 'Juan Pablo Casa Obra', tipo: TipoObra.OBRA },
  'gastos empleados': { nombre: 'Gastos generales', tipo: TipoObra.GENERAL },
  'gastos empresa': { nombre: 'Gastos generales', tipo: TipoObra.GENERAL },
};

type Regla = {
  match: string[]; // tokens (ya normalizados) a buscar con `includes`
  nombre: string;
  tipo: TipoBeneficiario;
  forzarObra?: string; // override del header
  categoriaCodigo?: string;
};

/** Diccionario de beneficiarios: primera regla cuyo `match` coincida gana.
 *  Orden: más específico → más general. */
const REGLAS_BENEFICIARIO: Regla[] = [
  // Mami → Adriana Picardi, forzar obra Rialto Complejo
  {
    match: ['mami', 'estudios mami', 'operacion mami'],
    nombre: 'Adriana Picardi',
    tipo: TipoBeneficiario.CONTRATISTA,
    forzarObra: 'Rialto',
  },

  // Empleados específicos
  { match: ['empleados vcp'], nombre: 'Empleados VCP', tipo: TipoBeneficiario.EMPLEADO, categoriaCodigo: 'JORN' },
  { match: ['juampy'], nombre: 'Juan Pablo', tipo: TipoBeneficiario.EMPLEADO, categoriaCodigo: 'JORN' },
  { match: ['juan pablo'], nombre: 'Juan Pablo', tipo: TipoBeneficiario.EMPLEADO, categoriaCodigo: 'JORN' },
  { match: ['paez'], nombre: 'Paez', tipo: TipoBeneficiario.EMPLEADO, categoriaCodigo: 'JORN' },
  { match: ['lechu', 'lehcu'], nombre: 'Lechu', tipo: TipoBeneficiario.EMPLEADO, categoriaCodigo: 'JORN' },
  { match: ['jonas'], nombre: 'Jonas', tipo: TipoBeneficiario.EMPLEADO, categoriaCodigo: 'JORN' },
  { match: ['leo bv4', 'leo jornales', 'leo droma', 'leo mon petit', 'leo rialto'], nombre: 'Leo', tipo: TipoBeneficiario.EMPLEADO, categoriaCodigo: 'JORN' },
  { match: ['dania'], nombre: 'Dania', tipo: TipoBeneficiario.EMPLEADO, categoriaCodigo: 'JORN' },
  { match: ['lucas'], nombre: 'Lucas', tipo: TipoBeneficiario.EMPLEADO, categoriaCodigo: 'JORN' },
  { match: ['lopez'], nombre: 'Lopez', tipo: TipoBeneficiario.EMPLEADO, categoriaCodigo: 'JORN' },
  { match: ['momo'], nombre: 'Momo', tipo: TipoBeneficiario.EMPLEADO, categoriaCodigo: 'JORN' },
  { match: ['braian', 'daerio'], nombre: 'Braian/Daerio', tipo: TipoBeneficiario.EMPLEADO, categoriaCodigo: 'JORN' },

  // Contratistas / Profesionales
  { match: ['jhony', 'jony'], nombre: 'Jhony Electricista', tipo: TipoBeneficiario.CONTRATISTA, categoriaCodigo: 'CONTR' },
  { match: ['nacho'], nombre: 'Nacho', tipo: TipoBeneficiario.CONTRATISTA, categoriaCodigo: 'CONTR' },
  { match: ['sotelo'], nombre: 'Sotelo', tipo: TipoBeneficiario.CONTRATISTA, categoriaCodigo: 'CONTR' },
  { match: ['mati ', 'matias', 'maty'], nombre: 'Matias', tipo: TipoBeneficiario.CONTRATISTA, categoriaCodigo: 'CONTR' },
  { match: ['javi seg', 'javi seg&hig'], nombre: 'Javi Seguridad e Higiene', tipo: TipoBeneficiario.PROFESIONAL, categoriaCodigo: 'PROF' },

  // Proveedores
  { match: ['casa santos'], nombre: 'Casa Santos', tipo: TipoBeneficiario.PROVEEDOR, categoriaCodigo: 'MAT' },
  { match: ['ypf'], nombre: 'YPF', tipo: TipoBeneficiario.PROVEEDOR, categoriaCodigo: 'COMB' },
  { match: ['epec'], nombre: 'EPEC', tipo: TipoBeneficiario.PROVEEDOR, categoriaCodigo: 'EPEC' },
  { match: ['conte 7'], nombre: 'Conte 7', tipo: TipoBeneficiario.PROVEEDOR, categoriaCodigo: 'MAT' },
  { match: ['casa siquiman'], nombre: 'Casa Siquiman', tipo: TipoBeneficiario.PROVEEDOR, categoriaCodigo: 'MAT' },
  { match: ['pintecor'], nombre: 'Pintecor', tipo: TipoBeneficiario.PROVEEDOR, categoriaCodigo: 'MAT' },
  { match: ['sanifer'], nombre: 'Sanifer', tipo: TipoBeneficiario.PROVEEDOR, categoriaCodigo: 'MAT' },
  { match: ['proelctrik', 'prolectrik'], nombre: 'Proelctrik', tipo: TipoBeneficiario.PROVEEDOR, categoriaCodigo: 'MAT' },
  { match: ['fadepa'], nombre: 'Fadepa', tipo: TipoBeneficiario.PROVEEDOR, categoriaCodigo: 'MAT' },
  { match: ['innova'], nombre: 'Innova', tipo: TipoBeneficiario.PROVEEDOR, categoriaCodigo: 'MAT' },
  { match: ['reggio'], nombre: 'Reggio', tipo: TipoBeneficiario.PROVEEDOR, categoriaCodigo: 'MAT' },
  { match: ['claro'], nombre: 'Claro', tipo: TipoBeneficiario.PROVEEDOR, categoriaCodigo: 'SERV' },
  { match: ['medife'], nombre: 'Medife', tipo: TipoBeneficiario.PROVEEDOR, categoriaCodigo: 'SERV' },
];

/** Reglas por concepto (no asignan beneficiario, solo categoría). */
const REGLAS_CATEGORIA_SIN_BENE: Array<{ match: string[]; codigo: string }> = [
  { match: ['albanileria', 'albañileria'], codigo: 'JORN' },
  { match: ['plomeria', 'plomería'], codigo: 'JORN' },
  { match: ['herreros'], codigo: 'JORN' },
  { match: ['jornales'], codigo: 'JORN' },
  { match: ['uocra', 'ieric', 'monotributo'], codigo: 'IMP' },
  { match: ['seguros'], codigo: 'SEGUROS' },
  { match: ['alquiler'], codigo: 'SERV' },
  { match: ['asado'], codigo: 'GRAL' },
  { match: ['porton'], codigo: 'MAT' },
];

/** Descripciones que son retiros a GENERAL sin beneficiario. */
const CONCEPTOS_RETIRO = ['cardi', 'daniel'];

// ============================================================
// Resolver una fila a su mapping final
// ============================================================

function resolver(
  cruda: FilaCruda,
  headerActual: string,
): Omit<FilaResuelta, 'fila' | 'fecha' | 'pesos' | 'cot'> {
  const n = norm(cruda.desc);
  const headerNorm = norm(headerActual);

  // 1. Regla específica por beneficiario (gana sobre cualquier otra)
  for (const r of REGLAS_BENEFICIARIO) {
    if (r.match.some((m) => n.includes(m))) {
      return {
        desc: cruda.desc,
        obraNombre: r.forzarObra ?? HEADER_A_OBRA[headerNorm]?.nombre ?? 'Gastos generales',
        beneficiarioNombre: r.nombre,
        beneficiarioTipo: r.tipo,
        categoriaCodigo: r.categoriaCodigo ?? null,
        headerOriginal: headerActual,
      };
    }
  }

  // 2. Retiros (Cardi, Daniel) → GENERAL sin beneficiario
  if (CONCEPTOS_RETIRO.some((c) => n === c || n.startsWith(c + ' '))) {
    return {
      desc: cruda.desc,
      obraNombre: 'Gastos generales',
      beneficiarioNombre: null,
      beneficiarioTipo: null,
      categoriaCodigo: 'RET',
      headerOriginal: headerActual,
    };
  }
  // "Dani" solo → también retiro (pero no la "Casa Dani")
  if (n === 'dani') {
    return {
      desc: cruda.desc,
      obraNombre: 'Gastos generales',
      beneficiarioNombre: null,
      beneficiarioTipo: null,
      categoriaCodigo: 'RET',
      headerOriginal: headerActual,
    };
  }

  // 3. Conceptos genéricos → categoría + obra del header, sin beneficiario
  for (const r of REGLAS_CATEGORIA_SIN_BENE) {
    if (r.match.some((m) => n.includes(m))) {
      return {
        desc: cruda.desc,
        obraNombre: HEADER_A_OBRA[headerNorm]?.nombre ?? 'Gastos generales',
        beneficiarioNombre: null,
        beneficiarioTipo: null,
        categoriaCodigo: r.codigo,
        headerOriginal: headerActual,
      };
    }
  }

  // 4. Default: obra del header, sin beneficiario, sin categoría
  return {
    desc: cruda.desc,
    obraNombre: HEADER_A_OBRA[headerNorm]?.nombre ?? 'Gastos generales',
    beneficiarioNombre: null,
    beneficiarioTipo: null,
    categoriaCodigo: null,
    headerOriginal: headerActual,
  };
}

// ============================================================
// Parser del XLSX
// ============================================================

async function parsearPlanilla(): Promise<FilaResuelta[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ARCHIVO);
  const sh = wb.getWorksheet(HOJA);
  if (!sh) throw new Error(`No se encontró la solapa "${HOJA}"`);

  const crudas: FilaCruda[] = [];
  for (let r = 4; r <= sh.actualRowCount; r++) {
    const row = sh.getRow(r);
    const cFecha = row.getCell(1).value;
    let cDesc = row.getCell(2).value;
    let cPesos = row.getCell(3).value;
    let cCot = row.getCell(4).value;

    let fecha: string | null = null;
    if (cFecha instanceof Date) fecha = cFecha.toISOString().slice(0, 10);
    else if (typeof cFecha === 'string') fecha = cFecha;

    if (cDesc && typeof cDesc === 'object' && 'richText' in cDesc) {
      cDesc = (cDesc.richText as Array<{ text: string }>).map((t) => t.text).join('');
    }
    if (cPesos && typeof cPesos === 'object' && 'result' in cPesos) {
      cPesos = (cPesos as { result: number }).result;
    }
    if (cCot && typeof cCot === 'object' && 'result' in cCot) {
      cCot = (cCot as { result: number }).result;
    }

    if (!fecha || !cDesc) continue;
    const pesos = typeof cPesos === 'number' ? cPesos : null;
    const cot = typeof cCot === 'number' ? cCot : null;
    crudas.push({
      fila: r,
      fecha,
      desc: String(cDesc).trim(),
      pesos,
      cot,
    });
  }

  // Filtrar por rango
  const enRango = crudas.filter((c) => c.fecha >= DESDE && c.fecha <= HASTA);

  // Detectar headers (sin monto) y asociar cada gasto a su header actual
  const resueltas: FilaResuelta[] = [];
  let headerActual = 'Gastos Empresa'; // fallback

  for (const c of enRango) {
    const esHeader = !c.pesos || c.pesos === 0;
    if (esHeader) {
      headerActual = c.desc;
      continue;
    }
    if (!c.cot || c.cot <= 0) {
      console.warn(`[WARN] fila ${c.fila} sin cotización, skip: ${c.desc}`);
      continue;
    }
    const resuelto = resolver(c, headerActual);
    resueltas.push({
      fila: c.fila,
      fecha: new Date(c.fecha + 'T12:00:00'),
      pesos: c.pesos!,
      cot: c.cot,
      ...resuelto,
    });
  }

  return resueltas;
}

// ============================================================
// Reporte de dry-run
// ============================================================

function reporteDryRun(filas: FilaResuelta[]) {
  console.log('\n=========== REPORTE DRY-RUN ===========\n');
  console.log(`Total filas a importar: ${filas.length}`);
  console.log(`Total ARS: $${filas.reduce((a, b) => a + b.pesos, 0).toLocaleString('es-AR')}`);

  const obrasSet = new Set(filas.map((f) => f.obraNombre));
  console.log(`\n--- Obras (${obrasSet.size}) ---`);
  for (const o of obrasSet) {
    const subset = filas.filter((f) => f.obraNombre === o);
    const total = subset.reduce((a, b) => a + b.pesos, 0);
    console.log(`  ${o.padEnd(25)} ${String(subset.length).padStart(4)} filas · $${total.toLocaleString('es-AR')}`);
  }

  const benesSet = new Set(filas.map((f) => f.beneficiarioNombre).filter(Boolean));
  console.log(`\n--- Beneficiarios (${benesSet.size}) ---`);
  for (const b of benesSet) {
    const subset = filas.filter((f) => f.beneficiarioNombre === b);
    const tipos = new Set(subset.map((f) => f.beneficiarioTipo));
    const total = subset.reduce((a, b2) => a + b2.pesos, 0);
    console.log(`  ${b!.padEnd(25)} [${[...tipos].join('/')}]  ${String(subset.length).padStart(3)} filas · $${total.toLocaleString('es-AR')}`);
  }

  const sinBene = filas.filter((f) => !f.beneficiarioNombre);
  console.log(`\n--- Sin beneficiario (${sinBene.length} filas, $${sinBene.reduce((a, b) => a + b.pesos, 0).toLocaleString('es-AR')}) ---`);
  const grupBySinBene = new Map<string, { count: number; total: number }>();
  for (const f of sinBene) {
    const k = f.desc.toLowerCase().replace(/\s+\$?\d[\d,.]*$/, '').trim();
    if (!grupBySinBene.has(k)) grupBySinBene.set(k, { count: 0, total: 0 });
    const g = grupBySinBene.get(k)!;
    g.count++;
    g.total += f.pesos;
  }
  const ordenadas = [...grupBySinBene.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [k, v] of ordenadas) {
    console.log(`  "${k}"  ${String(v.count).padStart(3)}x  $${v.total.toLocaleString('es-AR')}`);
  }

  console.log('\n========================================\n');
}

// ============================================================
// Escritura en DB
// ============================================================

async function importar(filas: FilaResuelta[]) {
  const prisma = new PrismaClient();
  try {
    // Admin para auditoría
    const admin = await prisma.usuario.findFirst({
      where: { rol: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) throw new Error('No se encontró un usuario ADMIN en la DB');
    console.log(`[import] Usuario admin: ${admin.email}`);

    // Caja efectivo
    const caja = await prisma.caja.findFirst({
      where: { tipo: TipoCaja.EFECTIVO, moneda: Moneda.ARS, activo: true },
    });
    if (!caja) throw new Error('No hay caja EFECTIVO/ARS activa');
    console.log(`[import] Caja: ${caja.nombre}`);

    // Upsert obras
    const obrasNecesarias = new Set(filas.map((f) => f.obraNombre));
    const obraId = new Map<string, string>();
    for (const nombre of obrasNecesarias) {
      const tipo = Object.values(HEADER_A_OBRA).find((o) => o.nombre === nombre)?.tipo ?? TipoObra.OBRA;
      const o = await prisma.obra.upsert({
        where: { nombre },
        create: {
          nombre,
          tipo,
          activo: true,
          createdById: admin.id,
          updatedById: admin.id,
        },
        update: {},
      });
      obraId.set(nombre, o.id);
      console.log(`  obra ${nombre} → ${o.id.slice(0, 8)}…`);
    }

    // Upsert beneficiarios (por nombre + tipo)
    const benesNecesarios = new Map<string, TipoBeneficiario>();
    for (const f of filas) {
      if (f.beneficiarioNombre && f.beneficiarioTipo) {
        benesNecesarios.set(f.beneficiarioNombre, f.beneficiarioTipo);
      }
    }
    const beneId = new Map<string, string>();
    for (const [nombre, tipo] of benesNecesarios) {
      // Matching case-insensitive — reusa el existente si hay (ej. "casa santos"
      // ya cargado → se reutiliza y actualiza al nombre prolijo "Casa Santos").
      let b = await prisma.beneficiario.findFirst({
        where: { nombre: { equals: nombre, mode: 'insensitive' } },
      });
      if (b) {
        if (b.nombre !== nombre) {
          b = await prisma.beneficiario.update({
            where: { id: b.id },
            data: { nombre, updatedById: admin.id },
          });
          console.log(`  ~ benef. "${b.nombre}" (renombrado desde variante en minúscula)`);
        }
      } else {
        b = await prisma.beneficiario.create({
          data: {
            nombre,
            tipo,
            activo: true,
            createdById: admin.id,
            updatedById: admin.id,
          },
        });
        console.log(`  + benef. ${nombre} [${tipo}]`);
      }
      beneId.set(nombre, b.id);
    }

    // Categorías existentes
    const categorias = await prisma.categoriaGasto.findMany();
    const catId = new Map(categorias.map((c) => [c.codigo, c.id]));

    // Crear/reutilizar MigracionLote
    const lote = await prisma.migracionLote.upsert({
      where: { id: await lotIdHash(prisma) },
      create: {
        id: await lotIdHash(prisma),
        archivo: 'planilla-caja-2026.xlsx',
        hoja: 'Gastos 2026 (oct-nov)',
        descripcion: `Importación oct+nov 2026 desde planilla de Cardi`,
        estado: EstadoMigracionLote.IMPORTANDO,
        createdById: admin.id,
      },
      update: {},
    });
    console.log(`[import] Lote: ${lote.id}`);

    let importados = 0;
    let skipped = 0;
    for (const f of filas) {
      // Upsert MigracionFila por (loteId, fila)
      const filaRec = await prisma.migracionFila.upsert({
        where: { loteId_fila: { loteId: lote.id, fila: f.fila } },
        create: {
          loteId: lote.id,
          fila: f.fila,
          datos: {
            fecha: f.fecha.toISOString().slice(0, 10),
            desc: f.desc,
            pesos: f.pesos,
            cot: f.cot,
            header: f.headerOriginal,
            obra: f.obraNombre,
            beneficiario: f.beneficiarioNombre,
            categoria: f.categoriaCodigo,
          },
          estado: EstadoMigracionFila.PENDIENTE,
        },
        update: {},
        include: { movimientos: true },
      });

      if (filaRec.movimientos.length > 0) {
        skipped++;
        continue;
      }

      const obraIdFinal = obraId.get(f.obraNombre)!;
      const beneIdFinal = f.beneficiarioNombre ? beneId.get(f.beneficiarioNombre)! : null;
      const catIdFinal = f.categoriaCodigo ? catId.get(f.categoriaCodigo) ?? null : null;

      const montoArs = f.pesos;
      const montoUsd = f.pesos / f.cot;

      await prisma.$transaction(async (tx) => {
        const mov = await tx.movimiento.create({
          data: {
            tipo: TipoMovimiento.EGRESO,
            fecha: f.fecha,
            cajaId: caja.id,
            moneda: Moneda.ARS,
            monto: new Prisma.Decimal(montoArs.toFixed(2)),
            medioPago: MedioPago.EFECTIVO,
            descripcion: f.desc,
            cotizacion: new Prisma.Decimal(f.cot.toFixed(4)),
            cotizacionTipo: CotizacionTipo.PLANILLA,
            montoArs: new Prisma.Decimal(montoArs.toFixed(2)),
            montoUsd: new Prisma.Decimal(montoUsd.toFixed(2)),
            beneficiarioId: beneIdFinal,
            categoriaId: catIdFinal,
            origen: OrigenMovimiento.MIGRACION,
            origenId: lote.id,
            migracionFilaId: filaRec.id,
            estado: EstadoMovimiento.CONFIRMADO,
            createdById: admin.id,
            updatedById: admin.id,
            imputaciones: {
              create: [
                {
                  obraId: obraIdFinal,
                  monto: new Prisma.Decimal(montoArs.toFixed(2)),
                  porcentaje: new Prisma.Decimal('100.0000'),
                },
              ],
            },
          },
        });
        await tx.migracionFila.update({
          where: { id: filaRec.id },
          data: { estado: EstadoMigracionFila.IMPORTADA },
        });
        return mov;
      });

      importados++;
      if (importados % 25 === 0) console.log(`  [${importados}] ${f.fecha.toISOString().slice(0, 10)} · $${f.pesos.toLocaleString('es-AR')} · ${f.desc}`);
    }

    await prisma.migracionLote.update({
      where: { id: lote.id },
      data: { estado: EstadoMigracionLote.IMPORTADO },
    });

    console.log(`\n[import] LISTO. Importados: ${importados} · Skipped (ya existían): ${skipped}`);
  } finally {
    await prisma.$disconnect();
  }
}

/** ID determinístico del lote para idempotencia. */
async function lotIdHash(_prisma: PrismaClient): Promise<string> {
  const crypto = await import('node:crypto');
  const h = crypto.createHash('sha1').update('planilla-caja-2026.xlsx|Gastos 2026 oct-nov').digest('hex');
  // UUID formato: 8-4-4-4-12
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(`[import] Archivo: ${ARCHIVO}`);
  console.log(`[import] Hoja: ${HOJA}`);
  console.log(`[import] Rango: ${DESDE} → ${HASTA}`);
  console.log(`[import] Modo: ${DRY_RUN ? 'DRY-RUN (no escribe)' : 'ESCRITURA EN DB'}`);
  if (!DRY_RUN) console.log(`[import] DATABASE_URL: ${(process.env.DATABASE_URL ?? '').slice(0, 40)}…`);

  const filas = await parsearPlanilla();
  reporteDryRun(filas);

  if (DRY_RUN) {
    console.log('[import] Dry-run completado. Corré sin --dry-run para escribir.');
    return;
  }

  await importar(filas);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n[import] Error:', err);
    process.exit(1);
  });
