import { Controller, Get, Post, Query } from '@nestjs/common';
import { CotizacionTipoBlue } from '@prisma/client';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CotizacionesService } from './cotizaciones.service';

@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly service: CotizacionesService) {}

  @Get('dolar')
  @RequirePermission('cotizaciones', 'ver')
  getDolar() {
    return this.service.getBlueHoy();
  }

  @Post('snapshot')
  @RequirePermission('cotizaciones', 'editar')
  snapshot() {
    return this.service.snapshotHoy();
  }

  @Get('ultima')
  @RequirePermission('cotizaciones', 'ver')
  ultima(@Query('tipo') tipo?: CotizacionTipoBlue) {
    return this.service.ultimaCotizacion(tipo ?? 'BLUE');
  }

  @Get('historicas')
  @RequirePermission('cotizaciones', 'ver')
  historicas(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listHistoricas(
      desde ? new Date(desde) : undefined,
      hasta ? new Date(hasta) : undefined,
      limit ? Number(limit) : 60,
    );
  }
}
