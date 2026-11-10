import { Module } from '@nestjs/common';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';
import { CompromisosController } from './compromisos.controller';
import { CompromisosService } from './compromisos.service';

@Module({
  imports: [CotizacionesModule],
  controllers: [CompromisosController],
  providers: [CompromisosService],
  exports: [CompromisosService],
})
export class CompromisosModule {}
