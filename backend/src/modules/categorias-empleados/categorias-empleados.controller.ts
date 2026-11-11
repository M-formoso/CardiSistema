import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CategoriasEmpleadosService } from './categorias-empleados.service';
import {
  ActualizarJornalCategoriaDto,
  CreateCategoriaEmpleadoDto,
  FiltrosCategoriaEmpleadoDto,
  UpdateCategoriaEmpleadoDto,
} from './dto/categorias-empleados.dto';

@Controller('categorias-empleados')
export class CategoriasEmpleadosController {
  constructor(private readonly categorias: CategoriasEmpleadosService) {}

  @Get()
  @RequirePermission('categorias_empleados', 'ver')
  findAll(@Query() filtros: FiltrosCategoriaEmpleadoDto) {
    return this.categorias.findAll(filtros);
  }

  @Get(':id')
  @RequirePermission('categorias_empleados', 'ver')
  findOne(@Param('id') id: string) {
    return this.categorias.findOne(id);
  }

  @Post()
  @RequirePermission('categorias_empleados', 'crear')
  create(@Body() dto: CreateCategoriaEmpleadoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.categorias.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('categorias_empleados', 'editar')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoriaEmpleadoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categorias.update(id, dto, user.id);
  }

  @Put(':id/jornal')
  @RequirePermission('empleados', 'datos_sensibles')
  actualizarJornal(
    @Param('id') id: string,
    @Body() dto: ActualizarJornalCategoriaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categorias.actualizarJornal(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('categorias_empleados', 'desactivar')
  desactivar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.categorias.desactivar(id, user.id);
  }
}
