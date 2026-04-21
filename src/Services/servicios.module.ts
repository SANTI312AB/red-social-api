import { Module, Global } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module'; // Necesario porque el servicio usa Prisma
import { ValidacionCedulaRucService } from './ValidacionCedulaRucEcuadorService';
import { NotificacionesService } from './notificaciones.service';
import { FirebaseService } from './firebase.service';
import { FrameVideoService } from './framevideo.service';

@Global() // 🔥 IMPORTANTE: Esto hace que el servicio sea visible en TODA la app
@Module({
  imports: [PrismaModule], // El servicio necesita Prisma
  providers: [ValidacionCedulaRucService,NotificacionesService,FirebaseService,FrameVideoService], // Registramos el servicio aquí
  exports: [ValidacionCedulaRucService,NotificacionesService,FirebaseService,FrameVideoService],   // Lo exportamos para que otros módulos lo usen
})
export class Servicios {}