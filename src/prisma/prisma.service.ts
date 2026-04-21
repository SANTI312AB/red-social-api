import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Importa todas tus extensiones
import { postlikeExtension, postcommentExtension, handleRespuesta_CommentPostExtencion } from 'src/middleware/post.middlewares';
import { seguidorExtension, seguidorAceptadoExtension } from 'src/middleware/seguidor.middleware';


@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(
    configService: ConfigService,
    eventEmitter: EventEmitter2
  ) {
    const adapter = new PrismaMariaDb({
      host: configService.get<string>('DATABASE_HOST'),
      port: Number(configService.get<number>('DATABASE_PORT')),
      user: configService.get<string>('DATABASE_USER'),
      password: configService.get<string>('DATABASE_PASSWORD'),
      database: configService.get<string>('DATABASE_NAME'),
      connectionLimit: 50,
    });

    // 1. Inicializamos la clase padre (PrismaClient)
    super({ adapter });
    // 2. Extendemos los middlewares 
    const extendedClient = this

      .$extends(postlikeExtension(this, eventEmitter))
      .$extends(postcommentExtension(this, eventEmitter))
      .$extends(handleRespuesta_CommentPostExtencion(this, eventEmitter))
      .$extends(seguidorExtension(this, eventEmitter))
      .$extends(seguidorAceptadoExtension(this, eventEmitter));

    this.logger.log('Middlewares de Prisma registrados correctamente.');
    //3. Devolvemos un Proxy que usa el cliente extendido para las consultas BD.
    return new Proxy(this, {
      get: (target, property) => {
        return Reflect.get(extendedClient, property) || Reflect.get(target, property);
      },
    }) as this; // <--- Este 'as this' es el que le devuelve los tipos a todo tu proyecto
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ DB conectada');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}