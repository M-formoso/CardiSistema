import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { BeneficiariosService } from './beneficiarios.service';
import {
  CreateBeneficiarioAliasDto,
  CreateBeneficiarioDto,
  FiltrosBeneficiarioDto,
  UpdateBeneficiarioDto,
  UpsertLegajoDto,
} from './dto/beneficiarios.dto';

@Controller('beneficiarios')
export class BeneficiariosController {
  constructor(private readonly beneficiarios: BeneficiariosService) {}

  @Get()
  @RequirePermission('beneficiarios', 'ver')
  findAll(@Query() filtros: FiltrosBeneficiarioDto, @CurrentUser() user: AuthenticatedUser) {
    return this.beneficiarios.findAll(filtros, user);
  }

  @Get(':id')
  @RequirePermission('beneficiarios', 'ver')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.beneficiarios.findOne(id, user);
  }

  @Post()
  @RequirePermission('beneficiarios', 'crear')
  create(@Body() dto: CreateBeneficiarioDto, @CurrentUser() user: AuthenticatedUser) {
    return this.beneficiarios.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('beneficiarios', 'editar')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBeneficiarioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.beneficiarios.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('beneficiarios', 'desactivar')
  desactivar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.beneficiarios.desactivar(id, user.id);
  }

  // --- Legajo ---

  @Put(':id/legajo')
  @RequirePermission('empleados', 'datos_sensibles')
  upsertLegajo(
    @Param('id') id: string,
    @Body() dto: UpsertLegajoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.beneficiarios.upsertLegajo(id, dto, user.id);
  }

  // --- Aliases ---

  @Post(':id/aliases')
  @RequirePermission('beneficiarios', 'editar')
  addAlias(@Param('id') id: string, @Body() dto: CreateBeneficiarioAliasDto) {
    return this.beneficiarios.addAlias(id, dto.alias);
  }

  @Delete('aliases/:aliasId')
  @RequirePermission('beneficiarios', 'editar')
  removeAlias(@Param('aliasId') id: string) {
    return this.beneficiarios.removeAlias(id);
  }
}
