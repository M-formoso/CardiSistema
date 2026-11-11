import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ReportesService } from './reportes.service';

function parseDate(s?: string): Date | undefined {
  return s ? new Date(s) : undefined;
}

@Controller('reportes')
export class ReportesController {
  constructor(private readonly svc: ReportesService) {}

  @Get('gasto-por-obra')
  @RequirePermission('reportes', 'ver')
  gastoPorObra(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.svc.gastoPorObra({ desde: parseDate(desde), hasta: parseDate(hasta) });
  }

  @Get('gasto-por-categoria')
  @RequirePermission('reportes', 'ver')
  gastoPorCategoria(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.svc.gastoPorCategoria({ desde: parseDate(desde), hasta: parseDate(hasta) });
  }

  @Get('obras/:id/detalle')
  @RequirePermission('reportes', 'ver')
  detalleObra(
    @Param('id') id: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.svc.detalleObra(id, { desde: parseDate(desde), hasta: parseDate(hasta) });
  }

  @Get('obras/:id/por-categoria')
  @RequirePermission('reportes', 'ver')
  gastoObraPorCategoria(
    @Param('id') id: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.svc.gastoObraPorCategoria(id, {
      desde: parseDate(desde),
      hasta: parseDate(hasta),
    });
  }

  @Get('obras/:id/por-mes')
  @RequirePermission('reportes', 'ver')
  gastoObraPorMes(
    @Param('id') id: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.svc.gastoObraPorMes(id, {
      desde: parseDate(desde),
      hasta: parseDate(hasta),
    });
  }

  @Get('gasto-por-obra.xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @RequirePermission('reportes', 'ver')
  async gastoPorObraExcel(
    @Query('desde') desde: string | undefined,
    @Query('hasta') hasta: string | undefined,
    @Res() res: Response,
  ) {
    const buf = await this.svc.gastoPorObraExcel({
      desde: parseDate(desde),
      hasta: parseDate(hasta),
    });
    res.setHeader('Content-Disposition', 'attachment; filename="gasto-por-obra.xlsx"');
    res.send(Buffer.from(buf as ArrayBuffer));
  }

  @Get('movimientos.xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @RequirePermission('reportes', 'ver')
  async movimientosExcel(
    @Query('cajaId') cajaId: string | undefined,
    @Query('obraId') obraId: string | undefined,
    @Query('beneficiarioId') beneficiarioId: string | undefined,
    @Query('desde') desde: string | undefined,
    @Query('hasta') hasta: string | undefined,
    @Res() res: Response,
  ) {
    const buf = await this.svc.movimientosExcel({
      cajaId,
      obraId,
      beneficiarioId,
      desde: parseDate(desde),
      hasta: parseDate(hasta),
    });
    res.setHeader('Content-Disposition', 'attachment; filename="movimientos.xlsx"');
    res.send(Buffer.from(buf as ArrayBuffer));
  }
}
