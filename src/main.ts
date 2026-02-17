import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ConfigService } from '@nestjs/config';
import { SocketIOAdapter } from './support/socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // API Prefix (exclude TikTok OAuth callback so portal Redirect URI https://core.buykoins.com/callback-tiktok works)
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api');
  app.setGlobalPrefix(apiPrefix, { exclude: ['callback-tiktok'] });

  // CORS: allow single origin or comma-separated list (e.g. for Vercel + localhost)
  const corsOrigin = configService.get<string>('app.corsOrigin') ?? 'http://localhost:3000';
  const allowedOrigins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length > 1 ? allowedOrigins : allowedOrigins[0] || corsOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // WebSocket Adapter Configuration
  const socketAdapter = new SocketIOAdapter(app, configService);
  app.useWebSocketAdapter(socketAdapter);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global Interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger Documentation
  // Enable Swagger in all environments (can be disabled via env var if needed)
  const enableSwagger = process.env.ENABLE_SWAGGER !== 'false';
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('BuyTikTokCoins API')
      .setDescription('Backend API for BuyTikTokCoins platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
  }

  const port = configService.get<number>('app.port', 3001);
  // Railway requires listening on 0.0.0.0 (all interfaces), not localhost
  await app.listen(port, '0.0.0.0');
  const host = process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : 'localhost';
  console.log(`Application is running on: http://${host}:${port}/${apiPrefix}`);
  console.log(`Swagger docs available at: http://${host}:${port}/${apiPrefix}/docs`);
}

bootstrap();
