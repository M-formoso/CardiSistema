import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoMovimiento,
  Prisma,
  TipoBeneficiario,
  TipoMovimiento,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type {
  CrearResumenDto,
  FiltrosProveedoresDto,
} from './dto/proveedores.dto';

/**
 * Proveedores + cuenta corriente.
 *
 * Los proveedores son Beneficiarios con tipo = PROVEEDOR (ya existente).
 * Los pagos a proveedor son Movimientos EGRESO con beneficiarioId = proveedor
 * e imputaciones por obra — se usa el endpoint /movimientos/egresos existente,
 * no se crea un modelo ProveedorPago separado.
 *
 * Lo único nuevo son los "resúmenes" que carga el cliente cada tanto (foto
 * del estado de cuenta a una fecha), y el cálculo del saldo:
 *
 *   saldoTotal   = (último resumen).montoTotal − Σ pagos CONFIRMADOS posteriores
 *   saldoObra[o] = (último resumen).items[o].monto − Σ imputaciones por obra posteriores
 *
 * Si no hay resumen todavía, saldo = −Σ pagos (negativo informativo).
 */
@Injectable()
export class ProveedoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditoriaService,
  ) {}

  // ================== LISTA DE PROVEEDORES ==================

  async findAll(filtros: FiltrosProveedoresDto) {
    const where: Prisma.BeneficiarioWhereInput = { tipo: TipoBeneficiario.PROVEEDOR };
    if (filtros.activo !== undefined) where.activo = filtros.activo;
    if (filtros.q) {
      where.OR = [
        { nombre: { contains: filtros.q, mode: 'insensitive' } },
        { cuitCuil: { contains: filtros.q, mode: 'insensitive' } },
      ];
    }

    const proveedores = await this.prisma.beneficiario.findMany({
      where,
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        cuitCuil: true,
        contacto: true,
        condicionPago: true,
        activo: true,
      },
    });
    if (proveedores.length === 0) return [];

    const ids = proveedores.map((p) => p.id);

    // Último resumen por proveedor (fecha más reciente)
    const ultimosResumenes = await this.prisma.proveedorResumen.findMany({
      where: { proveedorId: { in: ids } },
      orderBy: [{ proveedorId: 'asc' }, { fecha: 'desc' }],
    });
    const ultimoPorProveedor = new Map<string, (typeof ultimosResumenes)[number]>();
    for (const r of ultimosResumenes) {
      if (!ultimoPorProveedor.has(r.proveedorId)) ultimoPorProveedor.set(r.proveedorId, r);
    }

    // Pagos agrupados (monto total y conteo) por proveedor, filtrando por la
    // fecha del último resumen de cada uno. Hacemos un fetch simple y
    // agrupamos en JS — para la lista no justifica un query raw complejo.
    const pagos = await this.prisma.movimiento.findMany({
      where: {
        tipo: TipoMovimiento.EGRESO,
        estado: EstadoMovimiento.CONFIRMADO,
        beneficiarioId: { in: ids },
      },
      select: { beneficiarioId: true, monto: true, fecha: true },
    });

    return proveedores.map((p) => {
      const ultimoResumen = ultimoPorProveedor.get(p.id) ?? null;
      const corte = ultimoResumen?.fecha ?? null;
      const pagosProv = pagos.filter((pg) => pg.beneficiarioId === p.id);
      const pagosDesdeCorte = corte
        ? pagosProv.filter((pg) => pg.fecha.getTime() >= corte.getTime())
        : pagosProv;
      const sumaPagosPosteriores = pagosDesdeCorte.reduce(
        (acc, pg) => acc + Number(pg.monto),
        0,
      );
      // Sin resumen: saldo NO se puede calcular (el proveedor puede deber 1M
      // y haber pagado 100; mostrar "-100" confunde). Lo marcamos como 0 y
      // el frontend muestra el banner "Sin resumen cargado". Con resumen,
      // saldoTotal = montoTotal del resumen - pagos posteriores.
      const saldoTotal = ultimoResumen
        ? Number(ultimoResumen.montoTotal) - sumaPagosPosteriores
        : 0;
      return {
        ...p,
        ultimoResumenFecha: ultimoResumen?.fecha ?? null,
        ultimoResumenMonto: ultimoResumen ? ultimoResumen.montoTotal.toString() : null,
        saldoTotal: saldoTotal.toFixed(2),
        cantidadPagos: pagosProv.length,
      };
    });
  }

  // ================== DETALLE ==================

  async findOne(id: string) {
    const proveedor = await this.prisma.beneficiario.findUnique({
      where: { id },
      select: {
        id: true,
        tipo: true,
        nombre: true,
        cuitCuil: true,
        rubro: true,
        contacto: true,
        condicionPago: true,
        observaciones: true,
        activo: true,
      },
    });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');
    if (proveedor.tipo !== TipoBeneficiario.PROVEEDOR) {
      throw new BadRequestException('El beneficiario no es un proveedor');
    }

    // Todos los resúmenes (histórico), más reciente primero
    const resumenes = await this.prisma.proveedorResumen.findMany({
      where: { proveedorId: id },
      orderBy: { fecha: 'desc' },
      include: {
        items: { include: { obra: { select: { id: true, nombre: true } } } },
      },
    });
    const ultimo = resumenes[0] ?? null;

    // Pagos del proveedor (EGRESOS confirmados) con sus imputaciones
    const pagos = await this.prisma.movimiento.findMany({
      where: {
        tipo: TipoMovimiento.EGRESO,
        estado: EstadoMovimiento.CONFIRMADO,
        beneficiarioId: id,
      },
      orderBy: { fecha: 'desc' },
      include: {
        caja: { select: { nombre: true, moneda: true } },
        imputaciones: { include: { obra: { select: { id: true, nombre: true } } } },
        cheque: { select: { numero: true, banco: true, estado: true } },
      },
      take: 200,
    });

    // Cálculo del saldo actual total y por obra:
    const corte = ultimo?.fecha ?? null;
    const pagosDesdeCorte = corte
      ? pagos.filter((pg) => pg.fecha.getTime() >= corte.getTime())
      : pagos;
    const sumaPagosPosteriores = pagosDesdeCorte.reduce(
      (acc, pg) => acc + Number(pg.monto),
      0,
    );
    // Sin resumen: no se puede calcular el saldo real (ver nota en findAll).
    const saldoTotal = ultimo
      ? Number(ultimo.montoTotal) - sumaPagosPosteriores
      : 0;

    // Saldos por obra: parto del último resumen y resto imputaciones posteriores
    const saldosPorObraMap = new Map<string, { obraId: string; nombre: string; resumen: number; pagado: number }>();
    if (ultimo) {
      for (const item of ultimo.items) {
        saldosPorObraMap.set(item.obraId, {
          obraId: item.obraId,
          nombre: item.obra.nombre,
          resumen: Number(item.monto),
          pagado: 0,
        });
      }
    }
    for (const pg of pagosDesdeCorte) {
      for (const imp of pg.imputaciones) {
        const existente = saldosPorObraMap.get(imp.obraId);
        if (existente) {
          existente.pagado += Number(imp.monto);
        } else {
          // Pago a obra que no aparece en el resumen → aparece con saldo negativo
          saldosPorObraMap.set(imp.obraId, {
            obraId: imp.obraId,
            nombre: imp.obra.nombre,
            resumen: 0,
            pagado: Number(imp.monto),
          });
        }
      }
    }
    const saldosPorObra = Array.from(saldosPorObraMap.values())
      .map((s) => ({
        obraId: s.obraId,
        nombre: s.nombre,
        montoResumen: s.resumen.toFixed(2),
        pagado: s.pagado.toFixed(2),
        saldo: (s.resumen - s.pagado).toFixed(2),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    return {
      proveedor,
      saldoTotal: saldoTotal.toFixed(2),
      ultimoResumen: ultimo
        ? {
            id: ultimo.id,
            fecha: ultimo.fecha,
            montoTotal: ultimo.montoTotal.toString(),
            observaciones: ultimo.observaciones,
          }
        : null,
      saldosPorObra,
      pagos: pagos.map((pg) => ({
        id: pg.id,
        fecha: pg.fecha,
        monto: pg.monto.toString(),
        moneda: pg.moneda,
        medioPago: pg.medioPago,
        descripcion: pg.descripcion,
        caja: pg.caja,
        imputaciones: pg.imputaciones.map((imp) => ({
          obraId: imp.obraId,
          obraNombre: imp.obra.nombre,
          monto: imp.monto.toString(),
        })),
        cheque: pg.cheque,
      })),
      resumenesHistoricos: resumenes.map((r) => ({
        id: r.id,
        fecha: r.fecha,
        montoTotal: r.montoTotal.toString(),
        observaciones: r.observaciones,
        items: r.items.map((it) => ({
          obraId: it.obraId,
          obraNombre: it.obra.nombre,
          monto: it.monto.toString(),
        })),
      })),
    };
  }

  // ================== CARGAR RESUMEN ==================

  async crearResumen(proveedorId: string, dto: CrearResumenDto, userId: string) {
    const proveedor = await this.prisma.beneficiario.findUnique({
      where: { id: proveedorId },
      select: { tipo: true, nombre: true },
    });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');
    if (proveedor.tipo !== TipoBeneficiario.PROVEEDOR) {
      throw new BadRequestException('El beneficiario no es un proveedor');
    }

    // Validar que las obras existan (y no estén repetidas en el payload)
    const obraIds = dto.items.map((i) => i.obraId);
    const idsUnicos = [...new Set(obraIds)];
    if (idsUnicos.length !== obraIds.length) {
      throw new BadRequestException('Hay obras repetidas en el resumen');
    }
    const obras = await this.prisma.obra.findMany({
      where: { id: { in: idsUnicos } },
      select: { id: true },
    });
    if (obras.length !== idsUnicos.length) {
      throw new BadRequestException('Alguna obra no existe');
    }

    // Validar que no haya ya un resumen con esta fecha para este proveedor
    const yaExiste = await this.prisma.proveedorResumen.findUnique({
      where: { proveedorId_fecha: { proveedorId, fecha: dto.fecha } },
    });
    if (yaExiste) {
      throw new BadRequestException(
        'Ya existe un resumen para este proveedor en esa fecha. Eliminalo primero si querés rehacerlo.',
      );
    }

    const montoTotal = dto.items.reduce((acc, i) => acc + i.monto, 0);

    const creado = await this.prisma.proveedorResumen.create({
      data: {
        proveedorId,
        fecha: dto.fecha,
        montoTotal: new Prisma.Decimal(montoTotal.toFixed(2)),
        observaciones: dto.observaciones,
        createdById: userId,
        updatedById: userId,
        items: {
          create: dto.items.map((i) => ({
            obraId: i.obraId,
            monto: new Prisma.Decimal(i.monto.toFixed(2)),
          })),
        },
      },
      include: { items: true },
    });

    void this.audit.registrar({
      usuarioId: userId,
      accion: 'CREAR',
      entidad: 'ProveedorResumen',
      entidadId: creado.id,
      observacion: `Resumen de ${proveedor.nombre} al ${dto.fecha.toISOString().slice(0, 10)} · $${montoTotal.toFixed(2)}`,
    });
    return creado;
  }

  // ================== ELIMINAR RESUMEN ==================

  async eliminarResumen(proveedorId: string, resumenId: string, userId: string) {
    const resumen = await this.prisma.proveedorResumen.findUnique({
      where: { id: resumenId },
    });
    if (!resumen || resumen.proveedorId !== proveedorId) {
      throw new NotFoundException('Resumen no encontrado para este proveedor');
    }
    await this.prisma.proveedorResumen.delete({ where: { id: resumenId } });
    void this.audit.registrar({
      usuarioId: userId,
      accion: 'ANULAR',
      entidad: 'ProveedorResumen',
      entidadId: resumenId,
      observacion: `Resumen al ${resumen.fecha.toISOString().slice(0, 10)}`,
    });
    return { ok: true };
  }
}
