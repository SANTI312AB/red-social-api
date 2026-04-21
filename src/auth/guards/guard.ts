import { Injectable, UnauthorizedException, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Códigos de error personalizados para la autenticación.
 * Esto permite al frontend diferenciar por qué falló un 401.
 */
export enum AuthErrorCode {
  TokenExpired = 'TOKEN_EXPIRED',
  InvalidToken = 'INVALID_TOKEN',
  UserInactive = 'USER_INACTIVE', // Error de lógica de negocio (desde la Strategy)
  UserNotVerified = 'USER_NOT_VERIFIED', // Error de lógica de negocio (desde la Strategy)
  SessionInvalid = 'SESSION_INVALID', // Error de lógica de negocio (desde la Strategy)
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  
  handleRequest(err, user, info: Error) {
    
    // --- BLOQUE 1: Manejo de Errores de la Librería (info) ---

    // 1. Chequeo específico para token expirado.
    if (info && info.name === 'TokenExpiredError') {
      // --- CAMBIO CLAVE AQUÍ ---
      // Se usa HttpException para poder enviar el status code 498.
      // 498 es un código no estándar, por lo que usamos el número directamente.
      throw new HttpException({
        status: false,
        message: 'El token ha expirado. Por favor, inicia sesión de nuevo.',
        data: {
          code: AuthErrorCode.TokenExpired,
        },
      }, 498); // <-- Se cambia 401 por 498
    }

    // 2. Chequeo específico para token inválido (firma incorrecta o malformado).
    if (info && info.name === 'JsonWebTokenError') {
      throw new UnauthorizedException({
        status: false,
        message: 'El token proporcionado es inválido o tiene un formato incorrecto.',
        data: {
          code: AuthErrorCode.InvalidToken,
        },
      });
    }
    
    // 3. Fallback para cualquier otro error de 'info' (ej. 'NoAuthException' si no se proveyó token).
    if (info) {
      throw new UnauthorizedException({
        status: false,
        message: 'Debes iniciar sesión para acceder a este recurso.',
        data: {
          code: AuthErrorCode.InvalidToken,
        },
      });
    }
    
    // --- BLOQUE 2: Manejo de Errores de tu Lógica (err) ---
    if (err || !user) {
      throw err || new UnauthorizedException({ 
        status: false,
        message: 'Acceso no autorizado.',
        data: {
          code: AuthErrorCode.InvalidToken,
        },
      });
    }
    
    // 4. Si todo está bien, devuelve el usuario.
    return user;
  }
}