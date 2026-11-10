import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { LiquidacionesService } from './liquidaciones.service';
import {
  CambiarEstadoLiquidacionDto,
  CreateLiquidacionDto,
  FiltrosLiquidacionDto,
  PagarLiquidacionDto,
  UpsertItemDto,
} from './dto/liquidaciones.dto';

@Controller('liquidaciones')
export class LiquidacionesController {
  constructor(private readonly liq: LiquidacionesService) {}

  @Get()
  @RequirePermission('liquidaciones', 'ver')
  findAll(@Query() filtros: FiltrosLiquidacionDto) {
    return this.liq.findAll(filtros);
  }

  @Get(':id')
  @RequirePermission('liquidaciones', 'ver')
  findOne(@Param('id') id: string) {
    return this.liq.findOne(id);
  }

  @Post()
  @RequirePermission('liquidaciones', 'crear')
  create(@Body() dto: CreateLiquidacionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.liq.create(dto, user.id);
  }

  @Put(':id/items')
  @RequirePermission('liquidaciones', 'editar')
  upsertItem(
    @Param('id') id: string,
    @Body() dto: UpsertItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.liq.upsertItem(id, dto, user.id);
  }

  @Delete('items/:itemId')
  @RequirePermission('liquidaciones', 'editar')
  eliminarItem(@Param('itemId') itemId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.liq.eliminarItem(itemId, user.id);
  }

  @Patch(':id/estado')
  @RequirePermission('liquidaciones', 'editar')
  cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoLiquidacionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.liq.cambiarEstado(id, dto.estado, user.id);
  }

  @Post(':id/pagar')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('liquidaciones', 'editar')
  pagar(
    @Param('id') id: string,
    @Body() dto: PagarLiquidacionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.liq.pagar(id, dto, user.id);
  }
}
