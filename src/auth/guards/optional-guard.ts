import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Un guardián que intenta autenticar al usuario con JWT,
 * pero no lanza un error si la autenticación falla (ej. sin token).
 * Simplemente adjunta el 'user' a la petición si tiene éxito,
 * o 'undefined' si no.
 */
@Injectable()
export class JwtOptionalAuthGuard extends AuthGuard('jwt') {
  
  // Sobrescribe el método handleRequest del AuthGuard
  handleRequest(err, user, info) {
    // No lanzar un error si 'user' no existe o si hay un 'info' (ej. token expirado)
    // Simplemente devuelve 'user' (que será 'undefined' si la autenticación falla)
    return user;
  }
}
