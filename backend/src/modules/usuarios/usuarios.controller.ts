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
import { UsuariosService } from './usuarios.service';
import {
  CreateUsuarioDto,
  ResetPasswordDto,
  SetPermisosDto,
  UpdateUsuarioDto,
} from './dto/usuarios.dto';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly svc: UsuariosService) {}

  @Get()
  @RequirePermission('usuarios', 'gestionar')
  findAll(@Query('soloActivos') soloActivos?: string) {
    return this.svc.findAll(soloActivos === 'true');
  }

  @Get(':id')
  @RequirePermission('usuarios', 'gestionar')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @RequirePermission('usuarios', 'gestionar')
  create(@Body() dto: CreateUsuarioDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('usuarios', 'gestionar')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUsuarioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('usuarios', 'gestionar')
  desactivar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.desactivar(id, user.id);
  }

  @Post(':id/activar')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('usuarios', 'gestionar')
  activar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.activar(id, user.id);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('usuarios', 'gestionar')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.resetPassword(id, dto, user.id);
  }

  @Put(':id/permisos')
  @RequirePermission('usuarios', 'gestionar')
  setPermisos(
    @Param('id') id: string,
    @Body() dto: SetPermisosDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.setPermisos(id, dto, user.id);
  }
}
