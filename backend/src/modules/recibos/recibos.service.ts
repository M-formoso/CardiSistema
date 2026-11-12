import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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

    // Regla de negocio: el recibo solo se puede descargar cuando el pago
    // está hecho (parcial o total). Antes de eso, es una liquidación en
    // borrador o aprobada sin plata entregada todavía.
    const estadosPermitidos = ['PAGADA_PARCIAL', 'PAGADA', 'CERRADA'];
    if (!estadosPermitidos.includes(liq.estado)) {
      throw new BadRequestException(
        'El recibo se puede imprimir solo después de registrar el pago (total o parcial).',
      );
    }

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

  /**
   * Formato visual pensado para replicar el Excel "Recibos de sueldo" de Cardi:
   * encabezado con fecha + nombre, "Recibí de", tabla Concepto | Cant | Valor |
   * Monto, descuentos en naranja con signo negativo, total prominente abajo a la
   * derecha y línea de firma a la izquierda. 3 recibos por hoja A4.
   */
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
    const DESCUENTO = '#b45309';

    // Borde exterior
    doc.roundedRect(x, y, ancho, alto, 6).strokeColor('#cbd5e1').lineWidth(0.8).stroke();

    // ========== Encabezado ==========
    const padX = 14;
    const headerY = y + 10;

    // Logo + "Cardi" + obra + semana (izquierda)
    if (logoPath) {
      try {
        doc.image(logoPath, x + padX, headerY, { width: 38 });
      } catch {
        // ignorar si no puede embeder
      }
    }
    doc
      .fontSize(13)
      .fillColor(PRIMARY)
      .text('Cardi', x + padX + 46, headerY + 2);
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .text(`Obra: ${obraLiquidacion}`, x + padX + 46, headerY + 20);
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .text(`Semana: ${fechaSemana}`, x + padX + 46, headerY + 32);

    // Nombre del beneficiario (derecha grande)
    doc
      .fontSize(14)
      .fillColor(TEXT)
      .text(item.nombreLibre, x + ancho / 2, headerY, {
        width: ancho / 2 - padX,
        align: 'right',
      });
    const subY = headerY + 20;
    if (item.beneficiario?.cuitCuil) {
      doc
        .fontSize(8)
        .fillColor(MUTED)
        .text(`CUIT/CUIL: ${item.beneficiario.cuitCuil}`, x + ancho / 2, subY, {
          width: ancho / 2 - padX,
          align: 'right',
        });
    }
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .text('Recibí de: Cardi', x + ancho / 2, subY + 12, {
        width: ancho / 2 - padX,
        align: 'right',
      });

    // Separador bajo header
    const sepY = headerY + 52;
    doc
      .moveTo(x + padX, sepY)
      .lineTo(x + ancho - padX, sepY)
      .strokeColor('#e5e7eb')
      .lineWidth(0.6)
      .stroke();

    // ========== Tabla de conceptos ==========
    const colDesc = x + padX;
    const colCant = x + ancho - 220;
    const colVal = x + ancho - 150;
    const colMonto = x + ancho - 80;
    const colMontoW = 70;

    const headerTablaY = sepY + 6;
    doc.fontSize(9).fillColor(TEXT).text('Descripción', colDesc, headerTablaY);
    doc.fontSize(7).fillColor(MUTED);
    doc.text('CANT.', colCant, headerTablaY + 2, { width: 55, align: 'right' });
    doc.text('VALOR UNIT.', colVal, headerTablaY + 2, { width: 60, align: 'right' });
    doc.text('MONTO', colMonto, headerTablaY + 2, { width: colMontoW, align: 'right' });

    // Línea tenue bajo el header de tabla
    const tablaStartY = headerTablaY + 14;
    doc
      .moveTo(x + padX, tablaStartY - 2)
      .lineTo(x + ancho - padX, tablaStartY - 2)
      .strokeColor('#e5e7eb')
      .lineWidth(0.4)
      .stroke();

    const rowHeight = 12;
    const pieY = y + alto - 34;
    const maxFilas = Math.floor((pieY - tablaStartY) / rowHeight) - 1;
    const filasAMostrar = Math.min(item.conceptos.length, maxFilas);

    let rowY = tablaStartY;
    for (let i = 0; i < filasAMostrar; i++) {
      const c = item.conceptos[i];
      const signo = SIGNO[c.tipo];
      const monto = Number(c.monto);

      // Columna descripción: "Semana" o "Préstamo" o el que sea, en bold,
      // seguido del texto descriptivo. Si imputa a otra obra, lo anoto al final.
      doc.font('Helvetica-Bold').fontSize(8).fillColor(TEXT);
      doc.text(ETIQUETA[c.tipo], colDesc, rowY, { continued: true });
      doc.font('Helvetica').fontSize(8).fillColor(MUTED);
      const sufijoObra = c.obra ? ` · ${c.obra.nombre}` : '';
      doc.text(
        c.descripcion ? `  —  ${c.descripcion}${sufijoObra}` : sufijoObra,
        {
          width: colCant - colDesc - 10,
          lineBreak: false,
        },
      );

      // Cantidad, valor unitario
      if (c.cantidad) {
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(MUTED)
          .text(Number(c.cantidad).toString(), colCant, rowY, {
            width: 55,
            align: 'right',
          });
      }
      if (c.valorUnitario) {
        doc
          .fontSize(8)
          .fillColor(MUTED)
          .text(formatearMonto(c.valorUnitario.toString(), Moneda.ARS), colVal, rowY, {
            width: 60,
            align: 'right',
          });
      }
      // Monto (signo negativo visible en naranja para descuentos)
      const colorMonto = signo === -1 ? DESCUENTO : signo === 0 ? MUTED : TEXT;
      const prefix = signo === -1 ? '-' : '';
      doc
        .font(signo === 0 ? 'Helvetica-Oblique' : 'Helvetica')
        .fontSize(8.5)
        .fillColor(colorMonto)
        .text(
          signo === 0
            ? '—'
            : `${prefix}${formatearMonto(Math.abs(monto).toString(), Moneda.ARS)}`,
          colMonto,
          rowY,
          { width: colMontoW, align: 'right' },
        );
      rowY += rowHeight;
    }
    if (item.conceptos.length > filasAMostrar) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(7)
        .fillColor(MUTED)
        .text(
          `+ ${item.conceptos.length - filasAMostrar} concepto(s) más — ver detalle en el sistema`,
          colDesc,
          rowY,
        );
    }

    // ========== Pie: firma + total ==========
    // Separador grueso antes del total
    doc
      .moveTo(x + padX, pieY - 4)
      .lineTo(x + ancho - padX, pieY - 4)
      .strokeColor('#cbd5e1')
      .lineWidth(0.6)
      .stroke();

    // Firma (izquierda)
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Firma:', x + padX, pieY + 10);
    doc
      .moveTo(x + padX + 32, pieY + 20)
      .lineTo(x + padX + 230, pieY + 20)
      .strokeColor('#94a3b8')
      .lineWidth(0.4)
      .stroke();

    // Total (derecha, prominente)
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(MUTED)
      .text('TOTAL A PAGAR', colVal, pieY + 2, { width: 60, align: 'right' });
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor(PRIMARY)
      .text(formatearMonto(item.aPagar.toString(), Moneda.ARS), colMonto - 10, pieY + 14, {
        width: colMontoW + 10,
        align: 'right',
      });

    // Reset font para próximos elementos
    doc.font('Helvetica');
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
