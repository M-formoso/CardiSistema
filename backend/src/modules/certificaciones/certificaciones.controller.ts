import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CertificacionesService } from './certificaciones.service';
import {
  AnularCertificacionDto,
  CreateCertificacionDto,
  FiltrosCertificacionDto,
  PagarCertificacionDto,
  UpdateCertificacionDto,
} from './dto/certificaciones.dto';

@Controller('certificaciones')
export class CertificacionesController {
  constructor(private readonly svc: CertificacionesService) {}

  @Get()
  @RequirePermission('certificaciones', 'ver')
  findAll(@Query() filtros: FiltrosCertificacionDto) {
    return this.svc.findAll(filtros);
  }

  @Get(':id')
  @RequirePermission('certificaciones', 'ver')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @RequirePermission('certificaciones', 'crear')
  create(@Body() dto: CreateCertificacionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('certificaciones', 'crear')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCertificacionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.update(id, dto, user.id);
  }

  @Post(':id/pagar')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('certificaciones', 'crear')
  pagar(
    @Param('id') id: string,
    @Body() dto: PagarCertificacionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.pagar(id, dto, user.id);
  }

  @Post(':id/anular')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('certificaciones', 'crear')
  anular(
    @Param('id') id: string,
    @Body() dto: AnularCertificacionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.anular(id, dto, user.id);
  }
}
