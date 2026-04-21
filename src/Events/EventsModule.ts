// notificaciones.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module'; // Rutas de ejemplo
import { EmailModule } from 'src/email/email.module';
import { Servicios } from 'src/Services/servicios.module';
import { postListener } from './post.listener';
import { seguidoresListener } from './seguidores.listener';


@Module({
  imports: [
    PrismaModule,               // 👈 Ahora tu listener ya puede usar this.prisma
    EmailModule,   
    Servicios       
  ],
  providers: [
      postListener, seguidoresListener
  ],
})
export class EventsModules {}