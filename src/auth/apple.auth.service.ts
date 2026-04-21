import { Injectable, Logger, BadRequestException, InternalServerErrorException, HttpException, HttpStatus } from '@nestjs/common';
import * as appleSignin from 'apple-signin-auth';
import { PrismaService } from '../prisma/prisma.service'; // Ajusta la ruta
import { ConfigDbService } from 'src/config-db/config-db.service';
import { JwtService } from '@nestjs/jwt';
import { HashPasswordService } from 'src/utilis/hash_password';
import { randomBytes } from 'crypto';
import { ResponseService } from 'src/Interfaces/response.service';
const { v4: uuidv4 } = require('uuid');

@Injectable()
export class AppleAuthService {
  private readonly logger = new Logger(AppleAuthService.name);

  constructor(
    private prisma: PrismaService,
    // asumo que inyectas tu servicio de configuración y JWT aquí
    private configDbService: ConfigDbService, 
    private jwtService: JwtService,
    private hashService: HashPasswordService,
    private responseService: ResponseService,
    
  ) {}

  // 1. Generar la URL para el botón de "Iniciar sesión con Apple"
  async getAuthorizationUrl(state: string): Promise<string> {
    const config = await this.configDbService.getAppleConfig();

     const options = {
      clientID: config.client_id,
      redirectUri: config.callback_url,
      state: state,
      scope: 'name email',
      responseMode: 'form_post' as const, // 👈 Aquí está la magia
    };

    return appleSignin.getAuthorizationUrl(options);
  }


// ... resto de tus imports ...

