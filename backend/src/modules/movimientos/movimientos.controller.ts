import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { MovimientosService } from './movimientos.service';
import {
  AnularMovimientoDto,
  CambioMonedaDto,
  CrearEgresoDto,
  CrearIngresoDto,
  EditarMovimientoDto,
  FiltrosMovimientoDto,
  TransferirDto,
} from './dto/movimientos.dto';

@Controller('movimientos')
export class MovimientosController {
  constructor(private readonly mov: MovimientosService) {}

  @Get()
  @RequirePermission('movimientos', 'ver')
  findAll(@Query() filtros: FiltrosMovimientoDto) {
    return this.mov.findAll(filtros);
  }

  /**
   * PDF con logo de los movimientos filtrados (reunión 18/11). Para que Dani
   * lo imprima y haga anotaciones a mano. Respeta todos los filtros activos:
   * caja, tipo, obra, categoría, beneficiario, estado, fechas, texto.
   */
  @Get('pdf')
  @Header('Content-Type', 'application/pdf')
  @RequirePermission('movimientos', 'ver')
  async pdf(@Query() filtros: FiltrosMovimientoDto, @Res() res: Response) {
    res.setHeader(
      'Content-Disposition',
      `inline; filename="movimientos-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    await this.mov.renderListadoPdf(filtros, res);
  }

  @Get(':id')
  @RequirePermission('movimientos', 'ver')
  findOne(@Param('id') id: string) {
    return this.mov.findOne(id);
  }

  @Post('egresos')
  @RequirePermission('movimientos', 'crear')
  crearEgreso(@Body() dto: CrearEgresoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mov.crearEgreso(dto, user.id);
  }

  @Post('ingresos')
  @RequirePermission('movimientos', 'crear')
  crearIngreso(@Body() dto: CrearIngresoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mov.crearIngreso(dto, user.id);
  }

  @Post('transferencias')
  @RequirePermission('movimientos', 'crear')
  transferir(@Body() dto: TransferirDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mov.transferir(dto, user.id);
  }

  @Post('cambio-moneda')
  @RequirePermission('movimientos', 'crear')
  cambio(@Body() dto: CambioMonedaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mov.cambioMoneda(dto, user.id);
  }

  @Post(':id/anular')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('movimientos', 'anular')
  anular(
    @Param('id') id: string,
    @Body() dto: AnularMovimientoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mov.anular(id, dto, user.id);
  }

  @Patch(':id')
  @RequirePermission('movimientos', 'editar')
  editar(
    @Param('id') id: string,
    @Body() dto: EditarMovimientoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mov.editar(id, dto, user.id);
  }
}
