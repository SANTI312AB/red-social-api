import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';


@Global() // Hace que esté disponible en toda la app
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
