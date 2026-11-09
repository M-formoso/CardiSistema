import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CajasService } from './cajas.service';
import { CreateCajaDto, UpdateCajaDto } from './dto/cajas.dto';

@Controller('cajas')
export class CajasController {
  constructor(private readonly cajas: CajasService) {}

  @Get()
  @RequirePermission('cajas', 'ver')
  findAll(@Query('soloActivas') soloActivas?: string) {
    return this.cajas.findAll(soloActivas === 'true');
  }

  @Get('saldos')
  @RequirePermission('cajas', 'ver')
  saldos() {
    return this.cajas.saldosDeTodas();
  }

  @Get(':id')
  @RequirePermission('cajas', 'ver')
  findOne(@Param('id') id: string) {
    return this.cajas.findOneConSaldo(id);
  }

  @Post()
  @RequirePermission('cajas', 'crear')
  create(@Body() dto: CreateCajaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cajas.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('cajas', 'editar')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCajaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cajas.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('cajas', 'desactivar')
  desactivar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cajas.desactivar(id, user.id);
  }
}
