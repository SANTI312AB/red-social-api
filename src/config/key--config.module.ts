import { Module, Global } from '@nestjs/common';
import { KeyConfigService } from './key-config.service';

@Global() // Hacemos el módulo global para que el servicio esté disponible en toda la app
@Module({
  providers: [KeyConfigService],
  exports: [KeyConfigService],
})
export class KeyConfigModule {}
