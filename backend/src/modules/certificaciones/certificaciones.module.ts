import { Module } from '@nestjs/common';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';
import { CertificacionesController } from './certificaciones.controller';
import { CertificacionesService } from './certificaciones.service';

@Module({
  imports: [CotizacionesModule],
  controllers: [CertificacionesController],
  providers: [CertificacionesService],
  exports: [CertificacionesService],
})
export class CertificacionesModule {}
