import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ContratosCuotasService } from './contratos-cuotas.service';
import {
  CreateContratoDto,
  FiltrosContratoDto,
  PagarCuotaDto,
} from './dto/contratos-cuotas.dto';

@Controller('contratos-cuotas')
export class ContratosCuotasController {
  constructor(private readonly svc: ContratosCuotasService) {}

  @Get()
  @RequirePermission('contratos_cuotas', 'ver')
  findAll(@Query() filtros: FiltrosContratoDto) {
    return this.svc.findAll(filtros);
  }

  @Get(':id')
  @RequirePermission('contratos_cuotas', 'ver')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @RequirePermission('contratos_cuotas', 'crear')
  create(@Body() dto: CreateContratoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.create(dto, user.id);
  }

  @Post('cuotas/:cuotaId/pagar')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('contratos_cuotas', 'crear')
  pagarCuota(
    @Param('cuotaId') cuotaId: string,
    @Body() dto: PagarCuotaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.pagarCuota(cuotaId, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('contratos_cuotas', 'crear')
  desactivar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.desactivar(id, user.id);
  }
}
