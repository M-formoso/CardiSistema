import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ProveedoresService } from './proveedores.service';
import {
  CrearResumenDto,
  FiltrosProveedoresDto,
} from './dto/proveedores.dto';

@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly proveedores: ProveedoresService) {}

  @Get()
  @RequirePermission('proveedores', 'ver')
  findAll(@Query() filtros: FiltrosProveedoresDto) {
    return this.proveedores.findAll(filtros);
  }

  @Get(':id')
  @RequirePermission('proveedores', 'ver')
  findOne(@Param('id') id: string) {
    return this.proveedores.findOne(id);
  }

  @Post(':id/resumenes')
  @RequirePermission('proveedores', 'editar')
  crearResumen(
    @Param('id') id: string,
    @Body() dto: CrearResumenDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.proveedores.crearResumen(id, dto, user.id);
  }

  @Delete(':id/resumenes/:resumenId')
  @RequirePermission('proveedores', 'editar')
  eliminarResumen(
    @Param('id') id: string,
    @Param('resumenId') resumenId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.proveedores.eliminarResumen(id, resumenId, user.id);
  }
}
