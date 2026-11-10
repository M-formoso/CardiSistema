import { Module } from '@nestjs/common';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';
import { LiquidacionesController } from './liquidaciones.controller';
import { LiquidacionesService } from './liquidaciones.service';

@Module({
  imports: [CotizacionesModule],
  controllers: [LiquidacionesController],
  providers: [LiquidacionesService],
  exports: [LiquidacionesService],
})
export class LiquidacionesModule {}
