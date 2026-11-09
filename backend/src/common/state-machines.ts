import { BadRequestException } from '@nestjs/common';
import {
  EstadoCertificacion,
  EstadoCheque,
  EstadoCompromiso,
  EstadoCuota,
  EstadoLiquidacion,
  EstadoMovimiento,
} from '@prisma/client';

/**
 * Máquinas de estado del Sistema Cardi.
 * Centraliza las transiciones válidas para no repetir lógica en services.
 * Patrón tomado de Cocoguana (src/common/state-machines.ts).
 */

type Transitions<T extends string> = { [K in T]: readonly T[] };

// Cheque — propio y de tercero comparten (los estados no válidos para un tipo
// se filtran en el controller/service con un chequeo específico).
const chequeTransitions: Transitions<EstadoCheque> = {
  EN_CARTERA: ['ENTREGADO', 'DEPOSITADO', 'ANULADO'],
  ENTREGADO: ['COBRADO', 'RECHAZADO', 'ANULADO'],
  DEPOSITADO: ['COBRADO', 'RECHAZADO', 'ANULADO'],
  EMITIDO: ['DEBITADO', 'RECHAZADO', 'ANULADO'],
  // Estados terminales
  COBRADO: [],
  DEBITADO: [],
  RECHAZADO: [],
  ANULADO: [],
};

// Movimiento — CONFIRMADO → ANULADO (vía reversa). REVERSA es terminal.
const movimientoTransitions: Transitions<EstadoMovimiento> = {
  CONFIRMADO: ['ANULADO'],
  ANULADO: [],
  REVERSA: [],
};

// Liquidación semanal
const liquidacionTransitions: Transitions<EstadoLiquidacion> = {
  BORRADOR: ['APROBADA'],
  APROBADA: ['PAGADA', 'BORRADOR'],
  PAGADA: ['CERRADA'],
  CERRADA: [],
};

const certificacionTransitions: Transitions<EstadoCertificacion> = {
  PENDIENTE: ['PARCIAL', 'PAGADA', 'ANULADA'],
  PARCIAL: ['PAGADA', 'ANULADA'],
  PAGADA: ['ANULADA'],
  ANULADA: [],
};

const cuotaTransitions: Transitions<EstadoCuota> = {
  PENDIENTE: ['PAGADA', 'ANULADA'],
  PAGADA: ['ANULADA'],
  ANULADA: [],
};

const compromisoTransitions: Transitions<EstadoCompromiso> = {
  PENDIENTE: ['PAGADO', 'OMITIDO'],
  PAGADO: [],
  OMITIDO: [],
};

export type EntidadConEstados =
  | 'Cheque'
  | 'Movimiento'
  | 'LiquidacionSemanal'
  | 'Certificacion'
  | 'Cuota'
  | 'CompromisoPago';

const registry: Record<EntidadConEstados, Transitions<string>> = {
  Cheque: chequeTransitions as Transitions<string>,
  Movimiento: movimientoTransitions as Transitions<string>,
  LiquidacionSemanal: liquidacionTransitions as Transitions<string>,
  Certificacion: certificacionTransitions as Transitions<string>,
  Cuota: cuotaTransitions as Transitions<string>,
  CompromisoPago: compromisoTransitions as Transitions<string>,
};

/**
 * Valida que `from → to` sea una transición permitida.
 * Tira BadRequestException si no lo es.
 */
export function assertTransition(entidad: EntidadConEstados, from: string, to: string): void {
  if (from === to) return;
  const machine = registry[entidad];
  const allowed = machine[from];
  if (!allowed) {
    throw new BadRequestException(`Estado desconocido para ${entidad}: "${from}"`);
  }
  if (!allowed.includes(to)) {
    const opciones = allowed.length > 0 ? allowed.join(', ') : '<terminal>';
    throw new BadRequestException(
      `Transición inválida en ${entidad}: ${from} → ${to}. Salidas válidas desde ${from}: ${opciones}`,
    );
  }
}

export function allowedTransitions(entidad: EntidadConEstados, from: string): string[] {
  const allowed = registry[entidad][from];
  return allowed ? [...allowed] : [];
}

export function isTerminal(entidad: EntidadConEstados, state: string): boolean {
  const allowed = registry[entidad][state];
  return !!allowed && allowed.length === 0;
}
