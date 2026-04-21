import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // 👈 1. Importar ConfigModule

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_INTERCEPTOR} from '@nestjs/core';
import { HttpLoggingInterceptor } from './logs/log.interceptor';

// Módulos de tu aplicación
import { AuthModule } from './auth/auth.module';
import { InterfacesModule } from './Interfaces/interfaces.module';
import { ValidatorsModule } from './validators/validators.module';
import { S3Module } from './s3/s3.module';
import { LoggingModule } from './logs/log.module';
import { RedSocialModule } from './red_social/red_social.module';
import { CollectionEventModule } from './collection_event/collection-event.module';
import { UtilsModule } from './utilis/utils.module';
import { FavoritosModule } from './favoritos/favoritos.module';
import { MetodosModule } from './metodos/metodos.module';
import { Servicios } from './Services/servicios.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EmailModule } from './email/email.module';
import { PrismaModule } from './prisma/prisma.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { EventsModules } from './Events/EventsModule';
import { DispositivoModule } from './dispositivos/dispositivo.module';
@Module({
  imports: [   
    ConfigModule.forRoot({isGlobal: true}),// Esto carga el archivo .env inmediatamente al iniciar la app
    EventEmitterModule.forRoot(),// Habilitar el Event Emitter en toda la aplicación
    ScheduleModule.forRoot(),// Configuración del Módulo de Tareas Programadas
    // Módulos
    PrismaModule,
    AuthModule,
    InterfacesModule,
    ValidatorsModule,
    S3Module,
    RedSocialModule,
    LoggingModule,
    CollectionEventModule,
    UtilsModule,
    FavoritosModule,
    MetodosModule,
    Servicios,
    EmailModule,
    NotificacionesModule,
    DispositivoModule,
    EventsModules
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    }
  ],
})
export class AppModule {}