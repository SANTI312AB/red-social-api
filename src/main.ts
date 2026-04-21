import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { useContainer, ValidationError } from 'class-validator';
import { HttpExceptionFilter } from './Interfaces/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TimezoneInterceptor } from './utilis/timezone.interceptor';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { LoggingService } from './logs/log.service';
import { AllExceptionsFilter } from './logs/all_exeption';
import { GlobalDataTransformPipe } from './utilis/pipes/parse-bool.pipe';
import { json, urlencoded } from 'express'; // 👈 Importa esto
const basicAuth = require('express-basic-auth');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ extended: true, limit: '100mb' }));

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  app.useGlobalInterceptors(new TimezoneInterceptor());
  const loggingService = app.get(LoggingService);

// registrar filtro global
app.useGlobalFilters(new AllExceptionsFilter(loggingService));
  app.useGlobalFilters(new HttpExceptionFilter());

  // ... (configuración de useGlobalPipes)
  // ======================================================
  // 2. CONFIGURACIÓN GLOBAL DE VALIDACIÓN (CRÍTICO) 🚨
  // ======================================================
  app.useGlobalPipes(
    new GlobalDataTransformPipe(),
    new ValidationPipe({
      whitelist: true, // Elimina propiedades que no estén en el DTO
      forbidNonWhitelisted: true, // Lanza error si envían propiedades extra   
      transform: true, // Activa la transformación automática de tipos
      transformOptions: {
        enableImplicitConversion: true, // Convierte tipos primitivos automáticamente
      },
      exceptionFactory: (errors) => {
        // En lugar de dejar que Nest aplane el error, lanzamos el array de objetos 'ValidationError'
        return new BadRequestException(errors);
      },
    }),
  );

  useContainer(app.select(AppModule), { fallbackOnErrors: true });


   app.use(
    ['/doc', '/doc-json'], // Bloqueamos la interfaz visual y el JSON
    basicAuth({
      challenge: true, // Esto hace que el navegador muestre la ventanita emergente
      users: {
        // Formato: 'usuario': 'contraseña'
        // ¡Lo ideal es que leas esto desde tu process.env!
        social: '@piDoc2026', 
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Red Social API')
    .setDescription('Documentación de la API con Swagger')
    .setVersion('1.6')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);

  // --- LÓGICA DE FILTRADO DINÁMICO ---
  
  // 1. Identificar todas las etiquetas explícitas y las potencialmente problemáticas.
  const explicitTags = new Set<string>();
  const multiTagEndpointsTags = new Set<string>();

  for (const path in document.paths) {
    for (const method in document.paths[path]) {
      const operation = document.paths[path][method];
      if (operation.tags) {
        if (operation.tags.length === 1) {
          // Si un endpoint tiene una sola etiqueta, la consideramos explícita y válida.
          explicitTags.add(operation.tags[0]);
        } else if (operation.tags.length > 1) {
          // Si tiene múltiples, todas son candidatas a ser problemáticas o explícitas.
          operation.tags.forEach(tag => multiTagEndpointsTags.add(tag));
        }
      }
    }
  }

  // Las etiquetas explícitas de los endpoints con múltiples tags también son válidas.
  multiTagEndpointsTags.forEach(tag => explicitTags.add(tag));
  
  // 2. Deducir las etiquetas a eliminar. Son las que aparecen en endpoints con
  //    múltiples etiquetas pero NUNCA solas en ningún endpoint.
  const tagsToRemove = [...multiTagEndpointsTags].filter(tag => {
    let isSingleTagElsewhere = false;
    for (const path in document.paths) {
        for (const method in document.paths[path]) {
            const op = document.paths[path][method];
            if (op.tags && op.tags.length === 1 && op.tags[0] === tag) {
                isSingleTagElsewhere = true;
                break;
            }
        }
        if (isSingleTagElsewhere) break;
    }
    return !isSingleTagElsewhere;
  });

  // 3. Iterar de nuevo para limpiar los endpoints y la lista de tags principal
  document.tags = document.tags?.filter(tag => !tagsToRemove.includes(tag.name));

  for (const path in document.paths) {
    for (const method in document.paths[path]) {
      const operation = document.paths[path][method];
      if (operation.tags) {
        operation.tags = operation.tags.filter(tag => !tagsToRemove.includes(tag));
        
        // Si un endpoint se queda sin etiquetas (como los de AppController), se elimina.
        if (operation.tags.length === 0) {
            delete document.paths[path][method];
        }
      } else {
        delete document.paths[path][method];
      }
    }
    if (Object.keys(document.paths[path]).length === 0) {
      delete document.paths[path];
    }
  }

  // --- FIN DE LA LÓGICA DE FILTRADO ---

  SwaggerModule.setup('doc', app, document, {
    jsonDocumentUrl: '/doc-json',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: false//'list',
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();