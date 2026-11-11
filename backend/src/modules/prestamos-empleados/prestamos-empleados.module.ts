import { Module } from '@nestjs/common';
import { PrestamosEmpleadosController } from './prestamos-empleados.controller';
import { PrestamosEmpleadosService } from './prestamos-empleados.service';

@Module({
  controllers: [PrestamosEmpleadosController],
  providers: [PrestamosEmpleadosService],
  exports: [PrestamosEmpleadosService],
})
export class PrestamosEmpleadosModule {}
