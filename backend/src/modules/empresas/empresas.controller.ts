import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { EmpresasService } from './empresas.service';
import {
  CreateEmpresaDto,
  FiltrosEmpresaDto,
  UpdateEmpresaDto,
} from './dto/empresas.dto';

@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresas: EmpresasService) {}

  @Get()
  @RequirePermission('empresas', 'ver')
  findAll(@Query() filtros: FiltrosEmpresaDto) {
    return this.empresas.findAll(filtros);
  }

  @Get(':id')
  @RequirePermission('empresas', 'ver')
  findOne(@Param('id') id: string) {
    return this.empresas.findOne(id);
  }

  @Post()
  @RequirePermission('empresas', 'crear')
  create(@Body() dto: CreateEmpresaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.empresas.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('empresas', 'editar')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmpresaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.empresas.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('empresas', 'desactivar')
  desactivar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.empresas.desactivar(id, user.id);
  }
}
