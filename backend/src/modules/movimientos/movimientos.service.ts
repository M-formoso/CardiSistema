import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CotizacionTipo,
  EstadoCheque,
  EstadoMovimiento,
  EstadoPrestamoEmpleado,
  FuenteCotizacion,
  MedioPago,
  Moneda,
  OrigenMovimiento,
  Prisma,
  TipoBeneficiario,
  TipoMovimiento,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Writable } from 'node:stream';
import PDFDocument from 'pdfkit';
import { arsAUsd, formatearMonto, repartirMonto, usdAArs } from '@cardi/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';
import type {
  AnularMovimientoDto,
  CambioMonedaDto,
  CrearEgresoDto,
  CrearIngresoDto,
  EditarMovimientoDto,
  FiltrosMovimientoDto,
  TransferirDto,
} from './dto/movimientos.dto';

/**
 * Servicio de movimientos (libro único de la billetera).
 *
 * Patrón tomado de `sistemaCocGuana/backend/src/tesoreria/tesoreria.service.ts`,
 * adaptado a Cardi:
 * - Cotización congelada en cada movimiento (monto en ambas monedas).
 * - Anulación por REVERSA (nunca se edita o borra un CONFIRMADO).
 * - Transferencia y cambio de moneda: pares INGRESO+EGRESO con mismo grupoId.
 * - Imputación N obras (nuevo vs Cocoguana): validada con `repartirMonto`
 *   de @cardi/shared para que la suma cierre exacto.
 */
