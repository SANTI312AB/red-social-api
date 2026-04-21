import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { KeyConfigService } from 'src/config/key-config.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Request } from 'express';
import { HashIdService } from 'src/utilis/hash-id.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly keyConfigService: KeyConfigService,
    private readonly prisma: PrismaService,
    private readonly hash: HashIdService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, 
      secretOrKey: keyConfigService.getPublicKey(),
      algorithms: ['RS256'],
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: any; username: string; jti: string }) {
    
    // 👇 1. VALIDACIÓN ESTRICTA DEL PAYLOAD
    if (!payload.sub) {
        this.logger.error('Validación fallida: El token no contiene el "sub" (ID del usuario).');
        throw new UnauthorizedException('El token es inválido: estructura incorrecta.');
    }

    if (!payload.username) {
        this.logger.error('Validación fallida: El token no contiene el "username".');
        throw new UnauthorizedException('El token es inválido: estructura incorrecta.');
    }

    if(!payload.jti){
        this.logger.error('Validación fallida: El token no contiene el "jti".');
        throw new UnauthorizedException('El token es inválido: estructura incorrecta.');
    }

    // 2. Extraemos el token crudo
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    const sub_decode = await this.hash.decode(payload.sub);
    const userId = Number(sub_decode);
    
    // 3. Buscamos en la BD usando la relación, el sub y el username
    const activeToken = await this.prisma.token.findFirst({
      where: {
        CODIGO_TOKEN: token,
        IDLOGIN:userId,  
        login: {
          USUARIO_LOGIN: payload.username 
        },
        VENCIMIENTO_TOKEN: {
          gt: new Date(),
        },
      },
    });

    if (!activeToken) {
      this.logger.warn(`Intento de acceso con token cerrado/expirado para el usuario: ${payload.username}`);
      throw new UnauthorizedException('La sesión ha sido cerrada o es inválida.');
    }

    // 4. Validamos el estado del usuario
    const user = await this.prisma.login.findUnique({
      where: { IDLOGIN:userId },
    });

    if (!user) {
      throw new UnauthorizedException('Token inválido: Usuario no encontrado.');
    }

    if (user.IDESTADO !== 1) {
      throw new UnauthorizedException('Tu cuenta está inactiva o ha sido bloqueada.');
    }

    if (user.IDVERIFICACION !== 7) {
      throw new UnauthorizedException('Tu cuenta no ha sido verificada.');
    }

    // 5. Todo en orden, limpiamos el password y retornamos
    const { PASSWORD_LOGIN, ...result } = user;
    return result;
  }
}