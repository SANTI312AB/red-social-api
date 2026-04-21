import { Module, Global } from '@nestjs/common';
import { S3Service } from './s3.service';
import { ConfigDbModule } from 'src/config-db/config-db.module';

@Global() // <-- Esto hace que S3Service esté disponible en toda la aplicación
@Module({
  imports: [ConfigDbModule], // Importa el módulo que provee la configuración desde la BD
  providers: [S3Service],
  exports: [S3Service], // "Publica" el S3Service para que otros módulos puedan inyectarlo
})
export class S3Module {}
