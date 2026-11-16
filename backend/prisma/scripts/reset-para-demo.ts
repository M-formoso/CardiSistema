/**
 * Reset del sistema para presentarle al cliente (Dani).
 *
 * BORRA todos los datos transaccionales y los proveedores/contratistas/
 * profesionales cargados durante las pruebas. Deja las 3 cajas finales
 * (Caja Efectivo, Caja Cheques, Caja Transferencia), todas en ARS con
 * saldo inicial 0 al 2026-01-01.
 *
 * MANTIENE:
 *   - Usuarios (Mateo y Marcelo) + permisos + refresh tokens
 *   - Configuración de empresa
 *   - Cotizaciones del dólar (son datos de mercado)
 *   - Obras (ya configuradas por el cliente)
 *   - Empleados completos: Beneficiarios tipo EMPLEADO + EmpleadoLegajo
 *     + CategoriaEmpleado + Empresa + EmpleadoJornalHistorico
 *   - CategoriaGasto (incluidas PAGO_PROV, PREST_EMP y las del seed)
 *
 * BORRA:
 *   - Movimientos + imputaciones + ajustes de saldo (son movimientos)
 *   - Cheques
 *   - Liquidaciones semanales + items + conceptos + pagos
 *   - Certificaciones (de contratistas, con % avance)
 *   - Préstamos a empleados + sus aplicaciones
 *   - Vacaciones pagas
 *   - Recibos (+ sus PDFs en disco)
 *   - Resúmenes de proveedores + items
 *   - Contratos cuotas (profesionales) + sus cuotas
 *   - Vencimientos recurrentes + compromisos de pago
 *   - Migración (lotes y filas)
 *   - Beneficiarios tipo PROVEEDOR / CONTRATISTA / PROFESIONAL / OTRO
 *     (los empleados quedan)
 *   - Alias de los beneficiarios borrados
 *   - Todas las cajas existentes (se reemplazan por las 3 finales)
 *
 * Uso:
 *   pnpm --filter @cardi/backend exec ts-node \
 *     prisma/scripts/reset-para-demo.ts
 *
 * Idempotente: se puede correr varias veces sin romper. Sobre datos ya
 * limpios, todos los deleteMany devuelven count=0 y las cajas quedan tal cual.
 */
import {
  Moneda,
  PrismaClient,
  TipoBeneficiario,
  TipoCaja,
} from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

const prisma = new PrismaClient();

async function main() {
  console.log('[reset] Iniciando limpieza para demo...\n');

  await prisma.$transaction(
    async (tx) => {
      // ========== FASE 1: hojas (dependen de todo lo demás) ==========
      const paso = async (label: string, count: number) =>
        console.log(`  - ${label.padEnd(32)} ${count}`);

      paso(
        'PrestamoAplicacion',
        (await tx.prestamoAplicacion.deleteMany({})).count,
      );
      paso(
        'LiquidacionItemConcepto',
        (await tx.liquidacionItemConcepto.deleteMany({})).count,
      );
      paso(
        'LiquidacionPago',
        (await tx.liquidacionPago.deleteMany({})).count,
      );
      paso('Imputacion', (await tx.imputacion.deleteMany({})).count);
      paso('Vacacion', (await tx.vacacion.deleteMany({})).count);
      paso('Cuota (contratos)', (await tx.cuota.deleteMany({})).count);
      paso('CompromisoPago', (await tx.compromisoPago.deleteMany({})).count);
      paso('MigracionFila', (await tx.migracionFila.deleteMany({})).count);
      paso(
        'ProveedorResumenItem',
        (await tx.proveedorResumenItem.deleteMany({})).count,
      );

      // Solo alias de beneficiarios NO empleados (los empleados se mantienen)
      paso(
        'BeneficiarioAlias (no empl.)',
        (
          await tx.beneficiarioAlias.deleteMany({
            where: {
              beneficiario: { tipo: { not: TipoBeneficiario.EMPLEADO } },
            },
          })
        ).count,
      );

      // ========== FASE 2: entidades intermedias ==========
      paso('LiquidacionItem', (await tx.liquidacionItem.deleteMany({})).count);
      paso('Recibo', (await tx.recibo.deleteMany({})).count);
      paso(
        'PrestamoEmpleado',
        (await tx.prestamoEmpleado.deleteMany({})).count,
      );
      paso(
        'ProveedorResumen',
        (await tx.proveedorResumen.deleteMany({})).count,
      );
      paso('Movimiento', (await tx.movimiento.deleteMany({})).count);
      paso('Cheque', (await tx.cheque.deleteMany({})).count);
      paso('Certificacion', (await tx.certificacion.deleteMany({})).count);
      paso(
        'VencimientoRecurrente',
        (await tx.vencimientoRecurrente.deleteMany({})).count,
      );
      paso('ContratoCuota', (await tx.contratoCuota.deleteMany({})).count);

      // ========== FASE 3: padres de arriba ==========
      paso(
        'LiquidacionSemanal',
        (await tx.liquidacionSemanal.deleteMany({})).count,
      );
      paso('MigracionLote', (await tx.migracionLote.deleteMany({})).count);

      // ========== FASE 4: beneficiarios no empleados ==========
      paso(
        'Beneficiario (no empl.)',
        (
          await tx.beneficiario.deleteMany({
            where: { tipo: { not: TipoBeneficiario.EMPLEADO } },
          })
        ).count,
      );

      // ========== FASE 5: cajas → recrear 3 finales ==========
      paso('Caja (existentes)', (await tx.caja.deleteMany({})).count);
      const fechaInicial = new Date('2026-01-01');
      const cajas = [
        {
          nombre: 'Caja Efectivo',
          tipo: TipoCaja.EFECTIVO,
          moneda: Moneda.ARS,
        },
        {
          nombre: 'Caja Cheques',
          tipo: TipoCaja.CHEQUES_TERCEROS,
          moneda: Moneda.ARS,
        },
        {
          nombre: 'Caja Transferencia',
          tipo: TipoCaja.BANCO,
          moneda: Moneda.ARS,
        },
      ];
      for (const c of cajas) {
        await tx.caja.create({
          data: {
            ...c,
            saldoInicial: 0,
            fechaSaldoInicial: fechaInicial,
            activo: true,
          },
        });
      }
      console.log(`  + 3 cajas creadas: ${cajas.map((c) => c.nombre).join(', ')}`);
    },
    { timeout: 60_000 },
  );

  // ========== FASE 6: PDFs de recibos en disco ==========
  const uploadsDir = process.env.UPLOADS_DIR ?? './uploads';
  const recibosDir = path.resolve(uploadsDir, 'recibos');
  if (fs.existsSync(recibosDir)) {
    const files = fs.readdirSync(recibosDir);
    let borrados = 0;
    for (const f of files) {
      if (f.endsWith('.pdf')) {
        fs.unlinkSync(path.join(recibosDir, f));
        borrados++;
      }
    }
    console.log(`\n  - PDFs de recibos borrados: ${borrados}`);
  } else {
    console.log(`\n  - Directorio de recibos vacío/inexistente: nada que borrar`);
  }

  console.log('\n[reset] Listo. Sistema limpio.');
  console.log('[reset] Mantenidos: usuarios, obras, empleados, categorías, cotizaciones, config.');
  console.log('[reset] Borrados:   movimientos, cheques, liquidaciones, préstamos, proveedores, etc.');
  console.log('[reset] Cajas:      Efectivo, Cheques, Transferencia (todas ARS, saldo 0).');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n[reset] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
