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

  // API Prefix
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api');
  app.setGlobalPrefix(apiPrefix);

  // CORS
  const corsOrigin = configService.get<string>('app.corsOrigin');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
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
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`Swagger docs available at: http://localhost:${port}/${apiPrefix}/docs`);
}

bootstrap();
