-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'CARGA', 'CONSULTA');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "TipoObra" AS ENUM ('OBRA', 'UNIDAD_NEGOCIO', 'GENERAL');

-- CreateEnum
CREATE TYPE "EstadoObra" AS ENUM ('EN_LICITACION', 'ACTIVA', 'PAUSADA', 'TERMINADA');

-- CreateEnum
CREATE TYPE "TipoBeneficiario" AS ENUM ('EMPLEADO', 'CONTRATISTA', 'PROVEEDOR', 'PROFESIONAL', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoCaja" AS ENUM ('EFECTIVO', 'BANCO', 'CHEQUES_TERCEROS', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'EGRESO', 'TRANSFERENCIA', 'CAMBIO_MONEDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE_PROPIO', 'CHEQUE_TERCERO');

-- CreateEnum
CREATE TYPE "EstadoMovimiento" AS ENUM ('CONFIRMADO', 'ANULADO', 'REVERSA');

-- CreateEnum
CREATE TYPE "OrigenMovimiento" AS ENUM ('MANUAL', 'LIQUIDACION', 'CERTIFICACION', 'CUOTA', 'COMPROMISO', 'MIGRACION');

-- CreateEnum
CREATE TYPE "CotizacionTipoBlue" AS ENUM ('BLUE', 'OFICIAL');

-- CreateEnum
CREATE TYPE "CotizacionTipo" AS ENUM ('BLUE_COMPRA', 'BLUE_VENTA', 'OFICIAL_COMPRA', 'OFICIAL_VENTA', 'MANUAL', 'PLANILLA');

-- CreateEnum
CREATE TYPE "FuenteCotizacion" AS ENUM ('DOLARAPI', 'AMBITO', 'ARGENTINADATOS', 'MANUAL');

-- CreateEnum
CREATE TYPE "TipoCheque" AS ENUM ('PROPIO', 'TERCERO');

-- CreateEnum
CREATE TYPE "EstadoCheque" AS ENUM ('EN_CARTERA', 'ENTREGADO', 'DEPOSITADO', 'COBRADO', 'EMITIDO', 'DEBITADO', 'RECHAZADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoLiquidacion" AS ENUM ('BORRADOR', 'APROBADA', 'PAGADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "EstadoCertificacion" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoCuota" AS ENUM ('PENDIENTE', 'PAGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoCompromiso" AS ENUM ('PENDIENTE', 'PAGADO', 'OMITIDO');

-- CreateEnum
CREATE TYPE "EstadoMigracionLote" AS ENUM ('IMPORTANDO', 'IMPORTADO', 'OBSERVADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoMigracionFila" AS ENUM ('PENDIENTE', 'MAPEADA', 'OBSERVADA', 'DUPLICADA', 'IMPORTADA', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "AuditAccion" AS ENUM ('CREAR', 'ACTUALIZAR', 'ANULAR', 'REVERTIR', 'EXPORTAR', 'LOGIN', 'LOGOUT', 'OTRO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioPermiso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "concedido" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioPermiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revocado" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" "AuditAccion" NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "antes" JSONB,
    "despues" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionEmpresa" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreFantasia" TEXT,
    "cuit" TEXT NOT NULL,
    "domicilio" TEXT,
    "localidad" TEXT,
    "provincia" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "logoPath" TEXT,
    "cotizacionTipoDefault" "CotizacionTipo" NOT NULL DEFAULT 'BLUE_VENTA',
    "diaPagoSemanal" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoObra" NOT NULL,
    "comitente" TEXT,
    "constructora" TEXT,
    "ubicacion" TEXT,
    "fechaInicio" DATE,
    "estado" "EstadoObra" NOT NULL DEFAULT 'ACTIVA',
    "montoContratado" DECIMAL(14,2),
    "monedaContrato" "Moneda",
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiario" (
    "id" TEXT NOT NULL,
    "tipo" "TipoBeneficiario" NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuitCuil" TEXT,
    "rubro" TEXT,
    "contacto" TEXT,
    "condicionPago" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beneficiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpleadoLegajo" (
    "id" TEXT NOT NULL,
    "beneficiarioId" TEXT NOT NULL,
    "fechaIngreso" DATE NOT NULL,
    "jornal" DECIMAL(14,2),
    "montoSemanal" DECIMAL(14,2),
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "obraActualId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpleadoLegajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeneficiarioAlias" (
    "id" TEXT NOT NULL,
    "beneficiarioId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeneficiarioAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaGasto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoriaGasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptoAlias" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptoAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caja" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCaja" NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "saldoInicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fechaSaldoInicial" DATE NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionDolar" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "CotizacionTipoBlue" NOT NULL,
    "compra" DECIMAL(14,4) NOT NULL,
    "venta" DECIMAL(14,4) NOT NULL,
    "fuente" "FuenteCotizacion" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CotizacionDolar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "fecha" DATE NOT NULL,
    "cajaId" TEXT NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "medioPago" "MedioPago" NOT NULL,
    "descripcion" TEXT,
    "cotizacion" DECIMAL(14,4) NOT NULL,
    "cotizacionTipo" "CotizacionTipo" NOT NULL,
    "montoArs" DECIMAL(14,2) NOT NULL,
    "montoUsd" DECIMAL(14,2) NOT NULL,
    "beneficiarioId" TEXT,
    "categoriaId" TEXT,
    "obraIngresoId" TEXT,
    "chequeId" TEXT,
    "reciboId" TEXT,
    "grupoId" TEXT,
    "origen" "OrigenMovimiento" NOT NULL DEFAULT 'MANUAL',
    "origenId" TEXT,
    "estado" "EstadoMovimiento" NOT NULL DEFAULT 'CONFIRMADO',
    "anuladoAt" TIMESTAMP(3),
    "anuladoPorId" TEXT,
    "motivoAnulacion" TEXT,
    "movimientoOriginalId" TEXT,
    "migracionFilaId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Imputacion" (
    "id" TEXT NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "porcentaje" DECIMAL(7,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Imputacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cheque" (
    "id" TEXT NOT NULL,
    "tipo" "TipoCheque" NOT NULL,
    "numero" TEXT NOT NULL,
    "banco" TEXT,
    "sucursal" TEXT,
    "librador" TEXT,
    "titular" TEXT,
    "cuit" TEXT,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "fechaEmision" DATE NOT NULL,
    "fechaPago" DATE NOT NULL,
    "estado" "EstadoCheque" NOT NULL DEFAULT 'EN_CARTERA',
    "beneficiarioId" TEXT,
    "observaciones" TEXT,
    "imagenesPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidacionSemanal" (
    "id" TEXT NOT NULL,
    "semanaInicio" DATE NOT NULL,
    "semanaFin" DATE NOT NULL,
    "estado" "EstadoLiquidacion" NOT NULL DEFAULT 'BORRADOR',
    "totalBruto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalDescuentos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalPagado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "cerradaAt" TIMESTAMP(3),
    "cerradaPorId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiquidacionSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidacionItem" (
    "id" TEXT NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "beneficiarioId" TEXT,
    "nombreLibre" TEXT NOT NULL,
    "diasTrabajados" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "valorDia" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "descuentos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "aPagar" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "fechaPago" DATE,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiquidacionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidacionDia" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "dias" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "obraId" TEXT NOT NULL,
    "etiqueta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquidacionDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vacacion" (
    "id" TEXT NOT NULL,
    "beneficiarioId" TEXT NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "dias" INTEGER NOT NULL,
    "fechaPago" DATE,
    "movimientoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vacacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificacion" (
    "id" TEXT NOT NULL,
    "beneficiarioId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "numero" TEXT,
    "fecha" DATE NOT NULL,
    "descripcion" TEXT,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "porcentajeAvance" DECIMAL(7,4),
    "adjuntoPath" TEXT,
    "estado" "EstadoCertificacion" NOT NULL DEFAULT 'PENDIENTE',
    "saldoPendiente" DECIMAL(14,2) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratoCuota" (
    "id" TEXT NOT NULL,
    "beneficiarioId" TEXT NOT NULL,
    "obraId" TEXT,
    "concepto" TEXT NOT NULL,
    "montoTotal" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "cantidadCuotas" INTEGER NOT NULL,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContratoCuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuota" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "vencimiento" DATE NOT NULL,
    "estado" "EstadoCuota" NOT NULL DEFAULT 'PENDIENTE',
    "movimientoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VencimientoRecurrente" (
    "id" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "obraId" TEXT,
    "categoriaId" TEXT,
    "beneficiarioId" TEXT,
    "diaDelMes" INTEGER NOT NULL,
    "montoEstimado" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "cajaHabitualId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VencimientoRecurrente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompromisoPago" (
    "id" TEXT NOT NULL,
    "vencimientoId" TEXT,
    "fecha" DATE NOT NULL,
    "concepto" TEXT NOT NULL,
    "obraId" TEXT,
    "beneficiarioId" TEXT,
    "montoEstimado" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "estado" "EstadoCompromiso" NOT NULL DEFAULT 'PENDIENTE',
    "movimientoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompromisoPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recibo" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "beneficiarioId" TEXT,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "concepto" TEXT NOT NULL,
    "pdfPath" TEXT,
    "generadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recibo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigracionLote" (
    "id" TEXT NOT NULL,
    "archivo" TEXT NOT NULL,
    "hoja" TEXT,
    "descripcion" TEXT,
    "estado" "EstadoMigracionLote" NOT NULL DEFAULT 'IMPORTANDO',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigracionLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigracionFila" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "fila" INTEGER NOT NULL,
    "datos" JSONB NOT NULL,
    "estado" "EstadoMigracionFila" NOT NULL DEFAULT 'PENDIENTE',
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigracionFila_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- CreateIndex
CREATE INDEX "Usuario_activo_idx" ON "Usuario"("activo");

-- CreateIndex
CREATE INDEX "UsuarioPermiso_usuarioId_idx" ON "UsuarioPermiso"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioPermiso_usuarioId_recurso_accion_key" ON "UsuarioPermiso"("usuarioId", "recurso", "accion");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_usuarioId_idx" ON "RefreshToken"("usuarioId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_entidad_entidadId_idx" ON "AuditLog"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "AuditLog_usuarioId_createdAt_idx" ON "AuditLog"("usuarioId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_accion_createdAt_idx" ON "AuditLog"("accion", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Obra_nombre_key" ON "Obra"("nombre");

-- CreateIndex
CREATE INDEX "Obra_tipo_estado_idx" ON "Obra"("tipo", "estado");

-- CreateIndex
CREATE INDEX "Obra_activo_idx" ON "Obra"("activo");

-- CreateIndex
CREATE INDEX "Beneficiario_tipo_idx" ON "Beneficiario"("tipo");

-- CreateIndex
CREATE INDEX "Beneficiario_activo_idx" ON "Beneficiario"("activo");

-- CreateIndex
CREATE INDEX "Beneficiario_nombre_idx" ON "Beneficiario"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "EmpleadoLegajo_beneficiarioId_key" ON "EmpleadoLegajo"("beneficiarioId");

-- CreateIndex
CREATE INDEX "BeneficiarioAlias_beneficiarioId_idx" ON "BeneficiarioAlias"("beneficiarioId");

-- CreateIndex
CREATE UNIQUE INDEX "BeneficiarioAlias_alias_key" ON "BeneficiarioAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaGasto_codigo_key" ON "CategoriaGasto"("codigo");

-- CreateIndex
CREATE INDEX "CategoriaGasto_activo_idx" ON "CategoriaGasto"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptoAlias_texto_key" ON "ConceptoAlias"("texto");

-- CreateIndex
CREATE INDEX "ConceptoAlias_categoriaId_idx" ON "ConceptoAlias"("categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Caja_nombre_key" ON "Caja"("nombre");

-- CreateIndex
CREATE INDEX "Caja_activo_idx" ON "Caja"("activo");

-- CreateIndex
CREATE INDEX "Caja_tipo_idx" ON "Caja"("tipo");

-- CreateIndex
CREATE INDEX "CotizacionDolar_fecha_idx" ON "CotizacionDolar"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "CotizacionDolar_fecha_tipo_fuente_key" ON "CotizacionDolar"("fecha", "tipo", "fuente");

-- CreateIndex
CREATE INDEX "Movimiento_fecha_idx" ON "Movimiento"("fecha");

-- CreateIndex
CREATE INDEX "Movimiento_cajaId_fecha_idx" ON "Movimiento"("cajaId", "fecha");

-- CreateIndex
CREATE INDEX "Movimiento_estado_idx" ON "Movimiento"("estado");

-- CreateIndex
CREATE INDEX "Movimiento_tipo_estado_idx" ON "Movimiento"("tipo", "estado");

-- CreateIndex
CREATE INDEX "Movimiento_beneficiarioId_idx" ON "Movimiento"("beneficiarioId");

-- CreateIndex
CREATE INDEX "Movimiento_categoriaId_idx" ON "Movimiento"("categoriaId");

-- CreateIndex
CREATE INDEX "Movimiento_grupoId_idx" ON "Movimiento"("grupoId");

-- CreateIndex
CREATE INDEX "Movimiento_origen_origenId_idx" ON "Movimiento"("origen", "origenId");

-- CreateIndex
CREATE INDEX "Imputacion_obraId_idx" ON "Imputacion"("obraId");

-- CreateIndex
CREATE UNIQUE INDEX "Imputacion_movimientoId_obraId_key" ON "Imputacion"("movimientoId", "obraId");

-- CreateIndex
CREATE INDEX "Cheque_estado_idx" ON "Cheque"("estado");

-- CreateIndex
CREATE INDEX "Cheque_fechaPago_idx" ON "Cheque"("fechaPago");

-- CreateIndex
CREATE INDEX "Cheque_beneficiarioId_idx" ON "Cheque"("beneficiarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Cheque_tipo_numero_banco_key" ON "Cheque"("tipo", "numero", "banco");

-- CreateIndex
CREATE INDEX "LiquidacionSemanal_estado_idx" ON "LiquidacionSemanal"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "LiquidacionSemanal_semanaInicio_semanaFin_key" ON "LiquidacionSemanal"("semanaInicio", "semanaFin");

-- CreateIndex
CREATE INDEX "LiquidacionItem_liquidacionId_idx" ON "LiquidacionItem"("liquidacionId");

-- CreateIndex
CREATE INDEX "LiquidacionItem_beneficiarioId_idx" ON "LiquidacionItem"("beneficiarioId");

-- CreateIndex
CREATE INDEX "LiquidacionDia_obraId_fecha_idx" ON "LiquidacionDia"("obraId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "LiquidacionDia_itemId_fecha_key" ON "LiquidacionDia"("itemId", "fecha");

-- CreateIndex
CREATE INDEX "Vacacion_beneficiarioId_idx" ON "Vacacion"("beneficiarioId");

-- CreateIndex
CREATE INDEX "Certificacion_obraId_idx" ON "Certificacion"("obraId");

-- CreateIndex
CREATE INDEX "Certificacion_beneficiarioId_idx" ON "Certificacion"("beneficiarioId");

-- CreateIndex
CREATE INDEX "Certificacion_estado_idx" ON "Certificacion"("estado");

-- CreateIndex
CREATE INDEX "ContratoCuota_beneficiarioId_idx" ON "ContratoCuota"("beneficiarioId");

-- CreateIndex
CREATE INDEX "ContratoCuota_obraId_idx" ON "ContratoCuota"("obraId");

-- CreateIndex
CREATE INDEX "Cuota_estado_idx" ON "Cuota"("estado");

-- CreateIndex
CREATE INDEX "Cuota_vencimiento_idx" ON "Cuota"("vencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "Cuota_contratoId_numero_key" ON "Cuota"("contratoId", "numero");

-- CreateIndex
CREATE INDEX "VencimientoRecurrente_activo_idx" ON "VencimientoRecurrente"("activo");

-- CreateIndex
CREATE INDEX "CompromisoPago_fecha_idx" ON "CompromisoPago"("fecha");

-- CreateIndex
CREATE INDEX "CompromisoPago_estado_idx" ON "CompromisoPago"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Recibo_numero_key" ON "Recibo"("numero");

-- CreateIndex
CREATE INDEX "Recibo_fecha_idx" ON "Recibo"("fecha");

-- CreateIndex
CREATE INDEX "Recibo_beneficiarioId_idx" ON "Recibo"("beneficiarioId");

-- CreateIndex
CREATE INDEX "MigracionLote_estado_idx" ON "MigracionLote"("estado");

-- CreateIndex
CREATE INDEX "MigracionFila_estado_idx" ON "MigracionFila"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "MigracionFila_loteId_fila_key" ON "MigracionFila"("loteId", "fila");

-- AddForeignKey
ALTER TABLE "UsuarioPermiso" ADD CONSTRAINT "UsuarioPermiso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiario" ADD CONSTRAINT "Beneficiario_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiario" ADD CONSTRAINT "Beneficiario_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoLegajo" ADD CONSTRAINT "EmpleadoLegajo_beneficiarioId_fkey" FOREIGN KEY ("beneficiarioId") REFERENCES "Beneficiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeneficiarioAlias" ADD CONSTRAINT "BeneficiarioAlias_beneficiarioId_fkey" FOREIGN KEY ("beneficiarioId") REFERENCES "Beneficiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaGasto" ADD CONSTRAINT "CategoriaGasto_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CategoriaGasto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaGasto" ADD CONSTRAINT "CategoriaGasto_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaGasto" ADD CONSTRAINT "CategoriaGasto_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptoAlias" ADD CONSTRAINT "ConceptoAlias_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaGasto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caja" ADD CONSTRAINT "Caja_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caja" ADD CONSTRAINT "Caja_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "Caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_beneficiarioId_fkey" FOREIGN KEY ("beneficiarioId") REFERENCES "Beneficiario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaGasto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_obraIngresoId_fkey" FOREIGN KEY ("obraIngresoId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_chequeId_fkey" FOREIGN KEY ("chequeId") REFERENCES "Cheque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_reciboId_fkey" FOREIGN KEY ("reciboId") REFERENCES "Recibo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_movimientoOriginalId_fkey" FOREIGN KEY ("movimientoOriginalId") REFERENCES "Movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_migracionFilaId_fkey" FOREIGN KEY ("migracionFilaId") REFERENCES "MigracionFila"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Imputacion" ADD CONSTRAINT "Imputacion_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "Movimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Imputacion" ADD CONSTRAINT "Imputacion_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_beneficiarioId_fkey" FOREIGN KEY ("beneficiarioId") REFERENCES "Beneficiario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionSemanal" ADD CONSTRAINT "LiquidacionSemanal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionSemanal" ADD CONSTRAINT "LiquidacionSemanal_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionSemanal" ADD CONSTRAINT "LiquidacionSemanal_cerradaPorId_fkey" FOREIGN KEY ("cerradaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionItem" ADD CONSTRAINT "LiquidacionItem_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "LiquidacionSemanal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionItem" ADD CONSTRAINT "LiquidacionItem_beneficiarioId_fkey" FOREIGN KEY ("beneficiarioId") REFERENCES "Beneficiario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionDia" ADD CONSTRAINT "LiquidacionDia_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LiquidacionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionDia" ADD CONSTRAINT "LiquidacionDia_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vacacion" ADD CONSTRAINT "Vacacion_beneficiarioId_fkey" FOREIGN KEY ("beneficiarioId") REFERENCES "Beneficiario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificacion" ADD CONSTRAINT "Certificacion_beneficiarioId_fkey" FOREIGN KEY ("beneficiarioId") REFERENCES "Beneficiario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificacion" ADD CONSTRAINT "Certificacion_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificacion" ADD CONSTRAINT "Certificacion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificacion" ADD CONSTRAINT "Certificacion_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoCuota" ADD CONSTRAINT "ContratoCuota_beneficiarioId_fkey" FOREIGN KEY ("beneficiarioId") REFERENCES "Beneficiario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoCuota" ADD CONSTRAINT "ContratoCuota_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoCuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VencimientoRecurrente" ADD CONSTRAINT "VencimientoRecurrente_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VencimientoRecurrente" ADD CONSTRAINT "VencimientoRecurrente_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaGasto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VencimientoRecurrente" ADD CONSTRAINT "VencimientoRecurrente_beneficiarioId_fkey" FOREIGN KEY ("beneficiarioId") REFERENCES "Beneficiario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompromisoPago" ADD CONSTRAINT "CompromisoPago_vencimientoId_fkey" FOREIGN KEY ("vencimientoId") REFERENCES "VencimientoRecurrente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompromisoPago" ADD CONSTRAINT "CompromisoPago_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompromisoPago" ADD CONSTRAINT "CompromisoPago_beneficiarioId_fkey" FOREIGN KEY ("beneficiarioId") REFERENCES "Beneficiario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recibo" ADD CONSTRAINT "Recibo_beneficiarioId_fkey" FOREIGN KEY ("beneficiarioId") REFERENCES "Beneficiario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recibo" ADD CONSTRAINT "Recibo_generadoPorId_fkey" FOREIGN KEY ("generadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigracionLote" ADD CONSTRAINT "MigracionLote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigracionFila" ADD CONSTRAINT "MigracionFila_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "MigracionLote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

