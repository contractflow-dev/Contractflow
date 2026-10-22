import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });
  const config = app.get(ConfigService);
  app.enableCors({
    origin: new URL(
      config.get<string>('CORS_ORIGIN') ??
        config.getOrThrow<string>('WEB_URL'),
    ).origin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`API running on 0.0.0.0:${port}`);
}
void bootstrap();