import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrestamosEmpleadosService } from './prestamos-empleados.service';
import {
  AnularPrestamoDto,
  CreatePrestamoDto,
  FiltrosPrestamoDto,
  UpdatePrestamoDto,
} from './dto/prestamos-empleados.dto';

@Controller('prestamos-empleados')
export class PrestamosEmpleadosController {
  constructor(private readonly prestamos: PrestamosEmpleadosService) {}

  @Get()
  @RequirePermission('prestamos_empleados', 'ver')
  findAll(@Query() filtros: FiltrosPrestamoDto) {
    return this.prestamos.findAll(filtros);
  }

  @Get('vigentes/:beneficiarioId')
  @RequirePermission('prestamos_empleados', 'ver')
  vigentesDe(@Param('beneficiarioId') beneficiarioId: string) {
    return this.prestamos.vigentesDe(beneficiarioId);
  }

  @Get(':id')
  @RequirePermission('prestamos_empleados', 'ver')
  findOne(@Param('id') id: string) {
    return this.prestamos.findOne(id);
  }

  @Post()
  @RequirePermission('prestamos_empleados', 'crear')
  create(@Body() dto: CreatePrestamoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.prestamos.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('prestamos_empleados', 'editar')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePrestamoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.prestamos.update(id, dto, user.id);
  }

  @Patch(':id/anular')
  @RequirePermission('prestamos_empleados', 'anular')
  anular(
    @Param('id') id: string,
    @Body() dto: AnularPrestamoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.prestamos.anular(id, dto, user.id);
  }
}
