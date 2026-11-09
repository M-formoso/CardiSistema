import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CategoriasService } from './categorias.service';
import { CreateAliasDto, CreateCategoriaDto, UpdateCategoriaDto } from './dto/categorias.dto';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categorias: CategoriasService) {}

  @Get()
  @RequirePermission('categorias', 'ver')
  findAll(@Query('soloActivas') soloActivas?: string) {
    return this.categorias.findAll(soloActivas === 'true');
  }

  @Get(':id')
  @RequirePermission('categorias', 'ver')
  findOne(@Param('id') id: string) {
    return this.categorias.findOne(id);
  }

  @Post()
  @RequirePermission('categorias', 'crear')
  create(@Body() dto: CreateCategoriaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.categorias.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('categorias', 'editar')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoriaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categorias.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('categorias', 'desactivar')
  desactivar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.categorias.desactivar(id, user.id);
  }

  // --- Aliases ---

  @Post('aliases')
  @RequirePermission('categorias', 'editar')
  createAlias(@Body() dto: CreateAliasDto) {
    return this.categorias.createAlias(dto);
  }

  @Delete('aliases/:id')
  @RequirePermission('categorias', 'editar')
  deleteAlias(@Param('id') id: string) {
    return this.categorias.deleteAlias(id);
  }
}
