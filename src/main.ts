import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

    app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // remove campos extras
      forbidNonWhitelisted: true, // erro se mandar campo que não existe
      transform: true,          // converte tipos
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('API - Controle de Vistorias e Entregas')
    .setDescription('Documentação da API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const shouldExportSwagger = process.env.EXPORT_SWAGGER === 'true';
  if (shouldExportSwagger) {
    const outputPath = process.env.SWAGGER_OUTPUT_PATH ?? './swagger.json';

    try {
      fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');
      logger.log(`Swagger exportado em: ${outputPath}`);
    } catch (error) {
      logger.warn(`Falha ao exportar swagger: ${(error as Error).message}`);
    }
  }

  await app.listen(3000);
}
bootstrap();
