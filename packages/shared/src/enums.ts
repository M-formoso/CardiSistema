export const Moneda = {
  ARS: 'ARS',
  USD: 'USD',
} as const;
export type Moneda = (typeof Moneda)[keyof typeof Moneda];

export const RolUsuario = {
  ADMIN: 'ADMIN',
  CARGA: 'CARGA',
  CONSULTA: 'CONSULTA',
} as const;
export type RolUsuario = (typeof RolUsuario)[keyof typeof RolUsuario];

export const TipoObra = {
  OBRA: 'OBRA',
  UNIDAD_NEGOCIO: 'UNIDAD_NEGOCIO',
  GENERAL: 'GENERAL',
} as const;
export type TipoObra = (typeof TipoObra)[keyof typeof TipoObra];

export const EstadoObra = {
  EN_LICITACION: 'EN_LICITACION',
  ACTIVA: 'ACTIVA',
  PAUSADA: 'PAUSADA',
  TERMINADA: 'TERMINADA',
} as const;
export type EstadoObra = (typeof EstadoObra)[keyof typeof EstadoObra];

export const TipoBeneficiario = {
  EMPLEADO: 'EMPLEADO',
  CONTRATISTA: 'CONTRATISTA',
  PROVEEDOR: 'PROVEEDOR',
  PROFESIONAL: 'PROFESIONAL',
  OTRO: 'OTRO',
} as const;
export type TipoBeneficiario = (typeof TipoBeneficiario)[keyof typeof TipoBeneficiario];

export const TipoCaja = {
  EFECTIVO: 'EFECTIVO',
  BANCO: 'BANCO',
  CHEQUES_TERCEROS: 'CHEQUES_TERCEROS',
  OTRO: 'OTRO',
} as const;
export type TipoCaja = (typeof TipoCaja)[keyof typeof TipoCaja];

export const TipoMovimiento = {
  INGRESO: 'INGRESO',
  EGRESO: 'EGRESO',
  TRANSFERENCIA: 'TRANSFERENCIA',
  CAMBIO_MONEDA: 'CAMBIO_MONEDA',
  AJUSTE: 'AJUSTE',
} as const;
export type TipoMovimiento = (typeof TipoMovimiento)[keyof typeof TipoMovimiento];

export const MedioPago = {
  EFECTIVO: 'EFECTIVO',
  TRANSFERENCIA: 'TRANSFERENCIA',
  CHEQUE_PROPIO: 'CHEQUE_PROPIO',
  CHEQUE_TERCERO: 'CHEQUE_TERCERO',
} as const;
export type MedioPago = (typeof MedioPago)[keyof typeof MedioPago];

export const EstadoMovimiento = {
  CONFIRMADO: 'CONFIRMADO',
  ANULADO: 'ANULADO',
  REVERSA: 'REVERSA',
} as const;
export type EstadoMovimiento = (typeof EstadoMovimiento)[keyof typeof EstadoMovimiento];

export const OrigenMovimiento = {
  MANUAL: 'MANUAL',
  LIQUIDACION: 'LIQUIDACION',
  CERTIFICACION: 'CERTIFICACION',
  CUOTA: 'CUOTA',
  COMPROMISO: 'COMPROMISO',
  MIGRACION: 'MIGRACION',
} as const;
export type OrigenMovimiento = (typeof OrigenMovimiento)[keyof typeof OrigenMovimiento];

export const CotizacionTipo = {
  BLUE_COMPRA: 'BLUE_COMPRA',
  BLUE_VENTA: 'BLUE_VENTA',
  OFICIAL_COMPRA: 'OFICIAL_COMPRA',
  OFICIAL_VENTA: 'OFICIAL_VENTA',
  MANUAL: 'MANUAL',
  PLANILLA: 'PLANILLA',
} as const;
export type CotizacionTipo = (typeof CotizacionTipo)[keyof typeof CotizacionTipo];

export const FuenteCotizacion = {
  DOLARAPI: 'DOLARAPI',
  AMBITO: 'AMBITO',
  ARGENTINADATOS: 'ARGENTINADATOS',
  MANUAL: 'MANUAL',
} as const;
export type FuenteCotizacion = (typeof FuenteCotizacion)[keyof typeof FuenteCotizacion];

export const EstadoCheque = {
  EN_CARTERA: 'EN_CARTERA',
  ENTREGADO: 'ENTREGADO',
  DEPOSITADO: 'DEPOSITADO',
  COBRADO: 'COBRADO',
  EMITIDO: 'EMITIDO',
  DEBITADO: 'DEBITADO',
  RECHAZADO: 'RECHAZADO',
  ANULADO: 'ANULADO',
} as const;
export type EstadoCheque = (typeof EstadoCheque)[keyof typeof EstadoCheque];

export const TipoCheque = {
  PROPIO: 'PROPIO',
  TERCERO: 'TERCERO',
} as const;
export type TipoCheque = (typeof TipoCheque)[keyof typeof TipoCheque];
