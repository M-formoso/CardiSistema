import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Moneda, Recibo, TipoConceptoLiquidacion } from '@prisma/client';
import { formatearMonto } from '@cardi/shared';
import { PrismaService } from '../../prisma/prisma.service';

/** Mismo mapa que el service de liquidaciones; duplicado para no acoplar. */
const SIGNO: Record<TipoConceptoLiquidacion, 1 | -1 | 0> = {
  JORNAL: 1, JORNAL_ESPECIAL: 1, HORAS_EXTRA: 1, VIATICO: 1, VACACIONES: 1,
  CERTIFICACION: 1, SUELDO: 1, PRESTAMO_ENTREGADO: 1,
  PRESTAMO_APLICACION: -1, DEDUCCION: -1, VALE: -1,
  NOTA_SALDO: 0,
};

const ETIQUETA: Record<TipoConceptoLiquidacion, string> = {
  JORNAL: 'Jornal',
  JORNAL_ESPECIAL: 'Jornal especial',
  HORAS_EXTRA: 'Horas extra',
  VIATICO: 'Viático',
  VACACIONES: 'Vacaciones',
  CERTIFICACION: 'Certificación',
  SUELDO: 'Sueldo',
  PRESTAMO_ENTREGADO: 'Préstamo entregado',
  PRESTAMO_APLICACION: 'Descuento préstamo',
  DEDUCCION: 'Deducción',
  VALE: 'Vale',
  NOTA_SALDO: 'Nota',
};

/**
 * Genera recibos en PDF con el branding Cardi.
 * - Guarda el PDF en UPLOADS_DIR/recibos/<id>.pdf (idempotente: si existe, reusa).
 * - Devuelve el path al archivo.
 * - El endpoint /recibos/:id/pdf lo stream-ea.
 */
