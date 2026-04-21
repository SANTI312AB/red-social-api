import { Module, Global } from '@nestjs/common';
import { ConfigDbService } from './config-db.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Global() // Hacemos este módulo global para que el servicio esté disponible en toda la app
@Module({
  imports: [PrismaModule], // Necesita Prisma para acceder a la BD
  providers: [ConfigDbService],
  exports: [ConfigDbService],
})
export class ConfigDbModule {}
