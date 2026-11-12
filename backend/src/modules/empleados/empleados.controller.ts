import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { EmpleadosService } from './empleados.service';
import {
  ActualizarJornalDto,
  CreateEmpleadoDto,
  FiltrosEmpleadoDto,
  UpdateEmpleadoDto,
} from './dto/empleados.dto';

@Controller('empleados')
export class EmpleadosController {
  constructor(private readonly empleados: EmpleadosService) {}

  @Get()
  @RequirePermission('empleados', 'ver')
  findAll(@Query() filtros: FiltrosEmpleadoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.empleados.findAll(filtros, user);
  }

  @Get(':id')
  @RequirePermission('empleados', 'ver')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.empleados.findOne(id, user);
  }

  @Get(':id/liquidaciones')
  @RequirePermission('liquidaciones', 'ver')
  liquidacionesDe(@Param('id') id: string) {
    return this.empleados.liquidacionesDe(id);
  }

  @Get(':id/prestamos')
  @RequirePermission('empleados', 'ver')
  prestamosDe(@Param('id') id: string) {
    return this.empleados.prestamosDe(id);
  }

  @Get(':id/jornales')
  @RequirePermission('empleados', 'datos_sensibles')
  historialJornales(@Param('id') id: string) {
    return this.empleados.historialJornales(id);
  }

  @Post()
  @RequirePermission('empleados', 'crear')
  create(@Body() dto: CreateEmpleadoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.empleados.create(dto, user.id);
  }

  /** Carga los empleados del Excel inicial del cliente. Idempotente. */
  @Post('cargar-iniciales')
  @RequirePermission('empleados', 'crear')
  cargarIniciales(@CurrentUser() user: AuthenticatedUser) {
    return this.empleados.cargarIniciales(user.id);
  }

  @Patch(':id')
  @RequirePermission('empleados', 'editar')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmpleadoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.empleados.update(id, dto, user.id);
  }

  @Put(':id/jornal')
  @RequirePermission('empleados', 'datos_sensibles')
  actualizarJornal(
    @Param('id') id: string,
    @Body() dto: ActualizarJornalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.empleados.actualizarJornal(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('empleados', 'desactivar')
  desactivar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.empleados.desactivar(id, user.id);
  }
}
