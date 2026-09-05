import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para permitir consumo desde frontends (React, Angular, etc.)
  app.enableCors();

  // Filtro global de excepciones con mensajes en español
  app.useGlobalFilters(new AllExceptionsFilter());

  // Validación global de DTOs con mensajes en español
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configuración de Swagger (OpenAPI)
  const config = new DocumentBuilder()
    .setTitle('API Sistema de Farmacia')
    .setDescription(
      'Documentación y pruebas interactivas de la API de Farmacia con autenticación JWT, control de roles (RBAC), catálogo de medicamentos y Kardex transaccional.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingresa tu token JWT obtenido de /auth/login',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Conserva el token al recargar el navegador
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Servidor corriendo en: http://localhost:${port}`);
  logger.log(`Swagger disponible en: http://localhost:${port}/docs`);
}
bootstrap();
