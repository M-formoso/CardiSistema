import { Module } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaModule } from './prisma/prisma.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './modules/auth/guards/permissions.guard';
import { BeneficiariosModule } from './modules/beneficiarios/beneficiarios.module';
import { CajasModule } from './modules/cajas/cajas.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { CertificacionesModule } from './modules/certificaciones/certificaciones.module';
import { ChequesModule } from './modules/cheques/cheques.module';
import { CompromisosModule } from './modules/compromisos/compromisos.module';
import { ContratosCuotasModule } from './modules/contratos-cuotas/contratos-cuotas.module';
import { CotizacionesModule } from './modules/cotizaciones/cotizaciones.module';
import { HealthModule } from './modules/health/health.module';
import { LiquidacionesModule } from './modules/liquidaciones/liquidaciones.module';
import { MovimientosModule } from './modules/movimientos/movimientos.module';
import { ObrasModule } from './modules/obras/obras.module';
import { RecibosModule } from './modules/recibos/recibos.module';
import { ReportesModule } from './modules/reportes/reportes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
            : undefined,
        redact: {
          paths: ['req.headers.authorization', '*.password', '*.passwordHash'],
          remove: true,
        },
        level: process.env.LOG_LEVEL ?? 'info',
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuditoriaModule,
    AuthModule,
    HealthModule,
    // Maestros
    ObrasModule,
    CategoriasModule,
    BeneficiariosModule,
    CajasModule,
    // Billetera
    CotizacionesModule,
    ChequesModule,
    MovimientosModule,
    // Personas y compromisos
    LiquidacionesModule,
    RecibosModule,
    CertificacionesModule,
    ContratosCuotasModule,
    CompromisosModule,
    // Reportes
    ReportesModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
