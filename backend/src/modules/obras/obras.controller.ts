import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ObrasService } from './obras.service';
import { CreateObraDto, FiltrosObraDto, UpdateObraDto } from './dto/obras.dto';

@Controller('obras')
export class ObrasController {
  constructor(private readonly obras: ObrasService) {}

  @Get()
  @RequirePermission('obras', 'ver')
  findAll(@Query() filtros: FiltrosObraDto) {
    return this.obras.findAll(filtros);
  }

  @Get(':id')
  @RequirePermission('obras', 'ver')
  findOne(@Param('id') id: string) {
    return this.obras.findOne(id);
  }

  @Post()
  @RequirePermission('obras', 'crear')
  create(@Body() dto: CreateObraDto, @CurrentUser() user: AuthenticatedUser) {
    return this.obras.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('obras', 'editar')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateObraDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.obras.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('obras', 'desactivar')
  desactivar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.obras.desactivar(id, user.id);
  }
}
