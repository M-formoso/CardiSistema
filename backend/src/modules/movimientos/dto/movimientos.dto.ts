import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { CotizacionTipo, EstadoMovimiento, MedioPago, OrigenMovimiento } from '@prisma/client';

const ImputacionInputSchema = z
  .object({
    obraId: z.string().uuid(),
    monto: z.coerce.number().positive().optional(),
    porcentaje: z.coerce.number().min(0).max(100).optional(),
  })
  .refine((v) => v.monto != null || v.porcentaje != null, {
    message: 'Cada imputación debe tener monto o porcentaje',
  });

export const CrearEgresoSchema = z.object({
  fecha: z.coerce.date(),
  cajaId: z.string().uuid(),
  monto: z.coerce.number().positive(),
  medioPago: z.nativeEnum(MedioPago),
  beneficiarioId: z.string().uuid().optional(),
  categoriaId: z.string().uuid().optional(),
  descripcion: z.string().max(1000).optional(),
  chequeId: z.string().uuid().optional(),
  // Cotización (si no se pasa, se resuelve server-side desde la última histórica)
  cotizacion: z.coerce.number().positive().optional(),
  cotizacionTipo: z.nativeEnum(CotizacionTipo).optional(),
  // Imputación: al menos una línea. Si solo hay una, suma el total exacto.
  imputaciones: z.array(ImputacionInputSchema).min(1),
});
export class CrearEgresoDto extends createZodDto(CrearEgresoSchema) {}

export const CrearIngresoSchema = z.object({
  fecha: z.coerce.date(),
  cajaId: z.string().uuid(),
  monto: z.coerce.number().positive(),
  medioPago: z.nativeEnum(MedioPago),
  beneficiarioId: z.string().uuid().optional(),
  categoriaId: z.string().uuid().optional(),
  descripcion: z.string().max(1000).optional(),
  obraIngresoId: z.string().uuid().optional(), // futuro etapa 2+
  cotizacion: z.coerce.number().positive().optional(),
  cotizacionTipo: z.nativeEnum(CotizacionTipo).optional(),
});
export class CrearIngresoDto extends createZodDto(CrearIngresoSchema) {}

export const TransferirSchema = z
  .object({
    fecha: z.coerce.date(),
    cajaOrigenId: z.string().uuid(),
    cajaDestinoId: z.string().uuid(),
    monto: z.coerce.number().positive(),
    descripcion: z.string().max(1000).optional(),
  })
  .refine((v) => v.cajaOrigenId !== v.cajaDestinoId, {
    message: 'Origen y destino deben ser cajas distintas',
  });
export class TransferirDto extends createZodDto(TransferirSchema) {}

export const CambioMonedaSchema = z
  .object({
    fecha: z.coerce.date(),
    cajaOrigenId: z.string().uuid(),
    cajaDestinoId: z.string().uuid(),
    montoOrigen: z.coerce.number().positive(),
    montoDestino: z.coerce.number().positive(),
    cotizacion: z.coerce.number().positive(),
    cotizacionTipo: z.nativeEnum(CotizacionTipo).default('MANUAL'),
    descripcion: z.string().max(1000).optional(),
  })
  .refine((v) => v.cajaOrigenId !== v.cajaDestinoId, {
    message: 'Origen y destino deben ser cajas distintas',
  });
export class CambioMonedaDto extends createZodDto(CambioMonedaSchema) {}

export const AnularMovimientoSchema = z.object({
  motivo: z.string().min(3).max(500),
});
export class AnularMovimientoDto extends createZodDto(AnularMovimientoSchema) {}

export const FiltrosMovimientoSchema = z.object({
  cajaId: z.string().uuid().optional(),
  tipo: z.enum(['INGRESO', 'EGRESO', 'TRANSFERENCIA', 'CAMBIO_MONEDA', 'AJUSTE']).optional(),
  beneficiarioId: z.string().uuid().optional(),
  categoriaId: z.string().uuid().optional(),
  obraId: z.string().uuid().optional(),
  estado: z.nativeEnum(EstadoMovimiento).optional(),
  origen: z.nativeEnum(OrigenMovimiento).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export class FiltrosMovimientoDto extends createZodDto(FiltrosMovimientoSchema) {}