  async processAppleCallback(code: string, state: string, userJson?: string) {
    try {
      const config = await this.configDbService.getAppleConfig();
      const privateKey = config.private_key.replace(/\\n/g, '\n');

      const clientSecret = appleSignin.getClientSecret({
        clientID: config.client_id,
        teamID: config.team_id,
        keyIdentifier: config.key_id,
        privateKey: privateKey,
      });

      const tokenResponse = await appleSignin.getAuthorizationToken(code, {
        clientID: config.client_id,
        redirectUri: config.callback_url,
        clientSecret: clientSecret,
      });

      const decodedIdToken = await appleSignin.verifyIdToken(tokenResponse.id_token, {
        audience: config.client_id,
      });

      const appleId = decodedIdToken.sub;
      let email = decodedIdToken.email;
      let firstName = '';
      let lastName = '';

      if (userJson) {
        try {
          const parsedUser = JSON.parse(userJson);
          if (parsedUser.name) {
            firstName = parsedUser.name.firstName || '';
            lastName = parsedUser.name.lastName || '';
          }
          if (parsedUser.email) email = parsedUser.email;
        } catch (e) {
          this.logger.warn('No se pudo parsear el objeto user de Apple');
        }
      }

      // E. Lógica de Base de Datos (Buscar o Crear)
      const login = await this.createOrUpdateUser(appleId, email, firstName);

      // ==========================================
      // 🚨 VALIDACIÓN DE ESTADO Y VERIFICACIÓN
      // ==========================================
      if (login.IDESTADO !== 1) {
        // Envolvemos tu responseService en un HttpException para detener el flujo
        throw new HttpException(
          this.responseService.error('Tu cuenta se encuentra inactiva.', HttpStatus.FORBIDDEN),
          HttpStatus.FORBIDDEN
        );
      }
          
      if (login.IDVERIFICACION !== 7) {
        throw new HttpException(
          this.responseService.error('Tu cuenta no ha sido verificada.', HttpStatus.FORBIDDEN),
          HttpStatus.FORBIDDEN
        );
      }
      // ==========================================

      // F. Generar tu propio JWT
      const payload = { sub: login.IDLOGIN, username: login.USUARIO_LOGIN, jti: uuidv4() };

      const accessToken = this.jwtService.sign(payload, {
        expiresIn: '12h',
      });
      
      const decodedAccessToken = this.jwtService.decode(accessToken) as { exp: number; };
      const accessTokenExpires = new Date(decodedAccessToken.exp * 1000);
      
      const refreshToken = randomBytes(64).toString('hex');
      const refreshTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const hashedRefreshToken = await this.hashService.hashPassword(refreshToken);
      
      // 3. Guardar el token en la base de datos
      await this.prisma.token.create({
        data: {
          CODIGO_TOKEN: accessToken,
          FECHA_RESGISTRO: new Date(),
          REFRESH_TOKEN: hashedRefreshToken,
          REFRESH_EXPIRES: refreshTokenExpires,
          IDLOGIN: login.IDLOGIN,
          VENCIMIENTO_TOKEN: accessTokenExpires,
          FECHA_TOKEN: new Date(),
        },
      });
      
      // 4. Actualizar la última fecha de login
      await this.prisma.login.update({
        where: { IDLOGIN: login.IDLOGIN },
        data: { LAST_LOGIN: new Date() },
      });

      return { accessToken, refreshToken, state };

    } catch (error) {
      // ==========================================
      // 🛡️ CONTROL DE ERRORES AJUSTADO
      // ==========================================
      
      // Si el error es una de nuestras validaciones (Inactiva o No Verificada), lo dejamos pasar intacto
      if (error instanceof HttpException) {
        throw error;
      }

      // Si es un error interno o de la librería de Apple, lanzamos un error genérico
      this.logger.error('Error al procesar login de Apple:', error);
      throw new BadRequestException(
        this.responseService.error('Fallo la autenticación con Apple', HttpStatus.BAD_REQUEST)
      );
    }
  }

  
  // --- Método Privado de Base de Datos ---
  private async createOrUpdateUser(appleId: string, email: string, firstName: string) {
    // 1. Buscamos por Apple ID (siempre seguro) o por email (por si se registró normal antes)
    let login = await this.prisma.login.findFirst({
      where: {
        OR: [
          { APPLE_ID: appleId },
          { EMAIL_LOGIN: email }
        ]
      }
    });

    const usernameBase = email ? email.split('@') : (firstName || 'appleuser');
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    const slug = String(usernameBase).toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!login) {
      // USUARIO NUEVO - Ejecutamos tu lógica de PHP dentro de una Transacción
      const rawPassword = `${slug}${uniqueSuffix}${appleId}`;
      const hashedPassword = await this.hashService.hashPassword(rawPassword);

      login = await this.prisma.$transaction(async (tx) => {
        // A. Crear Login
         const newLogin = await tx.login.create({
          data: {
            EMAIL_LOGIN: email,
            USUARIO_LOGIN: `${usernameBase}-${uniqueSuffix}`,
            APPLE_ID: String(appleId),
            PASSWORD_LOGIN: hashedPassword,
            IDESTADO: 1, // enable
            IDVERIFICACION: 7, // verificado
            LAST_LOGIN: new Date(),
            // 👇 AQUÍ ESTÁ LA MAGIA QUE FALTA
            LOGIN_ROLES: ['ROLE_USER'], // Asignamos el rol de usuario por defecto
          }
        });
        // B. Crear Usuario
        await tx.usuarios.create({
          data: {
            IDLOGIN: newLogin.IDLOGIN,
            EMAIL_USUARIO: email,
            USUARIO: `${usernameBase}-${uniqueSuffix}`,
            NOMBRE_USUARIO: slug,
            IDPAIS: 1,
            IDESTADO: 16, // estado_biometrico
          }
        });


        return newLogin;
      });

    } else {
      // USUARIO EXISTENTE - Solo actualizamos su Apple ID y Last Login
      login = await this.prisma.login.update({
        where: { IDLOGIN: login.IDLOGIN },
        data: {
          APPLE_ID: appleId, // Lo asociamos si antes se había registrado con correo normal
          LAST_LOGIN: new Date(),
        }
      });
    }

    return login;
  }
}