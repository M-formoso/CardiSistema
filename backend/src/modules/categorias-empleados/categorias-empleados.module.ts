import { Module } from '@nestjs/common';
import { CategoriasEmpleadosController } from './categorias-empleados.controller';
import { CategoriasEmpleadosService } from './categorias-empleados.service';

@Module({
  controllers: [CategoriasEmpleadosController],
  providers: [CategoriasEmpleadosService],
  exports: [CategoriasEmpleadosService],
})
export class CategoriasEmpleadosModule {}
