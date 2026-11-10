import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  // Log temprano para diagnosticar — sale a stdout antes de que pino arme buffers.
  // eslint-disable-next-line no-console
  console.log('[boot] iniciando Sistema Cardi backend', {
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
    hasDbUrl: !!process.env.DATABASE_URL,
  });

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  app.setGlobalPrefix('api/v1');

  const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? [
    'http://localhost:5173',
  ];
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3000);
  // host = '0.0.0.0' es crítico en Railway/Heroku/Docker.
  // Sin eso, NestJS puede quedar escuchando solo en localhost y el proxy
  // externo responde 502 porque no alcanza al proceso.
  await app.listen(port, '0.0.0.0');
  app.get(PinoLogger).log(`Sistema Cardi — backend escuchando en 0.0.0.0:${port}/api/v1`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[boot] fatal error', err);
  process.exit(1);
});
