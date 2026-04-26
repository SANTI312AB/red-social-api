import { Injectable, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { ResponseService } from 'src/Interfaces/response.service';
import { EmailService } from 'src/email/email.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RetryVerifyotp } from './dto/retry-verify-otp';
import { ResetPasswordDto } from './dto/reset-password';
import { LoginDto } from './dto/login-dto';
import { randomBytes } from 'crypto';
const { v4: uuidv4 } = require('uuid');
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { token as TokenModel, login as LoginModel } from '@prisma/client';
type TokenWithLogin = TokenModel & { login: LoginModel };
import { generateUniqueSlug } from 'src/utilis/sluger.generator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { S3Service } from 'src/s3/s3.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserFormatterService } from 'src/Interfaces/user-formatter.service';
import { HashPasswordService } from 'src/utilis/hash_password';
import { JwtService } from '@nestjs/jwt';
import { HashIdService } from 'src/utilis/hash-id.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private responseService: ResponseService,
    private emailService: EmailService,
    private jwtService: JwtService,
    private s3Service: S3Service,
    private profile: UserFormatterService,
    private hash_password: HashPasswordService,
    private hash: HashIdService
  ) {}

  /**
   * Registra un nuevo usuario, guarda el OTP y el token JWT, y envía el correo.
   */
  async register(dto: CreateUserDto) {
    const hashedPassword = await this.hash_password.hashPassword(dto.password);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expira en 10 minutos

    const payload = { email: dto.email, otp: otpCode };
    const verificationToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const login = await tx.login.create({
        data: {
          EMAIL_LOGIN: dto.email,
          USUARIO_LOGIN: dto.username,
          PASSWORD_LOGIN: hashedPassword,
          FECHA_REGISTRO_LOGIN: new Date(),
          LOGIN_ROLES: ['ROLE_USER'],
          IDESTADO: 1,
          IDVERIFICACION: 8, // Pendiente de Verificación
          opt: {
            create: [
              {
                OTP: parseInt(otpCode),
                TOKEN: verificationToken,
                TIPO: 'CUENTA',
                createdAt: new Date(),
                expiresAt: expiresAt,
              },
            ],
          },
        },
      });

      await tx.usuarios.create({
        data: {
          NOMBRE_USUARIO: dto.nombre,
          APELLIDO_USUARIO: dto.apellido,
          IDLOGIN: login.IDLOGIN,
          IDPAIS: 1,
          IDESTADO: 16,
        },
      });

     

      return { login };
    });

    await this.emailService.sendVerificationOtp(
      result.login.EMAIL_LOGIN,
      otpCode,
      'Gracias por registrate en Shopby',
      'Gracias por registrate en Shopby verifica tu cuenta con este codigo',
      result.login.USUARIO_LOGIN,
    );

    return this.responseService.success(
      'Usuario registrado. Revisa tu correo para el código de verificación.',
      {
        message:
          'Usa el siguiente token y el código de tu correo para verificar tu cuenta.',
      },
    );
  }

  async retryOTP(dto: RetryVerifyotp) {
    const email = dto.email;

    const login = await this.prisma.login.findUnique({
      where: { EMAIL_LOGIN: email },
    });

    // Seguridad: Fallamos silenciosamente si el usuario no existe para evitar "Email Enumeration"
    if (!login) {
      return this.responseService.success(
        'Si existe una cuenta asociada a este correo, se ha enviado un nuevo código.',
      );
    }

    if (login.IDVERIFICACION === 7) {
      return this.responseService.error(
        'Esta cuenta ya ha sido verificada.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // --- NUEVA VALIDACIÓN CORREGIDA ---
    // 1. Buscamos si ya existe un OTP activo (no usado y no expirado)
    const activeOtp = await this.prisma.opt.findFirst({
      where: {
        IDLOGIN: login.IDLOGIN,
        USADO: false,
        TIPO: 'CUENTA',
        // ELIMINAMOS el createdAt: new Date() porque rompía la búsqueda
        expiresAt: {
          gt: new Date(), // Solo verificamos que la fecha de expiración sea mayor a AHORA
        },
      },
    });

    // 2. Si se encuentra un OTP activo, se bloquea la creación de uno nuevo.
    if (activeOtp) {
      return this.responseService.error(
        'Ya tienes un código activo. Por favor, espera a que expire antes de solicitar uno nuevo.',
        HttpStatus.TOO_MANY_REQUESTS, 
      );
    }

    // Contamos los OTPs que no han sido usados para este usuario (prevención de spam).
    const otps = await this.prisma.opt.count({
      where: {
        IDLOGIN: login.IDLOGIN,
        USADO: false,
        TIPO: 'CUENTA', 
      },
    });

    if (otps >= 3) {
      return this.responseService.error(
        'Solo se permite un máximo de 3 códigos activos a la vez.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Generamos el nuevo código
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const payload = { email: login.EMAIL_LOGIN, otp: otpCode, resend: true };
    const newVerificationToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    await this.prisma.opt.create({
      data: {
        OTP: parseInt(otpCode), 
        TOKEN: newVerificationToken, 
        TIPO: 'CUENTA', 
        createdAt: new Date(), // Aquí sí está bien usarlo, al crear el registro
        expiresAt: expiresAt,
        IDLOGIN: login.IDLOGIN,
      },
    });

    await this.emailService.sendVerificationOtp(
      login.EMAIL_LOGIN,
      otpCode,
      'Nuevo código para activar cuenta',
      'Verifica tu cuenta con este código',
      login.USUARIO_LOGIN,
    );

    return this.responseService.success(
      'Si existe una cuenta pendiente de verificación, se ha enviado un nuevo código.',
    );
  }

  async reset_password_otp(dto: RetryVerifyotp) {
    const email = dto.email;

    const login = await this.prisma.login.findUnique({
      where: { EMAIL_LOGIN: email },
    });

    if (!login) {
      return this.responseService.success(
        'Si existe una cuenta asociada a este correo, se ha enviado un nuevo código.',
      );
    }

    if (login.IDVERIFICACION === 8) {
      return this.responseService.error(
        'Esta cuente tiene que estar verificada para recuperar la contraseña.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // --- NUEVA VALIDACIÓN AQUÍ ---
    // 1. Buscamos si ya existe un OTP activo (no usado y no expirado)
    const activeOtp = await this.prisma.opt.findFirst({
      where: {
        IDLOGIN: login.IDLOGIN,
        USADO: false,
        TIPO: 'CONTRASEÑA',
        expiresAt: {
          gt: new Date(), // 'gt' significa 'greater than' (mayor que la fecha actual)
        },
      },
    });

    // 2. Si se encuentra un OTP activo, se bloquea la creación de uno nuevo.
    if (activeOtp) {
      return this.responseService.error(
        'Ya tienes un código activo. Por favor, espera a que expire antes de solicitar uno nuevo.',
        HttpStatus.TOO_MANY_REQUESTS, // 429 es el código ideal para limitar peticiones
      );
    }

    // Contamos solo los OTPs que no han sido usados para este usuario.
    const otps = await this.prisma.opt.count({
      where: {
        IDLOGIN: login.IDLOGIN,
        USADO: false,
        TIPO: 'CONTRASEÑA', // Corregido a minúsculas para coincidir con el modelo
      },
    });

    if (otps >= 3) {
      return this.responseService.error(
        'Solo se permite un máximo de 3 códigos activos a la vez.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const payload = { email: login.EMAIL_LOGIN, otp: otpCode, resend: true };
    const newVerificationToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    await this.prisma.opt.create({
      data: {
        OTP: parseInt(otpCode), // Corregido a minúsculas
        TOKEN: newVerificationToken, // Corregido a minúsculas
        TIPO: 'CONTRASEÑA', // Corregido a minúsculas
        createdAt: new Date(),
        expiresAt: expiresAt,
        IDLOGIN: login.IDLOGIN,
      },
    });

    await this.emailService.sendVerificationOtp(
      login.EMAIL_LOGIN,
      otpCode,
      'Solicitud de recuperar contraseña',
      'Utiliza el codigo opt para actualziar la contraseña',
      login.USUARIO_LOGIN,
    );

    return this.responseService.success(
      'Si existe una cuenta pendiente de verificación, se ha enviado un nuevo código.',
    );
  }

  async update_password_otp(dto: ResetPasswordDto) {
    if (dto.password !== dto.confirmPassword) {
        return this.responseService.error(
          'Las contraseñas no coinciden.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const otpNumber = parseInt(dto.otp);
      const otpRecord = await this.prisma.opt.findFirst({
        where: { OTP: otpNumber, TIPO: 'CONTRASEÑA' },
        include: { login: true },
      });

      if (!otpRecord || otpRecord.USADO || new Date() > otpRecord.expiresAt) {
        return this.responseService.error(
          'El código de verificación es inválido, ha sido usado o ha expirado.',
          HttpStatus.BAD_REQUEST,
        );
      }
    
    try {
    
      // Usamos el servicio de hashing centralizado
      const hashedPassword = await this.hash_password.hashPassword(
        dto.password,
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.login.update({
          where: { IDLOGIN: otpRecord.IDLOGIN },
          data: { PASSWORD_LOGIN: hashedPassword },
        });
        await tx.opt.update({
          where: { ID_OPT: otpRecord.ID_OPT },
          data: { USADO: true },
        });

        await tx.token.deleteMany({
          where:{
            IDLOGIN:otpRecord.IDLOGIN
          }
        });
      });

      return this.responseService.success(
        '¡Tu contraseña ha sido actualizada exitosamente!',
      );
    } catch (error) {
      console.error('Error en update_password_otp:', error);
      return this.responseService.error(
        'Ocurrió un error inesperado al actualizar la contraseña.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // --- El método verifyOtp actualizado para el nuevo esquema ---
   async verifyOtp(dto: VerifyOtpDto) {
    try {
      const otpNumber = parseInt(dto.otp);

      // 1. Buscamos el registro del OTP e incluimos los datos del usuario relacionado.
      const otpRecord = await this.prisma.opt.findFirst({
        where: {
          OTP: otpNumber, 
          TIPO: 'CUENTA', 
        },
        include: {
          login: true, // Incluimos la relación con el login
        },
      });

      // 2. Si no se encuentra, el código es inválido
      if (!otpRecord) {
        return this.responseService.error(
          'El código de verificación es inválido.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Definimos loginRecord a partir de la relación encontrada
      const loginRecord = otpRecord.login;

      // 3. Verificamos si la cuenta del usuario ya está verificada
      if (loginRecord.IDVERIFICACION === 7) {
        return this.responseService.error(
          'Esta cuenta ya ha sido verificada.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 4. Verificamos si el código ya fue utilizado
      if (otpRecord.USADO) {
        return this.responseService.error(
          'Este código de verificación ya ha sido utilizado.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 5. Verificamos si el código ha expirado
      if (new Date() > otpRecord.expiresAt) {
        return this.responseService.error(
          'El código ha expirado. Por favor, solicita uno nuevo.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 6. Si todo es correcto, actualizamos al usuario y marcamos el OTP como usado
      await this.prisma.$transaction(async (tx) => {
        await tx.login.update({
          where: { IDLOGIN: loginRecord.IDLOGIN },
          data: { 
            IDVERIFICACION: 7, // Estado final: Verificado
            LAST_LOGIN: new Date() // Movido aquí para ahorrar un UPDATE a la BD
          }, 
        });

        // Marcamos como usado en lugar de borrarlo, para mantener un registro
        await tx.opt.update({
          where: {
            ID_OPT: otpRecord.ID_OPT,
          },
          data: { USADO: true }, 
        });
      });

      // 7. Generación de Tokens de Sesión
      const accessPayload = {
        sub: this.hash.encode(loginRecord.IDLOGIN),
        username: loginRecord.USUARIO_LOGIN,
        jti: uuidv4(), // Asegúrate de tener importado 'uuidv4'
      };
      
      const accessToken = this.jwtService.sign(accessPayload, {
        expiresIn: '12h',
      });

      const decodedAccessToken = this.jwtService.decode(accessToken) as { exp: number };
      const accessTokenExpires = new Date(decodedAccessToken.exp * 1000);

      const refreshToken = randomBytes(64).toString('hex'); // Asegúrate de tener importado 'randomBytes' de 'crypto'
      const refreshTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const hashedRefreshToken = await this.hash_password.hashPassword(refreshToken);

      // 8. Guardamos el token en la Base de Datos
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

      // 9. Retornamos el éxito junto con los tokens
      return this.responseService.success(
        '¡Tu cuenta ha sido verificada exitosamente!',
        {
          accessToken: accessToken,
          refreshToken: refreshToken,
          username: loginRecord.USUARIO_LOGIN
        }
      );
    } catch (error) {
      console.error('Error en verifyOtp:', error);
      return this.responseService.error(
        'Ocurrió un error inesperado al verificar la cuenta.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Inicia sesión, valida al usuario y guarda el token de sesión en la base de datos.
   */
   async login(dto: LoginDto) {
    const loginRecord = await this.prisma.login.findUnique({
      where: { EMAIL_LOGIN: dto.email },
    });

    if (!loginRecord || !loginRecord.PASSWORD_LOGIN) {
      return this.responseService.error(
        'Las credenciales son incorrectas.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // ==========================================
    // 🚨 1. VERIFICAR SI YA ESTÁ BLOQUEADO ANTES DE SEGUIR
    // ==========================================
    if (loginRecord.BLOQUEADO_HASTA && loginRecord.BLOQUEADO_HASTA > new Date()) {
      const faltanMinutos = Math.ceil((loginRecord.BLOQUEADO_HASTA.getTime() - Date.now()) / 60000);
      return this.responseService.error(
        `Tu cuenta está bloqueada por seguridad. Intenta en ${faltanMinutos} minutos.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isPasswordMatching = await this.hash_password.comparePasswords(
      dto.password,
      loginRecord.PASSWORD_LOGIN,
    );

    // ==========================================
    // ❌ 2. MANEJO DE FALLOS Y BLOQUEOS
    // ==========================================
    if (!isPasswordMatching) {
      const intentos = loginRecord.INTENTOS_FALLIDOS + 1;
      let bloqueadoHasta: Date | null = null;

      // Si llegó a 5 intentos, calculamos la fecha de bloqueo
      if (intentos >= 5) {
        bloqueadoHasta = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2 horas
        
        // Guardamos el bloqueo antes de cortar la ejecución
        await this.prisma.login.update({
          where: { IDLOGIN: loginRecord.IDLOGIN },
          data: { INTENTOS_FALLIDOS: intentos, BLOQUEADO_HASTA: bloqueadoHasta },
        });

        // VITAL: Agregar el "return" para que no siga leyendo hacia abajo
        return this.responseService.error(
          'Has alcanzado el máximo de intentos. Tu cuenta ha sido bloqueada por 2 horas.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Si falló pero aún no llega a 5, solo sumamos 1 al contador
      await this.prisma.login.update({
        where: { IDLOGIN: loginRecord.IDLOGIN },
        data: { INTENTOS_FALLIDOS: intentos, BLOQUEADO_HASTA: bloqueadoHasta },
      });

      return this.responseService.error(
        'Las credenciales son incorrectas.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Lógica de migración transparente de contraseña si el formato es antiguo
    if (!loginRecord.PASSWORD_LOGIN.startsWith('$2')) {
      const newHash = await this.hash_password.hashPassword(dto.password);
      await this.prisma.login.update({
        where: { IDLOGIN: loginRecord.IDLOGIN },
        data: { PASSWORD_LOGIN: newHash },
      });
    }

    if (loginRecord.IDESTADO !== 1) {
      return this.responseService.error(
        'Tu cuenta se encuentra inactiva.',
        HttpStatus.FORBIDDEN,
      );
    }
    
    if (loginRecord.IDVERIFICACION !== 7) {
      return this.responseService.error(
        'Tu cuenta no ha sido verificada.',
        HttpStatus.FORBIDDEN,
      );
    }

    // ==========================================
    // ✅ 3. ÉXITO: GENERACIÓN DE TOKENS
    // ==========================================
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
    const refreshTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const hashedRefreshToken = await this.hash_password.hashPassword(refreshToken);

    // Guardamos el token en BD
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

    // VITAL: Actualizamos el LAST_LOGIN y reseteamos los contadores de fallos a 0
    await this.prisma.login.update({
      where: { IDLOGIN: loginRecord.IDLOGIN },
      data: { 
        LAST_LOGIN: new Date(),
        INTENTOS_FALLIDOS: 0, 
        BLOQUEADO_HASTA: null 
      },
    });

    return this.responseService.success('Inicio de sesión exitoso.', {
      accessToken: accessToken,
      refreshToken: refreshToken,
      username: loginRecord.USUARIO_LOGIN
    });
  }

  // --- LÓGICA PARA REFRESCAR EL TOKEN (ACTUALIZADA) ---
  async refreshToken(dto: RefreshTokenDto) {
    const { refreshToken } = dto;

    // 1. Buscamos todos los tokens potencialmente válidos
    const potentialTokens = await this.prisma.token.findMany({
      where: {
        REFRESH_EXPIRES: { gt: new Date() }, // Filtra solo tokens no expirados
        login: { IDESTADO: 1, IDVERIFICACION: 7 },
      },
      include: { login: true },
    });

    // 2. Comparamos el refresh token recibido con los hashes para encontrar el registro correcto
    let tokenRecord: TokenWithLogin | null = null;
    for (const token of potentialTokens) {
      if (
        token.REFRESH_TOKEN &&
        (await bcrypt.compare(refreshToken, token.REFRESH_TOKEN))
      ) {
        tokenRecord = token;
        break;
      }
    }

    if (!tokenRecord) {
      return this.responseService.error('El token de refresco es inválido o ha expirado.', HttpStatus.NOT_FOUND);
    }
    // 3. Siempre generamos un nuevo Access Token
    const accessPayload = {
      sub:this.hash.encode(tokenRecord.login.IDLOGIN),
      username: tokenRecord.login.USUARIO_LOGIN,
      jti: uuidv4(),
    };
    const newAccessToken = this.jwtService.sign(accessPayload, {
      expiresIn: '12h',
    });

    const decodedAccessToken = this.jwtService.decode(newAccessToken) as {
      exp: number;
    };
    const accessTokenExpires = new Date(decodedAccessToken.exp * 1000);

    // --- LÓGICA DE REUTILIZACIÓN DEL REFRESH TOKEN ---
    let finalRefreshToken = refreshToken; // Por defecto, reutilizamos el token actual
    let finalHashedRefreshToken = tokenRecord.REFRESH_TOKEN;
    let finalRefreshTokenExpires = tokenRecord.REFRESH_EXPIRES;

    // 4. Calculamos el umbral: 12 horas a partir de ahora
    const threshold = new Date();
    threshold.setHours(threshold.getHours() + 24);

    // 5. Comparamos si la fecha de expiración del token está dentro de las próximas 12 horas
    if (
      tokenRecord.REFRESH_EXPIRES &&
      tokenRecord.REFRESH_EXPIRES < threshold
    ) {
      console.log(
        'El token de refresco está por expirar. Generando uno nuevo.',
      );

      // Si está a punto de caducar, generamos uno nuevo
      finalRefreshToken = randomBytes(64).toString('hex');
      finalHashedRefreshToken = await bcrypt.hash(finalRefreshToken, 10);
      finalRefreshTokenExpires = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ); // 30 días de vida
    }

    // 6. Actualizamos el registro en la base de datos con los tokens finales
    await this.prisma.token.update({
      where: { IDTOKEN: tokenRecord.IDTOKEN },
      data: {
        CODIGO_TOKEN: newAccessToken,
        VENCIMIENTO_TOKEN: accessTokenExpires,
        REFRESH_TOKEN: finalHashedRefreshToken, // Puede ser el nuevo o el antiguo
        REFRESH_EXPIRES: finalRefreshTokenExpires, // Puede ser la nueva fecha o la antigua
        FECHA_TOKEN: new Date(),
      },
    });

    // 7. Devolvemos el par de tokens al cliente
    return this.responseService.success('Token refrescado exitosamente.', {
      accessToken: newAccessToken,
      refreshToken: finalRefreshToken, // Devolvemos el token que corresponda (nuevo o antiguo)
      username: tokenRecord.login.USUARIO_LOGIN
    });
  }

  /**
   * Cierra la sesión del usuario eliminando su token de la base de datos.
   */
  /**
 * Cierra la sesión del usuario eliminando su token y limpiando la relación con el dispositivo.
 */
async logout(authHeader: string, deviceId?: string) {
  // 1. Validación de encabezado
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return this.responseService.error(
      'Encabezado de autorización inválido o ausente.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  const token = authHeader.split(' ')[1];

  try {
    // 2. Buscar el token y validar su existencia
    const tokenRecord = await this.prisma.token.findFirst({
      where: { CODIGO_TOKEN: token },
      include: { login: true },
    });

    if (!tokenRecord) {
      return this.responseService.error(
        'Este token ya no es válido o ya fue eliminado.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Ejecutar limpieza en una transacción
    await this.prisma.$transaction(async (tx) => {
      
      // Borrar el token físico
      await tx.token.delete({
        where: { IDTOKEN: tokenRecord.IDTOKEN },
      });

      // Si se pasó un deviceId, desconectar/limpiar la relación de dispositivo
      if (deviceId) {
        const device = await tx.dispositivos.findFirst({
          where: { DEVICE_ID: deviceId },
        });

        if (device) {
          // Eliminamos la relación específica entre este login y este dispositivo
          await tx.login_dispositivos.deleteMany({
            where: {
              IDLOGIN: tokenRecord.IDLOGIN,
              IDDISPOSITIVO: device.ID_DISPOSITIVO,
            },
          });
        }
      }
    });

    return this.responseService.success('Sesión cerrada y dispositivo desvinculado exitosamente.');

  } catch (error) {
    console.error('Error durante el logout:', error);
    return this.responseService.error(
      'No se pudo procesar el cierre de sesión.',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

  async getProfile(userId: number) {
    // 2. Llama al método del servicio inyectado dentro de un try...catch
    try {
      // El formateador ahora se encarga de buscar en la BD y transformar los datos.
      const formattedProfile = await this.profile.privateProfile(userId);

      // Si tiene éxito, devuelve la respuesta formateada.
      return this.responseService.success(
        'Perfil obtenido exitosamente.',
        formattedProfile,
      );
    } catch (error) {
      // 3. Si fetchAndFormatProfile lanza una excepción (ej. NotFoundException),
      // la capturamos y devolvemos una respuesta de error estandarizada.
      return this.responseService.error(error.message, HttpStatus.NOT_FOUND);
    }
  }

  /**
   * Actualiza el perfil de un usuario, incluyendo datos, avatar y validaciones de unicidad.
   * @param userId - ID del usuario autenticado.
   * @param dto - Datos del perfil a actualizar.
   * @param file - (Opcional) Nuevo archivo de avatar.
   */
  async updateProfile(
    userId: number,
    dto: UpdateProfileDto,
    file?: Express.Multer.File | null,
  ) {
    // 1. Obtener datos actuales
    const login = await this.prisma.login.findUnique({
      where: { IDLOGIN: userId },
      include: {
        usuarios: {
          select: {
            AVATAR_USUARIO: true,
            NOMBRE_USUARIO: true,
            APELLIDO_USUARIO: true,
            DNI_USUARIO: true,
            CELULAR_USUARIO: true,
            TIPO_DOCUMENTO_USUARIO: true,
          },
        },
      },
    });

    if (!login) {
      return this.responseService.error(
        'Usuario no encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }

    // Preparación de datos para actualizar
    const oldAvatarFilename = login.usuarios?.AVATAR_USUARIO;
    let newAvatarFilename: string | null = null;
    let s3KeyToDelete: string | null = null;
    let emailChanged = false;

    const loginDataToUpdate: any = { FECHA_EDICION_LOGIN: new Date() };
    const userDataToUpdate: any = {};

    if (dto.username) loginDataToUpdate.USUARIO_LOGIN = dto.username;
    if (dto.email && dto.email !== login.EMAIL_LOGIN) {
      loginDataToUpdate.EMAIL_LOGIN = dto.email;
      loginDataToUpdate.IDVERIFICACION = 8;
      emailChanged = true;
    }

    // Mapeo de datos de usuario
    if (dto.nombre) userDataToUpdate.NOMBRE_USUARIO = dto.nombre;
    if (dto.apellido) userDataToUpdate.APELLIDO_USUARIO = dto.apellido;
    if (dto.dni) userDataToUpdate.DNI_USUARIO = dto.dni;
    if (dto.tipo_documento)
      userDataToUpdate.TIPO_DOCUMENTO_USUARIO = dto.tipo_documento;
    if (dto.celular) userDataToUpdate.CELULAR_USUARIO = dto.celular;
    if (dto.genero) userDataToUpdate.GENERO_USUARIO = dto.genero;
    if (dto.fecha_nacimiento)
      userDataToUpdate.FECHA_NACIMIENTO_USUARIO = new Date(
        dto.fecha_nacimiento,
      );
    if (dto.id_pais) userDataToUpdate.IDPAIS = dto.id_pais;
    if (dto.public_profile !== undefined)
      userDataToUpdate.PUBLIC_PROFILE = dto.public_profile;
    if(dto.notificaciones_push !== undefined)
      userDataToUpdate.NOTIFICACION_PUSH= dto.notificaciones_push
    if(dto.notificaciones_email !== undefined)
      userDataToUpdate.NOTIFICACION_EMAIL= dto.notificaciones_email

    try {
      // Lógica de Avatar S3 (Igual que tu código)
      if (file) {
        newAvatarFilename = await this.s3Service.uploadFile(
          file,
          'avatars',
          login.USUARIO_LOGIN,
        );
        userDataToUpdate.AVATAR_USUARIO = newAvatarFilename;
        if (oldAvatarFilename) s3KeyToDelete = oldAvatarFilename;
      } else if (dto.avatar === '' || dto.avatar === null) {
        userDataToUpdate.AVATAR_USUARIO = null;
        if (oldAvatarFilename) s3KeyToDelete = oldAvatarFilename;
      }

      // 🔥 INICIO TRANSACCIÓN INTERACTIVA 🔥
      await this.prisma.$transaction(async (tx) => {
        // 1. Actualizar Login
        if (Object.keys(loginDataToUpdate).length > 0) {
          await tx.login.update({
            where: { IDLOGIN: userId },
            data: loginDataToUpdate,
          });
        }

        // 2. Actualizar Usuario
        if (Object.keys(userDataToUpdate).length > 0) {
          await tx.usuarios.update({
            where: { IDLOGIN: userId },
            data: userDataToUpdate,
          });
        }

        // 3. 🧾 Lógica de Factura (Integrada aquí)
        // Preparamos los datos combinando lo que viene en el DTO (nuevo) con lo que ya existe en BD (si no se envió nuevo)
        const facturaData = {
          email: dto.email || login.EMAIL_LOGIN,
          // Usamos el operador ? para asegurar acceso seguro
          nombre: dto.nombre || login.usuarios?.NOMBRE_USUARIO,
          apellido: dto.apellido || login.usuarios?.APELLIDO_USUARIO,
          celular: dto.celular || login.usuarios?.CELULAR_USUARIO,
          dni: dto.dni || login.usuarios?.DNI_USUARIO,
          tipo_identificacion:
            dto.tipo_documento || login.usuarios?.TIPO_DOCUMENTO_USUARIO,
        };
        // Llamamos a la función privada pasando el cliente de transacción 'tx'
        await this.addOrUpdateFactura(tx, userId, facturaData);
      });
      // 🔥 FIN TRANSACCIÓN 🔥

      // Acciones post-transacción (Side effects)
      if (emailChanged && dto.email) {
        await this.change_email_otp(dto.email);
      }

      if (s3KeyToDelete) {
        await this.s3Service.deleteFile('avatars', s3KeyToDelete);
      }

      const updatedProfile = await this.profile.privateProfile(userId);
      return this.responseService.success(
        'Perfil actualizado exitosamente.',
        updatedProfile,
      );
    } catch (error) {
      if (newAvatarFilename) {
        await this.s3Service.deleteFile('avatars', newAvatarFilename);
      }
      if (error.code === 'P2002') {
        return this.responseService.error(
          `El valor para '${error.meta.target.join(', ')}' ya está en uso.`,
          HttpStatus.CONFLICT,
        );
      }
      console.error('Error al actualizar el perfil:', error);
      return this.responseService.error(
        'No se pudo actualizar el perfil.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Réplica de la función Symfony add_factura.
   * Busca una factura existente para el usuario. Si no existe, la crea. Si existe, la actualiza.
   * Utiliza el TransactionClient para garantizar atomicidad.
   */
  private async addOrUpdateFactura(
    tx: any, // Tipo: Prisma.TransactionClient
    userId: number,
    data: {
      email?: string;
      nombre?: string;
      apellido?: string | null;
      celular?: string | null;
      dni?: string | null;
      tipo_identificacion?: string | null;
    },
  ) {
    // 1. Buscar si existe factura (Equivalente a findOneBy(['login' => $user]))
    // Asumimos que tu tabla se llama 'factura' y tiene una relación con login via IDLOGIN
    const facturaExistente = await tx.factura.findFirst({
      where: { IDLOGIN: userId },
      orderBy: { FECHA_FACTURA: 'asc' }, // Replica el comportamiento del 'else' en Symfony
    });

    if (!facturaExistente) {
      // --- CREAR NUEVA (Equivalente al if ($factura === null)) ---
      await tx.factura.create({
        data: {
          IDLOGIN: userId, // Relación con el usuario
          EMAIL_CLIENTE: data.email,
          NOMBRE_CLIENTE: data.nombre,
          APELLIDO_CLIENTE: data.apellido,
          TELEFONO_CLIENTE: data.celular,
          DNI_CLIENTE: data.dni,
          TIPO_IDENTIFICACION: data.tipo_identificacion,
          // Agrega aquí campos obligatorios adicionales (ej: fecha de creación)
          FECHA_FACTURA: new Date(),
        },
      });
    } else {
      // --- ACTUALIZAR EXISTENTE (Equivalente al else) ---
      await tx.factura.update({
        where: { IDFACTURA: facturaExistente.IDFACTURA }, // Usamos el ID de la factura encontrada
        data: {
          EMAIL_CLIENTE: data.email,
          NOMBRE_CLIENTE: data.nombre,
          APELLIDO_CLIENTE: data.apellido,
          TELEFONO_CLIENTE: data.celular,
          DNI_CLIENTE: data.dni,
          TIPO_IDENTIFICACION: data.tipo_identificacion,
        },
      });
    }
  }

  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;

    const login = await this.prisma.login.findFirst({
      where: { IDLOGIN: userId },
    });

    if (!login || !login.PASSWORD_LOGIN) {
      return this.responseService.error(
        'Usuario no encontrado o no tiene una contraseña configurada.',
        HttpStatus.NOT_FOUND,
      );
    }

    // ---------------------------------------------------------
    // 🛠️ CORRECCIÓN AQUÍ
    // Comparamos la contraseña vieja (input) contra el HASH DE LA BD
    // ---------------------------------------------------------
    const isOldPasswordValid = await this.hash_password.comparePasswords(
      oldPassword,
      login.PASSWORD_LOGIN, // <--- ESTO ES LO CORRECTO
    );

    if (!isOldPasswordValid) {
      return this.responseService.error(
        'La contraseña actual es incorrecta.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (oldPassword === newPassword) {
      return this.responseService.error(
        'La nueva contraseña no puede ser igual a la anterior.',
        HttpStatus.BAD_REQUEST,
      );
    }

    

     try {
         const hashedNewPassword =await this.hash_password.hashPassword(newPassword);
      // 🛑 CORRECCIÓN: Agregamos 'return' antes del await para devolver el resultado al controlador
      return await this.prisma.$transaction(async (tx) => {
        
        // A. Actualizar Password
        await tx.login.update({
          where: { IDLOGIN: userId },
          data: { PASSWORD_LOGIN: hashedNewPassword },
        });

        // B. Invalidar todas las sesiones (Tokens) anteriores
        // Esto obliga al usuario a loguearse de nuevo con la nueva clave
        await tx.token.deleteMany({
          where: {
            IDLOGIN: userId
          }
        });
        
        // Retornamos el éxito desde dentro de la transacción
        return this.responseService.success('Contraseña actualizada exitosamente. Por favor inicia sesión nuevamente.');
      });

    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      return this.responseService.error(
        'No se pudo actualizar la contraseña. Inténtalo de nuevo.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    
  }

  async change_email_otp(email: string) {
    const login = await this.prisma.login.findUnique({
      where: { EMAIL_LOGIN: email },
    });

    if (!login) {
      return this.responseService.success(
        'Si existe una cuenta asociada a este correo, se ha enviado un nuevo código.',
      );
    }

    if (login.IDVERIFICACION === 7) {
      return this.responseService.error(
        'Esta cuenta ya ha sido verificada.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // --- NUEVA VALIDACIÓN AQUÍ ---
    // 1. Buscamos si ya existe un OTP activo (no usado y no expirado)
    const activeOtp = await this.prisma.opt.findFirst({
      where: {
        IDLOGIN: login.IDLOGIN,
        USADO: false,
        TIPO: 'CUENTA',
        createdAt: new Date(),
        expiresAt: {
          gt: new Date(), // 'gt' significa 'greater than' (mayor que la fecha actual)
        },
      },
    });

    // 2. Si se encuentra un OTP activo, se bloquea la creación de uno nuevo.
    if (activeOtp) {
      return this.responseService.error(
        'Ya tienes un código activo. Por favor, espera a que expire antes de solicitar uno nuevo.',
        HttpStatus.TOO_MANY_REQUESTS, // 429 es el código ideal para limitar peticiones
      );
    }

    // Contamos solo los OTPs que no han sido usados para este usuario.
    const otps = await this.prisma.opt.count({
      where: {
        IDLOGIN: login.IDLOGIN,
        USADO: false,
        TIPO: 'CUENTA', // Corregido a minúsculas para coincidir con el modelo
      },
    });

    if (otps >= 3) {
      return this.responseService.error(
        'Solo se permite un máximo de 3 códigos activos a la vez.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const payload = { email: login.EMAIL_LOGIN, otp: otpCode, resend: true };
    const newVerificationToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    await this.prisma.opt.create({
      data: {
        OTP: parseInt(otpCode), // Corregido a minúsculas
        TOKEN: newVerificationToken, // Corregido a minúsculas
        TIPO: 'CUENTA', // Corregido a minúsculas
        createdAt: new Date(),
        expiresAt: expiresAt,
        IDLOGIN: login.IDLOGIN,
      },
    });

    await this.emailService.sendVerificationOtp(
      login.EMAIL_LOGIN,
      otpCode,
      'Has cambiado tu correo electronico.',
      'Verifica tu cueenta con este codigo para volver a utilizar la app',
      login.USUARIO_LOGIN,
    );

    return this.responseService.success(
      'Si existe una cuenta pendiente de verificación, se ha enviado un nuevo código.',
    );
  }

  async validate_exist_user(field: string, value: string) {
    const allowedFields = ['email', 'username', 'celular'];
    let message: string = '';
    try {
      // 1️⃣ Validar campo
      if (!field || !allowedFields.includes(field)) {
        return this.responseService.error(
          `Campo no soportado. Debe ser uno de: ${allowedFields.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 2️⃣ Normalizar valor
      let normalized = value ?? '';
      if (field === 'email') normalized = normalized.trim().toLowerCase();
      else if (field === 'celular') normalized = normalized.replace(/\D+/g, '');
      else normalized = normalized.trim();

      if (!normalized) {
        return this.responseService.error(
          'Valor inválido',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 3️⃣ Variable donde guardaremos el usuario encontrado
      let userFound: any = null;
      message = '';

      // 4️⃣ Buscar según campo
      switch (field) {
        case 'email':
          userFound = await this.prisma.login.findFirst({
            where: { EMAIL_LOGIN: normalized },
          });
          message = userFound
            ? 'El correo ya está registrado'
            : 'Correo válido';
          break;

        case 'username':
          userFound = await this.prisma.login.findFirst({
            where: { USUARIO_LOGIN: normalized },
          });
          message = userFound
            ? 'El nombre de usuario ya está registrado'
            : 'Nombre de usuario válido';
          break;

        case 'celular':
          // Primero busca en la tabla usuarios (MySQL: una tabla directa)
          userFound = await this.prisma.usuarios.findFirst({
            where: { CELULAR_USUARIO: normalized },
          });

          // Si no existe en usuarios, prueba buscar en login -> usuarios (si hay relación 1:1 usa 'is', si es 1:N usar 'some')
          if (!userFound) {
            userFound = await this.prisma.login.findFirst({
              where: {
                usuarios: {
                  is: { CELULAR_USUARIO: normalized },
                },
              },
            });
          }

          message = userFound
            ? 'El número ya está registrado'
            : 'Número válido';
          break;
      }

      // 5️⃣ Responder con responseService
      if (userFound) {
        return this.responseService.error(message, HttpStatus.CONFLICT);
      }

      return this.responseService.success(message);
    } catch (error) {
      return this.responseService.error(
        message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
