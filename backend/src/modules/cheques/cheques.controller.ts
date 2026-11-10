import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ChequesService } from './cheques.service';
import {
  CambiarEstadoChequeDto,
  CreateChequeDto,
  FiltrosChequeDto,
  UpdateChequeDto,
} from './dto/cheques.dto';

@Controller('cheques')
export class ChequesController {
  constructor(private readonly cheques: ChequesService) {}

  @Get()
  @RequirePermission('cheques', 'ver')
  findAll(@Query() filtros: FiltrosChequeDto) {
    return this.cheques.findAll(filtros);
  }

  @Get(':id')
  @RequirePermission('cheques', 'ver')
  findOne(@Param('id') id: string) {
    return this.cheques.findOne(id);
  }

  @Post()
  @RequirePermission('cheques', 'crear')
  create(@Body() dto: CreateChequeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cheques.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('cheques', 'crear')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateChequeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cheques.update(id, dto, user.id);
  }

  @Post(':id/estado')
  @RequirePermission('cheques', 'cambiar_estado')
  cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoChequeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cheques.cambiarEstado(id, dto, user.id);
  }
}