@Injectable()
export class RecibosService {
  private readonly logger = new Logger(RecibosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  findAll(filtros: { beneficiarioId?: string; desde?: Date; hasta?: Date } = {}) {
    return this.prisma.recibo.findMany({
      where: {
        beneficiarioId: filtros.beneficiarioId,
        fecha: { gte: filtros.desde, lte: filtros.hasta },
      },
      orderBy: { fecha: 'desc' },
      include: { beneficiario: { select: { id: true, nombre: true, tipo: true } } },
      take: 500,
    });
  }

  async findOne(id: string) {
    const r = await this.prisma.recibo.findUnique({
      where: { id },
      include: { beneficiario: true, movimientos: true },
    });
    if (!r) throw new NotFoundException('Recibo no encontrado');
    return r;
  }

  async ensurePdf(id: string): Promise<{ absolutePath: string; relativePath: string }> {
    const recibo = await this.findOne(id);
    const uploadsDir = this.config.get<string>('UPLOADS_DIR') ?? './uploads';
    const dir = path.resolve(uploadsDir, 'recibos');
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${recibo.id}.pdf`;
    const absolutePath = path.join(dir, filename);

    if (fs.existsSync(absolutePath)) {
      return { absolutePath, relativePath: `recibos/${filename}` };
    }

    await this.renderPdf(recibo, absolutePath);

    // Guardo el path en el modelo para futura referencia (idempotente)
    await this.prisma.recibo.update({
      where: { id },
      data: { pdfPath: `recibos/${filename}` },
    });

    return { absolutePath, relativePath: `recibos/${filename}` };
  }

  /**
   * Genera un PDF compacto con un recibo por empleado de la liquidación.
   * Formato A4 vertical con ~3 recibos por hoja, siguiendo el formato del
   * Excel "Recibos de sueldo" del cliente (fecha + nombre arriba, grid de
   * conceptos, total y línea de firma).
   */
  async renderLiquidacionPdf(liquidacionId: string, outPath: string): Promise<void> {
    const liq = await this.prisma.liquidacionSemanal.findUnique({
      where: { id: liquidacionId },
      include: {
        obra: { select: { nombre: true } },
        items: {
          include: {
            beneficiario: { select: { nombre: true, cuitCuil: true } },
            conceptos: {
              include: { obra: { select: { nombre: true } } },
              orderBy: { orden: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!liq) throw new NotFoundException('Liquidación no encontrada');

    const items = liq.items.filter((i) => i.conceptos.length > 0);
    if (items.length === 0) throw new NotFoundException('No hay recibos para imprimir');

    return new Promise<void>((resolve, reject) => {
      try {
        const logoPath = this.resolverLogoPath();
        const doc = new PDFDocument({ size: 'A4', margin: 30 });
        const stream = fs.createWriteStream(outPath);
        doc.pipe(stream);

        // Cada recibo ~ 240pt de alto (A4 = 842pt; margen 30pt; = 3 por hoja)
        const ALTO_RECIBO = 245;
        const MARGEN_SUP = 30;
        const Y_INICIAL = MARGEN_SUP;

        const fechaSemana = `${this.formatDate(liq.semanaInicio)} al ${this.formatDate(liq.semanaFin)}`;

        items.forEach((item, idx) => {
          const slot = idx % 3;
          if (idx > 0 && slot === 0) doc.addPage();
          const y = Y_INICIAL + slot * ALTO_RECIBO;
          this.renderReciboCompacto(doc, {
            x: 30,
            y,
            ancho: 535,
            alto: ALTO_RECIBO - 5,
            item,
            obraLiquidacion: liq.obra.nombre,
            fechaSemana,
            logoPath,
          });
        });

        doc.end();
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  private renderReciboCompacto(
    doc: PDFKit.PDFDocument,
    opts: {
      x: number;
      y: number;
      ancho: number;
      alto: number;
      item: {
        nombreLibre: string;
        beneficiario?: { nombre: string; cuitCuil?: string | null } | null;
        aPagar: { toString(): string };
        conceptos: Array<{
          tipo: TipoConceptoLiquidacion;
          descripcion: string;
          cantidad: { toString(): string } | null;
          valorUnitario: { toString(): string } | null;
          monto: { toString(): string };
          obra?: { nombre: string } | null;
        }>;
      };
      obraLiquidacion: string;
      fechaSemana: string;
      logoPath: string | null;
    },
  ) {
    const { x, y, ancho, alto, item, obraLiquidacion, fechaSemana, logoPath } = opts;
    const PRIMARY = '#4390B6';
    const TEXT = '#111827';
    const MUTED = '#6b7280';

    // Borde exterior del recibo
    doc.roundedRect(x, y, ancho, alto, 4).strokeColor('#d1d5db').lineWidth(0.7).stroke();

    // Encabezado: logo + Cardi + info semana/obra + nombre a la derecha
    if (logoPath) {
      try {
        doc.image(logoPath, x + 8, y + 8, { width: 40 });
      } catch {
        // ignorar si el logo no se puede embeder
      }
    }
    doc.fontSize(14).fillColor(PRIMARY).text('Cardi', x + 55, y + 10);
    doc.fontSize(8).fillColor(MUTED).text(obraLiquidacion, x + 55, y + 28);
    doc.fontSize(8).text(fechaSemana, x + 55, y + 40);

    // Nombre del beneficiario (derecha arriba)
    doc.fontSize(13).fillColor(TEXT).text(item.nombreLibre, x + ancho / 2, y + 10, {
      width: ancho / 2 - 15,
      align: 'right',
    });
    if (item.beneficiario?.cuitCuil) {
      doc
        .fontSize(8)
        .fillColor(MUTED)
        .text(`CUIT/CUIL: ${item.beneficiario.cuitCuil}`, x + ancho / 2, y + 28, {
          width: ancho / 2 - 15,
          align: 'right',
        });
    }

    // Línea separadora
    doc
      .moveTo(x + 8, y + 56)
      .lineTo(x + ancho - 8, y + 56)
      .strokeColor('#e5e7eb')
      .lineWidth(0.5)
      .stroke();

    // Tabla de conceptos
    const tablaY = y + 62;
    const colDesc = x + 10;
    const colCant = x + ancho - 235;
    const colVal = x + ancho - 160;
    const colMonto = x + ancho - 85;

    doc.fontSize(7).fillColor(MUTED);
    doc.text('Concepto', colDesc, tablaY);
    doc.text('Cant.', colCant, tablaY, { width: 60, align: 'right' });
    doc.text('Valor', colVal, tablaY, { width: 60, align: 'right' });
    doc.text('Monto', colMonto, tablaY, { width: 75, align: 'right' });

    let rowY = tablaY + 12;
    const maxFilas = Math.min(item.conceptos.length, 8);
    for (let i = 0; i < maxFilas; i++) {
      const c = item.conceptos[i];
      const signo = SIGNO[c.tipo];
      const monto = Number(c.monto);
      doc.fontSize(8).fillColor(TEXT);
      const etiqueta = `${ETIQUETA[c.tipo]}`;
      doc.text(etiqueta, colDesc, rowY, { width: 60, continued: false });
      doc
        .fontSize(8)
        .fillColor(TEXT)
        .text(`${c.descripcion}${c.obra ? ` (${c.obra.nombre})` : ''}`, colDesc + 65, rowY, {
          width: colCant - colDesc - 70,
        });
      if (c.cantidad) {
        doc.fontSize(8).fillColor(MUTED).text(Number(c.cantidad).toString(), colCant, rowY, {
          width: 60,
          align: 'right',
        });
      }
      if (c.valorUnitario) {
        doc.text(formatearMonto(c.valorUnitario.toString(), Moneda.ARS), colVal, rowY, {
          width: 60,
          align: 'right',
        });
      }
      doc
        .fontSize(8)
        .fillColor(signo === -1 ? '#b45309' : signo === 0 ? MUTED : TEXT)
        .text(
          signo === 0 ? '—' : formatearMonto(Math.abs(monto).toString(), Moneda.ARS),
          colMonto,
          rowY,
          { width: 75, align: 'right' },
        );
      rowY += 12;
    }
    if (item.conceptos.length > maxFilas) {
      doc
        .fontSize(7)
        .fillColor(MUTED)
        .text(`+ ${item.conceptos.length - maxFilas} conceptos más…`, colDesc, rowY);
    }

    // Total y firmas al pie del recibo
    const pieY = y + alto - 30;
    doc
      .moveTo(x + 8, pieY - 6)
      .lineTo(x + ancho - 8, pieY - 6)
      .strokeColor('#e5e7eb')
      .lineWidth(0.5)
      .stroke();

    // Firma
    doc.fontSize(8).fillColor(MUTED).text('Firma:', x + 10, pieY);
    doc
      .moveTo(x + 40, pieY + 10)
      .lineTo(x + 200, pieY + 10)
      .strokeColor('#999')
      .lineWidth(0.3)
      .stroke();

    // Total
    doc.fontSize(9).fillColor(MUTED).text('Total:', colVal, pieY, { width: 60, align: 'right' });
    doc
      .fontSize(13)
      .fillColor(PRIMARY)
      .text(formatearMonto(item.aPagar.toString(), Moneda.ARS), colMonto, pieY - 2, {
        width: 75,
        align: 'right',
      });
  }

  async ensureLiquidacionPdf(
    liquidacionId: string,
  ): Promise<{ absolutePath: string; relativePath: string }> {
    const uploadsDir = this.config.get<string>('UPLOADS_DIR') ?? './uploads';
    const dir = path.resolve(uploadsDir, 'recibos');
    fs.mkdirSync(dir, { recursive: true });
    const filename = `liquidacion-${liquidacionId}.pdf`;
    const absolutePath = path.join(dir, filename);

    // Para liquidaciones regeneramos siempre (el contenido puede cambiar antes de pagar).
    await this.renderLiquidacionPdf(liquidacionId, absolutePath);
    return { absolutePath, relativePath: `recibos/${filename}` };
  }

  private formatDate(d: Date): string {
    return new Date(d).toLocaleDateString('es-AR');
  }

  private renderPdf(
    recibo: Recibo & { beneficiario?: { nombre: string; cuitCuil?: string | null } | null },
    outPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const empresa = this.cargarConfigEmpresaSync();
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(outPath);
        doc.pipe(stream);

        // --- Encabezado ---
        const logoPath = this.resolverLogoPath();
        if (logoPath && fs.existsSync(logoPath)) {
          doc.image(logoPath, 50, 45, { width: 80 });
        }

        doc.fontSize(20).fillColor('#4390B6').text('Cardi', 150, 55);
        if (empresa?.razonSocial && empresa.razonSocial !== 'Cardi') {
          doc.fontSize(10).fillColor('#666').text(empresa.razonSocial, 150, 80);
        }
        if (empresa?.cuit) {
          doc.fontSize(9).text(`CUIT: ${empresa.cuit}`, 150, 95);
        }

        // Número + fecha arriba derecha
        doc.fontSize(14).fillColor('#111827').text('RECIBO', 400, 55, { align: 'right' });
        doc
          .fontSize(10)
          .fillColor('#4390B6')
          .text(`Nº ${String(recibo.numero).padStart(8, '0')}`, 400, 75, { align: 'right' });
        doc
          .fontSize(10)
          .fillColor('#666')
          .text(
            `Fecha: ${new Date(recibo.fecha).toLocaleDateString('es-AR')}`,
            400,
            92,
            { align: 'right' },
          );

        // --- Línea separadora ---
        doc.moveTo(50, 130).lineTo(545, 130).strokeColor('#4390B6').lineWidth(1).stroke();

        // --- Beneficiario ---
        doc.fillColor('#111827').fontSize(10).text('Beneficiario', 50, 150);
        doc.fontSize(13).fillColor('#111827').text(recibo.beneficiario?.nombre ?? '—', 50, 165);
        if (recibo.beneficiario?.cuitCuil) {
          doc.fontSize(9).fillColor('#666').text(`CUIT/CUIL: ${recibo.beneficiario.cuitCuil}`, 50, 185);
        }

        // --- Monto grande ---
        const monto = formatearMonto(recibo.monto.toString(), recibo.moneda as Moneda);
        doc.rect(50, 220, 495, 60).fillColor('#F5F9FC').fill();
        doc.fillColor('#666').fontSize(10).text('Monto recibido', 65, 230);
        doc.fillColor('#4390B6').fontSize(28).text(monto, 65, 245);

        // --- Concepto ---
        doc.fillColor('#111827').fontSize(10).text('Concepto', 50, 310);
        doc.fontSize(11).fillColor('#333').text(recibo.concepto, 50, 325, {
          width: 495,
          align: 'left',
        });

        // --- Firmas ---
        doc.moveTo(80, 650).lineTo(260, 650).strokeColor('#999').lineWidth(0.5).stroke();
        doc.fontSize(9).fillColor('#666').text('Firma del beneficiario', 80, 655, {
          width: 180,
          align: 'center',
        });

        doc.moveTo(335, 650).lineTo(515, 650).stroke();
        doc.fontSize(9).text('Firma y aclaración por Cardi', 335, 655, {
          width: 180,
          align: 'center',
        });

        // --- Pie ---
        doc.fontSize(8).fillColor('#aaa').text(
          `Generado por el Sistema Cardi · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
          50,
          780,
          { align: 'center', width: 495 },
        );

        doc.end();
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  private resolverLogoPath(): string | null {
    // El logo vive en assets/brand/ (fuera del dist). En Railway la raíz del
    // repo es process.cwd(). En local, también. Si no está, retorna null.
    const candidatos = [
      path.resolve(process.cwd(), 'assets/brand/logo.png'),
      path.resolve(process.cwd(), '../assets/brand/logo.png'),
      path.resolve(__dirname, '../../../../../assets/brand/logo.png'),
    ];
    for (const p of candidatos) {
      if (fs.existsSync(p)) return p;
    }
    this.logger.warn('Logo de Cardi no encontrado — el recibo sale sin logo');
    return null;
  }

  private cargarConfigEmpresaSync(): { razonSocial: string; cuit: string } | null {
    // No hacemos query sync — devolvemos null y confiamos en que configuración
    // viene cargada vía ConfigService si hace falta algo específico.
    // Para v1 el recibo muestra "Cardi" fijo (regla de marca).
    return null;
  }
}
