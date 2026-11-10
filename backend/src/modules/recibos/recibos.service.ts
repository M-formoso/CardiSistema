import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Moneda, Recibo } from '@prisma/client';
import { formatearMonto } from '@cardi/shared';
import { PrismaService } from '../../prisma/prisma.service';

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
