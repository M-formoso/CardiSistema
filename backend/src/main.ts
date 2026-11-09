import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
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
  await app.listen(port);
  app.get(PinoLogger).log(`Sistema Cardi — backend escuchando en http://localhost:${port}/api/v1`);
}

bootstrap();
