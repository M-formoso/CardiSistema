import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'node:fs';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RecibosService } from './recibos.service';

@Controller('recibos')
export class RecibosController {
  constructor(private readonly recibos: RecibosService) {}

  @Get()
  @RequirePermission('recibos', 'ver')
  findAll(
    @Query('beneficiarioId') beneficiarioId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.recibos.findAll({
      beneficiarioId,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    });
  }

  @Get(':id')
  @RequirePermission('recibos', 'ver')
  findOne(@Param('id') id: string) {
    return this.recibos.findOne(id);
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @RequirePermission('recibos', 'ver')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const { absolutePath } = await this.recibos.ensurePdf(id);
    if (!fs.existsSync(absolutePath)) throw new NotFoundException('No se pudo generar el PDF');
    res.setHeader('Content-Disposition', `inline; filename="recibo-${id}.pdf"`);
    const stream = fs.createReadStream(absolutePath);
    stream.pipe(res);
  }

  /**
   * PDF compacto con un recibo por empleado de la liquidación (varios por hoja A4).
   */
  @Get('liquidacion/:id/pdf')
  @Header('Content-Type', 'application/pdf')
  @RequirePermission('recibos', 'ver')
  async pdfLiquidacion(@Param('id') id: string, @Res() res: Response) {
    const { absolutePath } = await this.recibos.ensureLiquidacionPdf(id);
    if (!fs.existsSync(absolutePath)) throw new NotFoundException('No se pudo generar el PDF');
    res.setHeader('Content-Disposition', `inline; filename="recibos-liquidacion-${id}.pdf"`);
    const stream = fs.createReadStream(absolutePath);
    stream.pipe(res);
  }
}
