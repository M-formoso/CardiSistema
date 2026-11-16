/**
 * Backfill de ingresos para cheques TERCERO cargados antes de la unificación
 * (fix 2026-11-16): hasta esa fecha ChequesService.create solo insertaba el
 * cheque, sin generar el movimiento INGRESO a Caja Cheques. Este script
 * recorre los cheques TERCERO existentes que no tengan un INGRESO vigente
 * asociado y les genera el movimiento correspondiente.
 *
 * Es IDEMPOTENTE: si se corre varias veces, no duplica (filtra por
 * `movimientos: none: INGRESO vigente`). Si no encuentra caja CHEQUES_TERCEROS
 * de la moneda del cheque, lo saltea y lo registra en el log para resolver
 * a mano.
 *
 * Uso:  pnpm --filter @cardi/backend exec ts-node prisma/scripts/backfill-cheques-ingresos.ts
 */
import {
  CotizacionTipo,
  EstadoCheque,
  EstadoMovimiento,
  FuenteCotizacion,
  MedioPago,
  Moneda,
  OrigenMovimiento,
  PrismaClient,
  TipoCaja,
  TipoCheque,
  TipoMovimiento,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { arsAUsd, usdAArs } from '@cardi/shared';

const prisma = new PrismaClient();

type Resumen = {
  procesados: number;
  saltadosSinCaja: Array<{ id: string; numero: string; moneda: Moneda }>;
  saltadosEstadoNoValido: Array<{ id: string; numero: string; estado: EstadoCheque }>;
};

async function main() {
  const resumen: Resumen = { procesados: 0, saltadosSinCaja: [], saltadosEstadoNoValido: [] };

  // Cheques TERCERO que no tengan ya un INGRESO vigente asociado (chequeId).
  const cheques = await prisma.cheque.findMany({
    where: {
      tipo: TipoCheque.TERCERO,
      movimientos: {
        none: { tipo: TipoMovimiento.INGRESO, estado: { not: EstadoMovimiento.ANULADO } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`[backfill] Cheques TERCERO sin INGRESO vigente: ${cheques.length}`);

  if (cheques.length === 0) {
    console.log('[backfill] Nada que hacer.');
    return resumen;
  }

  // Cotización de referencia: la última blue disponible. Si no hay ninguna
  // el script aborta (mejor fallar ruidoso que meter cotización 0).
  const ultimaCot = await prisma.cotizacionDolar.findFirst({
    where: { tipo: 'BLUE' },
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
  });
  if (!ultimaCot) {
    throw new Error(
      'No hay cotización BLUE en la base. Cargá una primero antes de correr el backfill.',
    );
  }
  const cotizacion = Number(ultimaCot.venta);
  const cotizacionTipo =
    ultimaCot.fuente === FuenteCotizacion.MANUAL
      ? CotizacionTipo.MANUAL
      : CotizacionTipo.BLUE_VENTA;

  for (const cheque of cheques) {
    // Solo retroactivamos los que todavía están EN_CARTERA. Los que ya pasaron
    // a otro estado (ENTREGADO/DEPOSITADO/COBRADO/ANULADO) no generan ingreso
    // porque conceptualmente ya salieron o nunca existieron contablemente.
    if (cheque.estado !== EstadoCheque.EN_CARTERA) {
      resumen.saltadosEstadoNoValido.push({
        id: cheque.id,
        numero: cheque.numero,
        estado: cheque.estado,
      });
      continue;
    }

    // Caja CHEQUES_TERCEROS activa de la moneda del cheque. Si hay más de una,
    // elegimos la más antigua (criterio arbitrario pero determinístico).
    const cajas = await prisma.caja.findMany({
      where: { tipo: TipoCaja.CHEQUES_TERCEROS, moneda: cheque.moneda, activo: true },
      orderBy: { createdAt: 'asc' },
    });
    if (cajas.length === 0) {
      resumen.saltadosSinCaja.push({
        id: cheque.id,
        numero: cheque.numero,
        moneda: cheque.moneda,
      });
      continue;
    }
    const caja = cajas[0];

    const monto = Number(cheque.monto);
    const { montoArs, montoUsd } = convertirMontos(monto, caja.moneda, cotizacion);
    const descripcion = descripcionCheque(cheque);

    await prisma.movimiento.create({
      data: {
        tipo: TipoMovimiento.INGRESO,
        fecha: cheque.fechaEmision,
        cajaId: caja.id,
        moneda: caja.moneda,
        monto: new Prisma.Decimal(monto),
        medioPago: MedioPago.CHEQUE_TERCERO,
        descripcion,
        cotizacion: new Prisma.Decimal(cotizacion),
        cotizacionTipo,
        montoArs: new Prisma.Decimal(montoArs),
        montoUsd: new Prisma.Decimal(montoUsd),
        beneficiarioId: cheque.beneficiarioId,
        chequeId: cheque.id,
        origen: OrigenMovimiento.MANUAL,
        origenId: cheque.id,
        estado: EstadoMovimiento.CONFIRMADO,
        createdById: cheque.createdById,
        updatedById: cheque.createdById,
      },
    });
    resumen.procesados += 1;
    console.log(`  ✓ ${cheque.numero} · ${caja.nombre} · ${monto} ${caja.moneda}`);
  }

  console.log('\n[backfill] Resumen:');
  console.log(`  Procesados: ${resumen.procesados}`);
  if (resumen.saltadosEstadoNoValido.length > 0) {
    console.log(`  Saltados (estado ya avanzado): ${resumen.saltadosEstadoNoValido.length}`);
    resumen.saltadosEstadoNoValido.forEach((s) =>
      console.log(`    - ${s.numero} (${s.estado})`),
    );
  }
  if (resumen.saltadosSinCaja.length > 0) {
    console.log(`  Saltados (no hay caja CHEQUES_TERCEROS en la moneda): ${resumen.saltadosSinCaja.length}`);
    resumen.saltadosSinCaja.forEach((s) =>
      console.log(`    - ${s.numero} (${s.moneda}) — crear la caja y volver a correr`),
    );
  }

  return resumen;
}

function descripcionCheque(cheque: {
  numero: string;
  banco: string | null;
  librador: string | null;
  titular: string | null;
}): string {
  const partes = [`Cheque N° ${cheque.numero}`];
  if (cheque.banco) partes.push(cheque.banco);
  const emisor = cheque.librador ?? cheque.titular;
  if (emisor) partes.push(emisor);
  return partes.join(' · ');
}

function convertirMontos(
  monto: number,
  moneda: Moneda,
  cotizacion: number,
): { montoArs: string; montoUsd: string } {
  if (moneda === Moneda.ARS) {
    return {
      montoArs: monto.toFixed(2),
      montoUsd: arsAUsd(monto, cotizacion).toFixed(2),
    };
  }
  return {
    montoArs: usdAArs(monto, cotizacion).toFixed(2),
    montoUsd: monto.toFixed(2),
  };
}

main()
  .then(() => {
    console.log('\n[backfill] Listo.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[backfill] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
