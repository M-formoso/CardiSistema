import { Module } from '@nestjs/common';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';
import { ContratosCuotasController } from './contratos-cuotas.controller';
import { ContratosCuotasService } from './contratos-cuotas.service';

@Module({
  imports: [CotizacionesModule],
  controllers: [ContratosCuotasController],
  providers: [ContratosCuotasService],
  exports: [ContratosCuotasService],
})
export class ContratosCuotasModule {}
