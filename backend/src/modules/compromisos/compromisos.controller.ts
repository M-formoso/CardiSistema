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
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CompromisosService } from './compromisos.service';
import {
  CreateVencimientoDto,
  FiltrosCompromisoDto,
  GenerarCompromisosDto,
  OmitirCompromisoDto,
  PagarCompromisoDto,
  UpdateVencimientoDto,
} from './dto/compromisos.dto';

@Controller()
export class CompromisosController {
  constructor(private readonly svc: CompromisosService) {}

  // =============== Vencimientos ===============

  @Get('vencimientos')
  @RequirePermission('compromisos', 'ver')
  listarVencimientos(@Query('soloActivos') soloActivos?: string) {
    return this.svc.listarVencimientos(soloActivos === 'true');
  }

  @Post('vencimientos')
  @RequirePermission('compromisos', 'crear')
  crearVencimiento(
    @Body() dto: CreateVencimientoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.crearVencimiento(dto, user.id);
  }

  @Patch('vencimientos/:id')
  @RequirePermission('compromisos', 'crear')
  actualizarVencimiento(
    @Param('id') id: string,
    @Body() dto: UpdateVencimientoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.actualizarVencimiento(id, dto, user.id);
  }

  @Delete('vencimientos/:id')
  @RequirePermission('compromisos', 'crear')
  desactivarVencimiento(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.desactivarVencimiento(id, user.id);
  }

  // =============== Compromisos ===============

  @Get('compromisos')
  @RequirePermission('compromisos', 'ver')
  listarCompromisos(@Query() filtros: FiltrosCompromisoDto) {
    return this.svc.listarCompromisos(filtros);
  }

  @Get('compromisos/proyeccion')
  @RequirePermission('compromisos', 'ver')
  proyeccion(@Query('dias') dias?: string) {
    return this.svc.proyeccion(dias ? Number(dias) : 30);
  }

  @Post('compromisos/generar')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('compromisos', 'crear')
  generar(@Body() dto: GenerarCompromisosDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.generarMes(dto.mes, dto.anio, user.id);
  }

  @Post('compromisos/:id/pagar')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('compromisos', 'crear')
  pagar(
    @Param('id') id: string,
    @Body() dto: PagarCompromisoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.pagarCompromiso(id, dto, user.id);
  }

  @Post('compromisos/:id/omitir')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('compromisos', 'crear')
  omitir(
    @Param('id') id: string,
    @Body() dto: OmitirCompromisoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.omitirCompromiso(id, dto, user.id);
  }
}
