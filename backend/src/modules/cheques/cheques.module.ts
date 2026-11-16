import { Module } from '@nestjs/common';
import { ChequesController } from './cheques.controller';
import { ChequesService } from './cheques.service';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';

@Module({
  imports: [CotizacionesModule],
  controllers: [ChequesController],
  providers: [ChequesService],
  exports: [ChequesService],
})
export class ChequesModule {}
