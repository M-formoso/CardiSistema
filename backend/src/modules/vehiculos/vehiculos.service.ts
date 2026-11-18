import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoMovimiento, Prisma, TipoMovimiento } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type {
  ActualizarVehiculoDto,
  CrearVehiculoDto,
  FiltrosVehiculoDto,
} from './dto/vehiculos.dto';

/**
 * CRUD de Vehículos (reunión Dani 18/11). Cada vehículo acumula sus gastos
 * desde Movimiento vía MovimientoVehiculo (N:N con monto por vehículo).
 * El detalle lista todos los pagos imputados y su suma (gasto total).
 */
@Injectable()
export class VehiculosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
  ) {}

  async findAll(filtros: FiltrosVehiculoDto) {
    const where: Prisma.VehiculoWhereInput = {};
    if (filtros.activo !== undefined) where.activo = filtros.activo;
    if (filtros.q) {
      where.OR = [
        { nombre: { contains: filtros.q, mode: 'insensitive' } },
        { patente: { contains: filtros.q, mode: 'insensitive' } },
        { modelo: { contains: filtros.q, mode: 'insensitive' } },
      ];
    }
    const vehiculos = await this.prisma.vehiculo.findMany({
      where,
      orderBy: { nombre: 'asc' },
    });
    if (vehiculos.length === 0) return [];

    // Gasto total por vehículo = Σ MovimientoVehiculo.monto de EGRESOS
    // confirmados. Lo calculamos en JS para no complicar la query.
    const imputaciones = await this.prisma.movimientoVehiculo.findMany({
      where: {
        vehiculoId: { in: vehiculos.map((v) => v.id) },
        movimiento: {
          tipo: TipoMovimiento.EGRESO,
          estado: EstadoMovimiento.CONFIRMADO,
        },
      },
      select: { vehiculoId: true, monto: true },
    });
    const totalPorVehiculo = new Map<string, number>();
    for (const imp of imputaciones) {
      const prev = totalPorVehiculo.get(imp.vehiculoId) ?? 0;
      totalPorVehiculo.set(imp.vehiculoId, prev + Number(imp.monto));
    }
    return vehiculos.map((v) => ({
      ...v,
      gastoTotal: (totalPorVehiculo.get(v.id) ?? 0).toFixed(2),
    }));
  }

  async findOne(id: string) {
    const vehiculo = await this.prisma.vehiculo.findUnique({ where: { id } });
    if (!vehiculo) throw new NotFoundException('Vehículo no encontrado');

    const imputaciones = await this.prisma.movimientoVehiculo.findMany({
      where: {
        vehiculoId: id,
        movimiento: { estado: EstadoMovimiento.CONFIRMADO },
      },
      include: {
        movimiento: {
          include: {
            caja: { select: { nombre: true, moneda: true } },
            categoria: { select: { nombre: true, codigo: true } },
            beneficiario: { select: { nombre: true } },
          },
        },
      },
      orderBy: { movimiento: { fecha: 'desc' } },
      take: 300,
    });
    const gastoTotal = imputaciones.reduce((acc, i) => acc + Number(i.monto), 0);

    return {
      vehiculo,
      gastoTotal: gastoTotal.toFixed(2),
      pagos: imputaciones.map((imp) => ({
        id: imp.movimiento.id,
        fecha: imp.movimiento.fecha,
        montoImputado: imp.monto.toString(),
        montoTotalMovimiento: imp.movimiento.monto.toString(),
        moneda: imp.movimiento.moneda,
        medioPago: imp.movimiento.medioPago,
        descripcion: imp.movimiento.descripcion,
        caja: imp.movimiento.caja,
        categoria: imp.movimiento.categoria,
        beneficiario: imp.movimiento.beneficiario,
      })),
    };
  }

  async create(dto: CrearVehiculoDto, userId: string) {
    const creado = await this.prisma.vehiculo.create({
      data: {
        nombre: dto.nombre,
        modelo: dto.modelo,
        patente: dto.patente.toUpperCase(),
        observaciones: dto.observaciones,
        createdById: userId,
        updatedById: userId,
      },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Vehiculo',
      entidadId: creado.id,
      despues: creado as unknown,
    });
    return creado;
  }

  async update(id: string, dto: ActualizarVehiculoDto, userId: string) {
    const antes = await this.findOne(id);
    const despues = await this.prisma.vehiculo.update({
      where: { id },
      data: {
        ...dto,
        patente: dto.patente ? dto.patente.toUpperCase() : undefined,
        updatedById: userId,
      },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'Vehiculo',
      entidadId: id,
      antes: antes as unknown,
      despues: despues as unknown,
    });
    return despues;
  }

  async desactivar(id: string, userId: string) {
    const existe = await this.prisma.vehiculo.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Vehículo no encontrado');
    const tienePagos = await this.prisma.movimientoVehiculo.count({
      where: { vehiculoId: id },
    });
    if (tienePagos === 0) {
      // Sin historial → se puede eliminar físicamente
      await this.prisma.vehiculo.delete({ where: { id } });
      return { eliminado: true };
    }
    // Con historial → soft delete
    if (!existe.activo) throw new BadRequestException('Ya está inactivo');
    await this.prisma.vehiculo.update({
      where: { id },
      data: { activo: false, updatedById: userId },
    });
    return { eliminado: false, desactivado: true };
  }
}
