import { Module, Global } from '@nestjs/common';
import { HashPasswordService } from './hash_password';
import { HashIdService } from './hash-id.service';

@Global() // <-- El decorador va aquí
@Module({
  providers: [HashPasswordService,HashIdService],
  exports: [HashPasswordService,HashIdService],
})
export class UtilsModule {}