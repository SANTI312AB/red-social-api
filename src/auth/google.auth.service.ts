// src/auth/google.auth.service.ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { HashPasswordService } from 'src/utilis/hash_password';
import { generateUniqueSlug } from 'src/utilis/sluger.generator';
import { login } from '@prisma/client'; // Importa el tipo de tu modelo
import { JwtService } from '@nestjs/jwt';
const { v4: uuidv4 } = require('uuid');
import { randomBytes } from 'crypto';
import { ResponseService } from 'src/Interfaces/response.service';
import { HashIdService } from 'src/utilis/hash-id.service';
import { ConfigDbService } from 'src/config-db/config-db.service';

// DTO para el perfil de Google
export interface GoogleUserDto {
  google_id: string;
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
}

@Injectable()
export class GoogleAuthService {
  // Asegúrate de que Prisma y HashPasswordService estén
  // disponibles en el módulo (como en tu AuthService)
  constructor(
    private prisma: PrismaService,
    private hash_password: HashPasswordService,
    private jwtService: JwtService,
    private responseService: ResponseService,
    private hash: HashIdService,
    private readonly configService: ConfigDbService,
  ) {}

  /**
   * Busca un usuario por email. Si existe, lo actualiza (vincula).
   * Si no existe, crea una nueva cuenta.
   * Devuelve el registro 'login' final.
   */
  async save_google_user(googleUser: GoogleUserDto): Promise<login> {
    const existingLogin = await this.prisma.login.findUnique({
      where: { EMAIL_LOGIN: googleUser.email },
    });

    // FLUJO A: El usuario SÍ EXISTE (Vincular cuenta)
    if (existingLogin) {
      console.log(`Usuario existente: ${googleUser.email}. Vinculando GOOGLE_ID.`);
      
      const updatedLogin = await this.prisma.login.update({
        where: { IDLOGIN: existingLogin.IDLOGIN },
        data: {
          GOOGLE_ID: googleUser.google_id,
          IDVERIFICACION: 7, // Forzar verificación
        },
      });
      
      // 🔥 DEVUELVE EL LOGIN ACTUALIZADO
      return updatedLogin;
    }

    // FLUJO B: El usuario NO EXISTE (Crear cuenta nueva)
    console.log(`Usuario nuevo: ${googleUser.email}. Creando cuenta.`);

    const randomPassword = Math.random().toString(36).slice(-20);
    const hashedPassword = await this.hash_password.hashPassword(randomPassword);

    const emailPart = googleUser.email.split('@')[0];
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const baseUsername = `${emailPart}_${randomSuffix}`;

    // 'result' aquí será el valor de 'return { login }' de abajo
    const result = await this.prisma.$transaction(async (tx) => {
      const checkUsernameExists = async (username: string) => {
        const existingLogin = await tx.login.findUnique({
          where: { USUARIO_LOGIN: username },
        });
        return !!existingLogin;
      };

      const uniqueUsername = await generateUniqueSlug(
        baseUsername,
        checkUsernameExists,
      );

      const login = await tx.login.create({
        data: {
          EMAIL_LOGIN: googleUser.email,
          USUARIO_LOGIN: uniqueUsername,
          PASSWORD_LOGIN: hashedPassword,
          FECHA_REGISTRO_LOGIN: new Date(),
          LOGIN_ROLES: ['ROLE_USER'],
          IDESTADO: 1,
          IDVERIFICACION: 7,
          GOOGLE_ID: googleUser.google_id,
        },
      });

      await tx.usuarios.create({
        data: {
          NOMBRE_USUARIO: googleUser.firstName,
          APELLIDO_USUARIO: googleUser.lastName,
          AVATAR_USUARIO: googleUser.picture, // Asegúrate de pasar 'picture' desde la Strategy
          IDLOGIN: login.IDLOGIN,
          IDPAIS: 1,
          IDESTADO: 16,
        },
      });



      // 🔥 ESTE RETURN ES VITAL DENTRO DE LA TRANSACCIÓN
      return { login };
    });

    // 🔥 DEVUELVE EL LOGIN CREADO
    // 'result' ahora es { login: ... }
    return result.login;
  }



   /**
   * Genera una sesión y tokens para un usuario que ya ha sido
   * verificado por Google Strategy (creado o vinculado).
   * Esta función es llamada por el endpoint /google/callback.
   */
  async loginFromGoogle(loginRecord: login) {
    // 1. Validar reglas de negocio (igual que en el login clásico)
    if (loginRecord.IDESTADO !== 1) {
      return this.responseService.error(
        'Tu cuenta se encuentra inactiva.',
        HttpStatus.FORBIDDEN,
      );
    }
    
    // Esta comprobación es una salvaguarda.
    // GoogleAuthService ya debería haber puesto '7' (Verificado).
    if (loginRecord.IDVERIFICACION !== 7) {
      return this.responseService.error(
        'Tu cuenta no ha sido verificada.',
        HttpStatus.FORBIDDEN,
      );
    }

    // 2. Generar tokens y sesión (lógica copiada del login clásico)
    const accessPayload = {
      sub: this.hash.encode(loginRecord.IDLOGIN),
      username: loginRecord.USUARIO_LOGIN,
      jti: uuidv4(),
    };
    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: '12h',
    });

    const decodedAccessToken = this.jwtService.decode(accessToken) as {
      exp: number;
    };
    const accessTokenExpires = new Date(decodedAccessToken.exp * 1000);

    const refreshToken = randomBytes(64).toString('hex');
    const refreshTokenExpires = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    );
    const hashedRefreshToken = await this.hash_password.hashPassword(
      refreshToken,
    );

    // 3. Guardar el token en la base de datos
    await this.prisma.token.create({
      data: {
        CODIGO_TOKEN: accessToken,
        FECHA_RESGISTRO: new Date(),
        REFRESH_TOKEN: hashedRefreshToken,
        REFRESH_EXPIRES: refreshTokenExpires,
        IDLOGIN: loginRecord.IDLOGIN,
        VENCIMIENTO_TOKEN: accessTokenExpires,
        FECHA_TOKEN: new Date(),
      },
    });

    // 4. Actualizar la última fecha de login
    await this.prisma.login.update({
      where: { IDLOGIN: loginRecord.IDLOGIN },
      data: { LAST_LOGIN: new Date() },
    });

    // Guardamos la URL base en una variable para mayor claridad
    const frontUrl = await this.configService.getFrontUrlConfig();
    
    // Armamos la URL final usando Template Literals (comillas invertidas)
    // Nota: Asegúrate de que frontUrl termine en '/' o agrégalo antes de 'token' si es necesario
    const url = `${frontUrl.url}/token?accessToken=${accessToken}&refreshToken=${refreshToken}`;
    // 5. Devolver la respuesta exitosa
    return this.responseService.success('Inicio de sesión exitoso.', {
       url: url
    });
  }
}