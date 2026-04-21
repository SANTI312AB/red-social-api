import { CallHandler, ExecutionContext, Injectable, NestInterceptor, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { HashIdService } from 'src/utilis/hash-id.service'; // 👈 Asegúrate de poner tu ruta correcta

@Injectable()
export class InjectIdsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    if (req.body) {
      // 1. Inyectamos el ID del usuario desde el token
      if (req.user) {
        req.body.usuario_id = req.user.IDLOGIN;
      }

      // 2. Leemos el ID encriptado de la URL
      if (req.params && req.params.id) {
        // 👇 LO DESENCRIPTAMOS AQUÍ MISMO 👇
        const decryptedId = HashIdService.staticDecode(req.params.id);
        
        if (decryptedId === undefined) {
           // Si alguien manda un hash falso o corrupto, lo bloqueamos de inmediato
           throw new BadRequestException('El ID proporcionado en la URL no es válido.');
        }

        // Lo inyectamos al body ya como un número entero (ej. 25)
        req.body.id = decryptedId; 
      }
    }

    return next.handle();
  }
}