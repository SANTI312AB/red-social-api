import { Injectable } from '@nestjs/common';
import { HashIdService } from './utilis/hash-id.service';


@Injectable()
export class AppService {
  constructor(
    // 💉 INYECCIÓN FORZADA:
    // Esto obliga a NestJS a ejecutar el constructor de HashIdService
    // y asignar la variable estática 'instance' al iniciar la app.
    private readonly hashIdService: HashIdService 
  ) {}

  getHello(): string {
    return 'Hello World!';
  }
}