@Injectable()
export class MovimientosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cotizaciones: CotizacionesService,
    private readonly audit: AuditoriaService,
  ) {}

  // ================= LISTADOS =================

  async findAll(filtros: FiltrosMovimientoDto) {
    const where: Prisma.MovimientoWhereInput = {};
    if (filtros.cajaId) where.cajaId = filtros.cajaId;
    if (filtros.tipo) where.tipo = filtros.tipo as TipoMovimiento;
    if (filtros.beneficiarioId) where.beneficiarioId = filtros.beneficiarioId;
    if (filtros.categoriaId) where.categoriaId = filtros.categoriaId;
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.origen) where.origen = filtros.origen;
    if (filtros.desde || filtros.hasta) {
      where.fecha = {
        gte: filtros.desde,
        lte: filtros.hasta,
      };
    }
    if (filtros.obraId) {
      // El movimiento puede estar vinculado a una obra de dos formas:
      // - EGRESO: una o más Imputacion con obraId
      // - INGRESO: obraIngresoId directo (sin imputaciones)
      // Para que el filtro combine bien con otros (ej. beneficiarioId=Casa Santo
      // + obraId=Droma), usamos OR:
      where.OR = [
        { imputaciones: { some: { obraId: filtros.obraId } } },
        { obraIngresoId: filtros.obraId },
      ];
    }
    if (filtros.q) {
      where.descripcion = { contains: filtros.q, mode: 'insensitive' };
    }
    const [total, data] = await this.prisma.$transaction([
      this.prisma.movimiento.count({ where }),
      this.prisma.movimiento.findMany({
        where,
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        skip: (filtros.page - 1) * filtros.pageSize,
        take: filtros.pageSize,
        include: {
          caja: true,
          beneficiario: true,
          categoria: true,
          imputaciones: { include: { obra: true } },
          cheque: true,
        },
      }),
    ]);
    return { total, page: filtros.page, pageSize: filtros.pageSize, data };
  }

  async findOne(id: string) {
    const mov = await this.prisma.movimiento.findUnique({
      where: { id },
      include: {
        caja: true,
        beneficiario: true,
        categoria: true,
        imputaciones: { include: { obra: true } },
        vehiculos: { include: { vehiculo: { select: { id: true, nombre: true, patente: true } } } },
        obraIngreso: { select: { id: true, nombre: true } },
        cheque: true,
        recibo: true,
        createdBy: { select: { nombre: true } },
        anuladoPor: { select: { nombre: true } },
      },
    });
    if (!mov) throw new NotFoundException('Movimiento no encontrado');
    return mov;
  }

  // ================= EGRESO =================

  async crearEgreso(dto: CrearEgresoDto, userId: string) {
    const caja = await this.prisma.caja.findUnique({ where: { id: dto.cajaId } });
    if (!caja || !caja.activo) throw new BadRequestException('Caja inválida o inactiva');

    const { cotizacion, cotizacionTipo } = await this.resolverCotizacion(
      dto.cotizacion,
      dto.cotizacionTipo,
    );

    // El egreso se puede imputar a OBRAS (caso normal) o a VEHÍCULOS (cuando
    // la categoría de servicio tiene flag vinculadaVehiculo). Nunca a los
    // dos a la vez. El DTO.refine garantiza que haya al menos uno.
    const imputarAVehiculos = !!dto.vehiculos && dto.vehiculos.length > 0;

    const imputaciones = imputarAVehiculos
      ? []
      : repartirMonto(dto.monto, dto.imputaciones ?? []);
    if (imputaciones.length > 0) {
      await this.validarObrasActivas(imputaciones.map((i) => i.obraId));
    }

    // Validar imputación a vehículos: existencia + que sume exacto al monto
    if (imputarAVehiculos && dto.vehiculos) {
      const ids = dto.vehiculos.map((v) => v.vehiculoId);
      const unicos = new Set(ids);
      if (unicos.size !== ids.length) {
        throw new BadRequestException('Vehículo repetido en la imputación');
      }
      const vehiculos = await this.prisma.vehiculo.findMany({
        where: { id: { in: ids } },
      });
      if (vehiculos.length !== ids.length) {
        throw new BadRequestException('Algún vehículo no existe');
      }
      const inactivos = vehiculos.filter((v) => !v.activo);
      if (inactivos.length > 0) {
        throw new BadRequestException(
          `Vehículos inactivos: ${inactivos.map((v) => v.nombre).join(', ')}`,
        );
      }
      const sumaVeh = dto.vehiculos.reduce((acc, v) => acc + v.monto, 0);
      if (Math.abs(sumaVeh - dto.monto) > 0.01) {
        throw new BadRequestException(
          `La suma por vehículo (${sumaVeh.toFixed(2)}) debe ser igual al monto del egreso (${dto.monto.toFixed(2)})`,
        );
      }
    }

    // Si el pago es con cheque de tercero, validar que el cheque esté en
    // cartera, que la moneda coincida con la caja y que el monto del egreso
    // sea EXACTO al monto del cheque (Enfoque C del SDD: 1 cheque = 1 egreso,
    // el reparto es por obra, no por valor del cheque).
    let cheque: Awaited<ReturnType<typeof this.prisma.cheque.findUnique>> | null = null;
    if (dto.chequeId) {
      cheque = await this.prisma.cheque.findUnique({ where: { id: dto.chequeId } });
      if (!cheque) throw new BadRequestException('El cheque indicado no existe');
      if (cheque.estado !== EstadoCheque.EN_CARTERA) {
        throw new BadRequestException(
          `El cheque está en estado ${cheque.estado} — solo se pueden entregar cheques EN_CARTERA`,
        );
      }
      if (cheque.moneda !== caja.moneda) {
        throw new BadRequestException(
          `El cheque es ${cheque.moneda} pero la caja está en ${caja.moneda}`,
        );
      }
      if (Number(cheque.monto) !== dto.monto) {
        throw new BadRequestException(
          `El egreso debe ser por el monto exacto del cheque (${cheque.monto})`,
        );
      }
    }

    // Detectar si es un préstamo a empleado (categoría PREST_EMP)
    const esPrestamoEmpleado = await this.esEgresoDePrestamo(
      dto.categoriaId,
      dto.beneficiarioId,
    );

    // Si el egreso es a un beneficiario PROVEEDOR y no viene categoría, auto-
    // asignar la categoría "Pago a proveedor" (código PAGO_PROV). Se crea on
    // demand si no existe todavía — así el feature funciona en prod sin
    // depender de que el seed haya corrido ya.
    let categoriaIdFinal = dto.categoriaId;
    if (!categoriaIdFinal && dto.beneficiarioId) {
      const ben = await this.prisma.beneficiario.findUnique({
        where: { id: dto.beneficiarioId },
        select: { tipo: true },
      });
      if (ben?.tipo === TipoBeneficiario.PROVEEDOR) {
        const cat = await this.prisma.categoriaGasto.upsert({
          where: { codigo: 'PAGO_PROV' },
          create: { codigo: 'PAGO_PROV', nombre: 'Pago a proveedor', orden: 98 },
          update: {},
        });
        categoriaIdFinal = cat.id;
      }
    }

    const { montoArs, montoUsd } = this.convertirMontos(dto.monto, caja.moneda, cotizacion);

    const grupoId = randomUUID();
    const mov = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.movimiento.create({
        data: {
          tipo: TipoMovimiento.EGRESO,
          fecha: dto.fecha,
          cajaId: caja.id,
          moneda: caja.moneda,
          monto: new Prisma.Decimal(dto.monto),
          medioPago: dto.medioPago,
          descripcion: dto.descripcion,
          cotizacion: new Prisma.Decimal(cotizacion),
          cotizacionTipo,
          montoArs: new Prisma.Decimal(montoArs),
          montoUsd: new Prisma.Decimal(montoUsd),
          beneficiarioId: dto.beneficiarioId,
          categoriaId: categoriaIdFinal,
          chequeId: dto.chequeId,
          grupoId,
          origen: esPrestamoEmpleado ? OrigenMovimiento.PRESTAMO : OrigenMovimiento.MANUAL,
          estado: EstadoMovimiento.CONFIRMADO,
          createdById: userId,
          updatedById: userId,
          imputaciones: {
            create: imputaciones.map((i) => ({
              obraId: i.obraId,
              monto: new Prisma.Decimal(i.monto.toString()),
              porcentaje: new Prisma.Decimal(i.porcentaje.toString()),
            })),
          },
          vehiculos: imputarAVehiculos
            ? {
                create: (dto.vehiculos ?? []).map((v) => ({
                  vehiculoId: v.vehiculoId,
                  monto: new Prisma.Decimal(v.monto.toString()),
                })),
              }
            : undefined,
        },
        include: { imputaciones: true, caja: true },
      });

      // Si usamos un cheque, pasarlo a ENTREGADO y linkearle el beneficiario
      // del egreso si no lo tenía ya. Re-leemos dentro de la tx para evitar
      // el race condition de dos egresos concurrentes eligiendo el mismo
      // cheque (R7 del SDD).
      if (dto.chequeId) {
        const chequeActual = await tx.cheque.findUnique({ where: { id: dto.chequeId } });
        if (!chequeActual || chequeActual.estado !== EstadoCheque.EN_CARTERA) {
          throw new BadRequestException('El cheque ya no está disponible');
        }
        await tx.cheque.update({
          where: { id: dto.chequeId },
          data: {
            estado: EstadoCheque.ENTREGADO,
            beneficiarioId: chequeActual.beneficiarioId ?? dto.beneficiarioId ?? null,
            updatedById: userId,
          },
        });
      }

      // Si es préstamo a empleado, creo el PrestamoEmpleado dentro de la misma transacción
      if (esPrestamoEmpleado && dto.beneficiarioId) {
        const monto = new Prisma.Decimal(dto.monto);
        const prestamo = await tx.prestamoEmpleado.create({
          data: {
            beneficiarioId: dto.beneficiarioId,
            fecha: dto.fecha,
            monto,
            saldoPendiente: monto,
            movimientoId: creado.id,
            observaciones: dto.descripcion,
            estado: EstadoPrestamoEmpleado.VIGENTE,
            createdById: userId,
            updatedById: userId,
          },
        });
        // Linkeo el movimiento con el origenId = id del préstamo
        await tx.movimiento.update({
          where: { id: creado.id },
          data: { origenId: prestamo.id },
        });
      }

      return creado;
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Movimiento',
      entidadId: mov.id,
      despues: { ...mov, imputaciones: mov.imputaciones } as unknown,
      observacion: esPrestamoEmpleado ? 'Egreso de préstamo a empleado' : undefined,
    });
    return mov;
  }

  /**
   * Devuelve true si el egreso corresponde a un préstamo a empleado:
   * la categoría tiene código PREST_EMP y el beneficiario es tipo EMPLEADO.
   */
  private async esEgresoDePrestamo(
    categoriaId: string | undefined,
    beneficiarioId: string | undefined,
  ): Promise<boolean> {
    if (!categoriaId || !beneficiarioId) return false;
    const cat = await this.prisma.categoriaGasto.findUnique({
      where: { id: categoriaId },
      select: { codigo: true },
    });
    if (cat?.codigo !== 'PREST_EMP') return false;
    const ben = await this.prisma.beneficiario.findUnique({
      where: { id: beneficiarioId },
      select: { tipo: true },
    });
    if (ben?.tipo !== TipoBeneficiario.EMPLEADO) {
      throw new BadRequestException(
        'Un préstamo con categoría "Préstamos a empleados" requiere un beneficiario tipo EMPLEADO',
      );
    }
    return true;
  }

  // ================= INGRESO =================

  async crearIngreso(dto: CrearIngresoDto, userId: string) {
    const caja = await this.prisma.caja.findUnique({ where: { id: dto.cajaId } });
    if (!caja || !caja.activo) throw new BadRequestException('Caja inválida o inactiva');

    const { cotizacion, cotizacionTipo } = await this.resolverCotizacion(
      dto.cotizacion,
      dto.cotizacionTipo,
    );
    const { montoArs, montoUsd } = this.convertirMontos(dto.monto, caja.moneda, cotizacion);

    const mov = await this.prisma.movimiento.create({
      data: {
        tipo: TipoMovimiento.INGRESO,
        fecha: dto.fecha,
        cajaId: caja.id,
        moneda: caja.moneda,
        monto: new Prisma.Decimal(dto.monto),
        medioPago: dto.medioPago,
        descripcion: dto.descripcion,
        cotizacion: new Prisma.Decimal(cotizacion),
        cotizacionTipo,
        montoArs: new Prisma.Decimal(montoArs),
        montoUsd: new Prisma.Decimal(montoUsd),
        beneficiarioId: dto.beneficiarioId,
        categoriaId: dto.categoriaId,
        obraIngresoId: dto.obraIngresoId,
        origen: OrigenMovimiento.MANUAL,
        estado: EstadoMovimiento.CONFIRMADO,
        createdById: userId,
        updatedById: userId,
      },
      include: { caja: true },
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Movimiento',
      entidadId: mov.id,
      despues: mov as unknown,
    });
    return mov;
  }

  // ================= TRANSFERENCIA entre cajas (misma moneda) =================

  async transferir(dto: TransferirDto, userId: string) {
    const [origen, destino] = await Promise.all([
      this.prisma.caja.findUnique({ where: { id: dto.cajaOrigenId } }),
      this.prisma.caja.findUnique({ where: { id: dto.cajaDestinoId } }),
    ]);
    if (!origen || !destino) throw new NotFoundException('Caja no encontrada');
    if (!origen.activo || !destino.activo) throw new BadRequestException('Caja inactiva');
    if (origen.moneda !== destino.moneda) {
      throw new BadRequestException(
        'Transferencia entre cajas de distinta moneda: usar el endpoint de cambio de moneda',
      );
    }

    const { cotizacion, cotizacionTipo } = await this.resolverCotizacion();
    const { montoArs, montoUsd } = this.convertirMontos(dto.monto, origen.moneda, cotizacion);
    const desc = dto.descripcion ?? `Transferencia ${origen.nombre} → ${destino.nombre}`;
    const grupoId = randomUUID();

    const [salida, entrada] = await this.prisma.$transaction(async (tx) => {
      const egreso = await tx.movimiento.create({
        data: {
          tipo: TipoMovimiento.EGRESO,
          fecha: dto.fecha,
          cajaId: origen.id,
          moneda: origen.moneda,
          monto: new Prisma.Decimal(dto.monto),
          medioPago: MedioPago.TRANSFERENCIA,
          descripcion: `${desc} (salida)`,
          cotizacion: new Prisma.Decimal(cotizacion),
          cotizacionTipo,
          montoArs: new Prisma.Decimal(montoArs),
          montoUsd: new Prisma.Decimal(montoUsd),
          grupoId,
          origen: OrigenMovimiento.MANUAL,
          estado: EstadoMovimiento.CONFIRMADO,
          createdById: userId,
          updatedById: userId,
        },
      });
      const ingreso = await tx.movimiento.create({
        data: {
          tipo: TipoMovimiento.INGRESO,
          fecha: dto.fecha,
          cajaId: destino.id,
          moneda: destino.moneda,
          monto: new Prisma.Decimal(dto.monto),
          medioPago: MedioPago.TRANSFERENCIA,
          descripcion: `${desc} (entrada)`,
          cotizacion: new Prisma.Decimal(cotizacion),
          cotizacionTipo,
          montoArs: new Prisma.Decimal(montoArs),
          montoUsd: new Prisma.Decimal(montoUsd),
          grupoId,
          origen: OrigenMovimiento.MANUAL,
          estado: EstadoMovimiento.CONFIRMADO,
          createdById: userId,
          updatedById: userId,
        },
      });
      return [egreso, ingreso];
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Movimiento',
      entidadId: grupoId,
      despues: { salida, entrada } as unknown,
      observacion: 'Transferencia',
    });
    return { salida, entrada };
  }

  // ================= CAMBIO DE MONEDA =================

  async cambioMoneda(dto: CambioMonedaDto, userId: string) {
    const [origen, destino] = await Promise.all([
      this.prisma.caja.findUnique({ where: { id: dto.cajaOrigenId } }),
      this.prisma.caja.findUnique({ where: { id: dto.cajaDestinoId } }),
    ]);
    if (!origen || !destino) throw new NotFoundException('Caja no encontrada');
    if (!origen.activo || !destino.activo) throw new BadRequestException('Caja inactiva');
    if (origen.moneda === destino.moneda) {
      throw new BadRequestException(
        'Ambas cajas tienen la misma moneda: usar el endpoint de transferencia',
      );
    }
    const desc = dto.descripcion ?? `Cambio ${origen.moneda} → ${destino.moneda}`;
    const grupoId = randomUUID();

    const [salida, entrada] = await this.prisma.$transaction(async (tx) => {
      const egreso = await tx.movimiento.create({
        data: {
          tipo: TipoMovimiento.EGRESO,
          fecha: dto.fecha,
          cajaId: origen.id,
          moneda: origen.moneda,
          monto: new Prisma.Decimal(dto.montoOrigen),
          medioPago: MedioPago.TRANSFERENCIA,
          descripcion: `${desc} (salida)`,
          cotizacion: new Prisma.Decimal(dto.cotizacion),
          cotizacionTipo: dto.cotizacionTipo,
          montoArs: new Prisma.Decimal(
            this.convertirMontos(dto.montoOrigen, origen.moneda, dto.cotizacion).montoArs,
          ),
          montoUsd: new Prisma.Decimal(
            this.convertirMontos(dto.montoOrigen, origen.moneda, dto.cotizacion).montoUsd,
          ),
          grupoId,
          origen: OrigenMovimiento.MANUAL,
          estado: EstadoMovimiento.CONFIRMADO,
          createdById: userId,
          updatedById: userId,
        },
      });
      const ingreso = await tx.movimiento.create({
        data: {
          tipo: TipoMovimiento.INGRESO,
          fecha: dto.fecha,
          cajaId: destino.id,
          moneda: destino.moneda,
          monto: new Prisma.Decimal(dto.montoDestino),
          medioPago: MedioPago.TRANSFERENCIA,
          descripcion: `${desc} (entrada)`,
          cotizacion: new Prisma.Decimal(dto.cotizacion),
          cotizacionTipo: dto.cotizacionTipo,
          montoArs: new Prisma.Decimal(
            this.convertirMontos(dto.montoDestino, destino.moneda, dto.cotizacion).montoArs,
          ),
          montoUsd: new Prisma.Decimal(
            this.convertirMontos(dto.montoDestino, destino.moneda, dto.cotizacion).montoUsd,
          ),
          grupoId,
          origen: OrigenMovimiento.MANUAL,
          estado: EstadoMovimiento.CONFIRMADO,
          createdById: userId,
          updatedById: userId,
        },
      });
      return [egreso, ingreso];
    });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'Movimiento',
      entidadId: grupoId,
      despues: { salida, entrada } as unknown,
      observacion: 'Cambio de moneda',
    });
    return { salida, entrada };
  }

  // ================= ANULACIÓN POR REVERSA =================

  async anular(id: string, dto: AnularMovimientoDto, userId: string) {
    const original = await this.prisma.movimiento.findUnique({
      where: { id },
      include: { imputaciones: true },
    });
    if (!original) throw new NotFoundException('Movimiento no encontrado');
    if (original.estado !== EstadoMovimiento.CONFIRMADO) {
      throw new BadRequestException(
        `Solo se pueden anular movimientos CONFIRMADOS (actual: ${original.estado})`,
      );
    }

    const tipoReversa =
      original.tipo === TipoMovimiento.INGRESO
        ? TipoMovimiento.EGRESO
        : original.tipo === TipoMovimiento.EGRESO
          ? TipoMovimiento.INGRESO
          : null;
    if (!tipoReversa) {
      throw new BadRequestException(
        `Tipo ${original.tipo} no soporta anulación individual — anular el grupo`,
      );
    }

    const { original: actualizado, reversa } = await this.prisma.$transaction(async (tx) => {
      const reversa = await tx.movimiento.create({
        data: {
          tipo: tipoReversa,
          fecha: new Date(),
          cajaId: original.cajaId,
          moneda: original.moneda,
          monto: original.monto,
          medioPago: original.medioPago,
          descripcion: `Reversa · ${original.descripcion ?? ''}`.trim(),
          cotizacion: original.cotizacion,
          cotizacionTipo: original.cotizacionTipo,
          montoArs: original.montoArs,
          montoUsd: original.montoUsd,
          beneficiarioId: original.beneficiarioId,
          categoriaId: original.categoriaId,
          movimientoOriginalId: original.id,
          grupoId: original.grupoId,
          origen: original.origen,
          origenId: original.origenId,
          estado: EstadoMovimiento.REVERSA,
          createdById: userId,
          updatedById: userId,
          // Las imputaciones de la reversa son las mismas pero con signo lógico opuesto.
          // Al calcular gasto por obra, los EGRESO suman y las REVERSAS de EGRESO (que
          // son del tipo INGRESO) se consideran por su tipo => se cancela automáticamente.
          imputaciones: {
            create: original.imputaciones.map((i) => ({
              obraId: i.obraId,
              monto: i.monto,
              porcentaje: i.porcentaje,
            })),
          },
        },
      });
      const actualizadoAnulado = await tx.movimiento.update({
        where: { id: original.id },
        data: {
          estado: EstadoMovimiento.ANULADO,
          anuladoAt: new Date(),
          anuladoPorId: userId,
          motivoAnulacion: dto.motivo,
          updatedById: userId,
        },
      });
      return { original: actualizadoAnulado, reversa };
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ANULAR',
      entidad: 'Movimiento',
      entidadId: id,
      antes: original as unknown,
      despues: actualizado as unknown,
      observacion: dto.motivo,
    });
    return { original: actualizado, reversa };
  }

  // ================= EDICIÓN =================

  /**
   * Edita campos "seguros" de un movimiento CONFIRMADO: fecha, descripción,
   * beneficiario, categoría, obra (para ingresos) y reparto de imputaciones.
   * NO toca monto, caja, moneda, cotización, tipo ni chequeId — si hay que
   * corregir eso, se anula el movimiento y se vuelve a cargar.
   *
   * Requiere permiso `movimientos:editar` (por defecto solo ADMIN, controlado
   * en el controller con RequirePermission).
   */
  async editar(id: string, dto: EditarMovimientoDto, userId: string) {
    const original = await this.prisma.movimiento.findUnique({
      where: { id },
      include: { imputaciones: true },
    });
    if (!original) throw new NotFoundException('Movimiento no encontrado');
    if (original.estado !== EstadoMovimiento.CONFIRMADO) {
      throw new BadRequestException(
        `Solo se pueden editar movimientos CONFIRMADOS (actual: ${original.estado})`,
      );
    }

    // Si vienen imputaciones, validar que repartan exacto el monto del movimiento.
    let imputacionesCalculadas: ReturnType<typeof repartirMonto> | undefined;
    if (dto.imputaciones) {
      imputacionesCalculadas = repartirMonto(Number(original.monto), dto.imputaciones);
      await this.validarObrasActivas(imputacionesCalculadas.map((i) => i.obraId));
    }

    if (dto.obraIngresoId) {
      const obra = await this.prisma.obra.findUnique({ where: { id: dto.obraIngresoId } });
      if (!obra || !obra.activo) {
        throw new BadRequestException('La obra indicada no existe o está inactiva');
      }
    }

    const actualizado = await this.prisma.$transaction(async (tx) => {
      if (imputacionesCalculadas) {
        await tx.imputacion.deleteMany({ where: { movimientoId: id } });
        await tx.imputacion.createMany({
          data: imputacionesCalculadas.map((i) => ({
            movimientoId: id,
            obraId: i.obraId,
            monto: new Prisma.Decimal(i.monto.toString()),
            porcentaje: new Prisma.Decimal(i.porcentaje.toString()),
          })),
        });
      }

      const data: Prisma.MovimientoUncheckedUpdateInput = { updatedById: userId };
      if (dto.fecha !== undefined) data.fecha = dto.fecha;
      if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;
      if (dto.beneficiarioId !== undefined) data.beneficiarioId = dto.beneficiarioId;
      if (dto.categoriaId !== undefined) data.categoriaId = dto.categoriaId;
      if (dto.obraIngresoId !== undefined) data.obraIngresoId = dto.obraIngresoId;

      return tx.movimiento.update({
        where: { id },
        data,
        include: { imputaciones: { include: { obra: true } } },
      });
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ACTUALIZAR',
      entidad: 'Movimiento',
      entidadId: id,
      antes: original as unknown,
      despues: actualizado as unknown,
    });
    return actualizado;
  }

  // ================= PDF DE BILLETERA (filtros aplicados) =================

  /**
   * Genera el PDF de la billetera con los movimientos que matchean los filtros
   * aplicados. Reunión Dani 18/11: "botón Imprimir que lleve a un PDF con
   * logo de los movimientos filtrados. Lo imprime para anotar a mano."
   *
   * Formato A4 horizontal (muchas columnas). Hasta 500 movimientos por PDF.
   */
  async renderListadoPdf(filtros: FiltrosMovimientoDto, out: Writable) {
    // Reusamos findAll pero sin paginar — pedimos un pageSize grande.
    const resultado = await this.findAll({
      ...filtros,
      page: 1,
      pageSize: 500,
    });

    // Resolver nombres legibles de los filtros aplicados (para el header)
    const [caja, obra, categoria, beneficiario] = await Promise.all([
      filtros.cajaId
        ? this.prisma.caja.findUnique({ where: { id: filtros.cajaId }, select: { nombre: true } })
        : null,
      filtros.obraId
        ? this.prisma.obra.findUnique({ where: { id: filtros.obraId }, select: { nombre: true } })
        : null,
      filtros.categoriaId
        ? this.prisma.categoriaGasto.findUnique({
            where: { id: filtros.categoriaId },
            select: { nombre: true },
          })
        : null,
      filtros.beneficiarioId
        ? this.prisma.beneficiario.findUnique({
            where: { id: filtros.beneficiarioId },
            select: { nombre: true },
          })
        : null,
    ]);

    const filtrosLegibles: Array<[string, string]> = [];
    if (caja) filtrosLegibles.push(['Caja', caja.nombre]);
    if (filtros.tipo) filtrosLegibles.push(['Tipo', filtros.tipo]);
    if (obra) filtrosLegibles.push(['Obra', obra.nombre]);
    if (categoria) filtrosLegibles.push(['Categoría', categoria.nombre]);
    if (beneficiario) filtrosLegibles.push(['Proveedor/Origen', beneficiario.nombre]);
    if (filtros.estado) filtrosLegibles.push(['Estado', filtros.estado]);
    if (filtros.desde)
      filtrosLegibles.push(['Desde', new Date(filtros.desde).toLocaleDateString('es-AR')]);
    if (filtros.hasta)
      filtrosLegibles.push(['Hasta', new Date(filtros.hasta).toLocaleDateString('es-AR')]);
    if (filtros.q) filtrosLegibles.push(['Texto', filtros.q]);
    if (filtrosLegibles.length === 0)
      filtrosLegibles.push(['Período', 'Todos los movimientos sin filtrar']);

    // Totales ingresos/egresos (en pesos argentinos)
    let totalIngresos = 0;
    let totalEgresos = 0;
    for (const m of resultado.data) {
      const monto = Number(m.monto);
      if (m.tipo === TipoMovimiento.INGRESO) totalIngresos += monto;
      else if (m.tipo === TipoMovimiento.EGRESO) totalEgresos += monto;
    }

    const logoPath = this.resolverLogoPath();

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    doc.pipe(out);

    const PRIMARY = '#4390B6';
    const TEXT = '#111827';
    const MUTED = '#6b7280';
    const anchoDoc = doc.page.width - 60; // dentro de los márgenes

    // ----- Header -----
    // Logo más chico (25pt) y más arriba (y=22) para que no se encime con la
    // línea separadora. El bloque de título va al costado.
    if (logoPath) {
      try {
        doc.image(logoPath, 30, 22, { width: 25 });
      } catch {
        // ignorar
      }
    }
    doc
      .fontSize(15)
      .fillColor(TEXT)
      .text('Movimientos de Billetera', 65, 24);
    doc
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(`Generado el ${new Date().toLocaleString('es-AR')}`, 65, 43);
    // Línea con más distancia del logo
    doc.moveTo(30, 60).lineTo(doc.page.width - 30, 60).strokeColor(PRIMARY).lineWidth(1).stroke();

    // ----- Filtros aplicados -----
    doc.fontSize(7.5).fillColor(MUTED).text('Filtros aplicados:', 30, 68);
    let filtroX = 110;
    const filtroY = 68;
    for (const [k, v] of filtrosLegibles) {
      const label = `${k}: `;
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(label, filtroX, filtroY, {
        continued: true,
      });
      doc.font('Helvetica-Bold').fillColor(TEXT).text(`${v}  `, { continued: true });
      filtroX = doc.x + 4;
      doc.font('Helvetica');
    }

    // ----- Tabla -----
    // Columnas con gap de 5pt entre ellas (w = ancho disponible - 5 para el
    // padding). Totales de ancho: sum ≈ 772 pt (cabe en A4 landscape = 842pt)
    const columnas = [
      { label: 'Fecha', x: 30, w: 50 },
      { label: 'Tipo', x: 85, w: 40 },
      { label: 'Caja', x: 130, w: 75 },
      { label: 'Monto', x: 210, w: 70, align: 'right' as const },
      { label: 'Obra(s)', x: 290, w: 120 },
      { label: 'Categoría', x: 420, w: 70 },
      { label: 'Prov./Origen', x: 500, w: 90 },
      { label: 'Descripción', x: 600, w: 160 },
      { label: 'Estado', x: 770, w: 50 },
    ];

    let y = 95;
    const ROW_HEIGHT = 14;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(PRIMARY);
    for (const c of columnas) {
      doc.text(c.label, c.x, y, { width: c.w, align: c.align ?? 'left', lineBreak: false });
    }
    y += 12;
    doc.moveTo(30, y).lineTo(doc.page.width - 30, y).strokeColor('#e5e7eb').lineWidth(0.4).stroke();
    y += 4;

    doc.font('Helvetica').fontSize(7).fillColor(TEXT);

    // Helper: trunca un string si excede el ancho visual aproximado.
    // Con fontSize=7, cada char ≈ 3.3pt. Ellipsis "…" al final.
    const truncar = (s: string, maxW: number): string => {
      const maxChars = Math.floor(maxW / 3.3);
      if (s.length <= maxChars) return s;
      return s.slice(0, maxChars - 1).trimEnd() + '…';
    };

    for (const mov of resultado.data) {
      // Salto de página si no entra
      if (y > doc.page.height - 80) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
        y = 30;
        // Re-render header de tabla
        doc.font('Helvetica-Bold').fontSize(8).fillColor(PRIMARY);
        for (const c of columnas) {
          doc.text(c.label, c.x, y, { width: c.w, align: c.align ?? 'left', lineBreak: false });
        }
        y += 12;
        doc
          .moveTo(30, y)
          .lineTo(doc.page.width - 30, y)
          .strokeColor('#e5e7eb')
          .lineWidth(0.4)
          .stroke();
        y += 4;
        doc.font('Helvetica').fontSize(7).fillColor(TEXT);
      }

      const obrasRaw = mov.imputaciones?.map((i) => i.obra.nombre).join(', ') ?? '';
      const color =
        mov.tipo === TipoMovimiento.INGRESO
          ? '#047857'
          : mov.tipo === TipoMovimiento.EGRESO
            ? '#b91c1c'
            : MUTED;

      const opts = { lineBreak: false };
      doc.fillColor(TEXT);
      doc.text(new Date(mov.fecha).toLocaleDateString('es-AR'), 30, y, { width: 50, ...opts });
      doc.fillColor(color).text(mov.tipo, 85, y, { width: 40, ...opts });
      doc.fillColor(TEXT).text(truncar(mov.caja.nombre, 75), 130, y, { width: 75, ...opts });
      doc.fillColor(color).text(formatearMonto(mov.monto.toString(), mov.moneda), 210, y, {
        width: 70,
        align: 'right',
        ...opts,
      });
      doc.fillColor(TEXT).text(truncar(obrasRaw || '—', 120), 290, y, { width: 120, ...opts });
      doc
        .fillColor(MUTED)
        .text(truncar(mov.categoria?.nombre ?? '—', 70), 420, y, { width: 70, ...opts });
      doc
        .fillColor(TEXT)
        .text(truncar(mov.beneficiario?.nombre ?? '—', 90), 500, y, { width: 90, ...opts });
      doc
        .fillColor(MUTED)
        .text(truncar(mov.descripcion ?? '—', 160), 600, y, { width: 160, ...opts });
      doc.fillColor(mov.estado === EstadoMovimiento.CONFIRMADO ? '#047857' : MUTED).text(
        mov.estado,
        770,
        y,
        { width: 50, lineBreak: false },
      );

      y += ROW_HEIGHT;
    }

    // ----- Totales -----
    if (y > doc.page.height - 100) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
      y = 30;
    }
    y += 10;
    doc.moveTo(30, y).lineTo(doc.page.width - 30, y).strokeColor(PRIMARY).lineWidth(0.8).stroke();
    y += 10;

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(MUTED)
      .text(`${resultado.data.length} movimiento(s)`, 30, y);

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#047857')
      .text(`INGRESOS: ${formatearMonto(totalIngresos.toString(), Moneda.ARS)}`, anchoDoc - 440, y, {
        width: 160,
        align: 'right',
      });
    doc
      .fillColor('#b91c1c')
      .text(`EGRESOS: ${formatearMonto(totalEgresos.toString(), Moneda.ARS)}`, anchoDoc - 280, y, {
        width: 150,
        align: 'right',
      });
    doc.fillColor(PRIMARY).text(
      `NETO: ${formatearMonto((totalIngresos - totalEgresos).toString(), Moneda.ARS)}`,
      anchoDoc - 130,
      y,
      { width: 160, align: 'right' },
    );

    doc.end();
  }

  private resolverLogoPath(): string | null {
    const candidatos = [
      path.resolve(process.cwd(), 'assets/brand/logo.png'),
      path.resolve(process.cwd(), '../assets/brand/logo.png'),
      path.resolve(__dirname, '../../../../../assets/brand/logo.png'),
    ];
    for (const p of candidatos) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  // ================= HELPERS =================

  private async resolverCotizacion(
    cotizacionExplicita?: number,
    tipoExplicito?: CotizacionTipo,
  ): Promise<{ cotizacion: number; cotizacionTipo: CotizacionTipo }> {
    if (cotizacionExplicita) {
      return {
        cotizacion: cotizacionExplicita,
        cotizacionTipo: tipoExplicito ?? CotizacionTipo.MANUAL,
      };
    }
    // Buscar en BD
    const ultima = await this.cotizaciones.ultimaCotizacion('BLUE');
    if (ultima) {
      return {
        cotizacion: Number(ultima.venta),
        cotizacionTipo: this.mapearTipoBlueAVenta(ultima.fuente),
      };
    }
    // Buscar en API
    try {
      const res = await this.cotizaciones.getBlueHoy();
      const c = res.cotizaciones[0];
      return {
        cotizacion: c.venta,
        cotizacionTipo: this.mapearTipoBlueAVenta(c.fuente),
      };
    } catch {
      throw new BadRequestException(
        'No se pudo obtener la cotización. Cargá una manualmente o reintenta más tarde.',
      );
    }
  }

  private mapearTipoBlueAVenta(fuente: FuenteCotizacion): CotizacionTipo {
    // En v1 todas las cotizaciones de referencia son blue venta.
    return fuente === FuenteCotizacion.MANUAL
      ? CotizacionTipo.MANUAL
      : CotizacionTipo.BLUE_VENTA;
  }

  private convertirMontos(
    monto: number,
    moneda: Moneda,
    cotizacion: number,
  ): { montoArs: string; montoUsd: string } {
    if (moneda === Moneda.ARS) {
      return {
        montoArs: monto.toFixed(2),
        montoUsd: arsAUsd(monto, cotizacion).toFixed(2),
      };
    }
    return {
      montoArs: usdAArs(monto, cotizacion).toFixed(2),
      montoUsd: monto.toFixed(2),
    };
  }

  private async validarObrasActivas(obraIds: string[]) {
    const unicas = [...new Set(obraIds)];
    const obras = await this.prisma.obra.findMany({ where: { id: { in: unicas } } });
    if (obras.length !== unicas.length) {
      throw new BadRequestException('Alguna obra no existe');
    }
    const inactivas = obras.filter((o) => !o.activo);
    if (inactivas.length > 0) {
      throw new BadRequestException(
        `Obras inactivas: ${inactivas.map((o) => o.nombre).join(', ')}`,
      );
    }
  }
}
