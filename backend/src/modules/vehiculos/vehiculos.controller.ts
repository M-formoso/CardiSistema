import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { VehiculosService } from './vehiculos.service';
import {
  ActualizarVehiculoDto,
  CrearVehiculoDto,
  FiltrosVehiculoDto,
} from './dto/vehiculos.dto';

@Controller('vehiculos')
export class VehiculosController {
  constructor(private readonly vehiculos: VehiculosService) {}

  @Get()
  @RequirePermission('vehiculos', 'ver')
  findAll(@Query() filtros: FiltrosVehiculoDto) {
    return this.vehiculos.findAll(filtros);
  }

  @Get(':id')
  @RequirePermission('vehiculos', 'ver')
  findOne(@Param('id') id: string) {
    return this.vehiculos.findOne(id);
  }

  @Post()
  @RequirePermission('vehiculos', 'editar')
  create(@Body() dto: CrearVehiculoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.vehiculos.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('vehiculos', 'editar')
  update(
    @Param('id') id: string,
    @Body() dto: ActualizarVehiculoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vehiculos.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('vehiculos', 'editar')
  desactivar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vehiculos.desactivar(id, user.id);
  }
}
