import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthService } from './auth.service';
import { VerifyOtpDto } from './dto/verify-otp.dto'; // <-- 1. Importar el DTO de verificación
import { RetryVerifyotp } from './dto/retry-verify-otp';
import { ResetPasswordDto } from './dto/reset-password';
import { LoginDto } from './dto/login-dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ValidateFieldDto } from 'src/red_social/dto/validate_exist_user.dto';

@ApiTags('Auth') // 👈 Agrupa los endpoints en Swagger
@Controller('')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión de usuario' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'Inicio de sesión exitoso, devuelve token de acceso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciales inválidas o cuenta no verificada.',
  })
  async login(@Body() dto: LoginDto) {
    // 2. Llama al nuevo método 'login' en el servicio
    return this.authService.login(dto);
  }

  @Post('register')
  @ApiOperation({ summary: 'Registrar un nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario registrado correctamente' })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o usuario ya existente',
  })
  async register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  // --- NUEVO ENDPOINT DE VERIFICACIÓN ---
  @Post('verify_account')
  @ApiOperation({ summary: 'Verificar cuenta de usuario con código OTP' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Cuenta verificada exitosamente.' })
  @ApiResponse({
    status: 400,
    description: 'Código OTP inválido, expirado o ya utilizado.',
  })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    // 2. Llama al método correspondiente en el servicio
    return this.authService.verifyOtp(dto);
  }

  @Post('get_verify_account_otp')
  @ApiOperation({
    summary: 'Obtener código OTP  para reintentar verificar cuenta de usuario.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Codigo enviado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Error de validacion de usuario.' })
  async retryOtp(@Body() dto: RetryVerifyotp) {
    // 2. Llama al método correspondiente en el servicio
    return this.authService.retryOTP(dto);
  }

  @Post('get_password_otp')
  @ApiOperation({ summary: 'Obtener codigo OTP pora recuperar contraseña' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Codigo enviado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Error de validacion de usuario.' })
  async reset_password_otp(@Body() dto: RetryVerifyotp) {
    // 2. Llama al método correspondiente en el servicio
    return this.authService.reset_password_otp(dto);
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Resetear la contraseña del usuario con un código OTP',
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Código OTP inválido, expirado o las contraseñas no coinciden.',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    // 2. Llama al método correspondiente en el servicio
    return this.authService.update_password_otp(dto);
  }


  @Post('refresh-token')
  @ApiOperation({ summary: 'Refrescar el token de acceso usando un refresh token' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Devuelve un nuevo par de tokens (acceso y refresco).' })
  @ApiResponse({ status: 401, description: 'El token de refresco es inválido o ha expirado.' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Post('validate-field')
  @ApiOperation({
    summary: 'Validar disponibilidad de email, username o celular',
    description:
      'Verifica si un campo (correo, nombre de usuario o celular) ya está registrado en el sistema. Devuelve un mensaje de validación.',
  })
  @ApiBody({
    type: ValidateFieldDto,
    description: 'Objeto con el campo y valor a validar.',
    examples: {
      username: {
        summary: 'Validar nombre de usuario',
        value: { field: 'username', value: 'santi123' },
      },
      email: {
        summary: 'Validar correo electrónico',
        value: { field: 'email', value: 'ejemplo@correo.com' },
      },
      celular: {
        summary: 'Validar número de celular',
        value: { field: 'celular', value: '0998765432' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Campo validado correctamente. Puede estar disponible o ya registrado.',
    schema: {
      example: {
        success: true,
        message: 'Correo válido',
        data: null,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error en la validación o campo no soportado.',
    schema: {
      example: {
        success: false,
        message: 'El correo ya está registrado',
        data: null,
      },
    },
  })
  async validateField(@Body() dto: ValidateFieldDto) {
    // Llama al servicio que implementa la lógica con Prisma y responseService
    return this.authService.validate_exist_user(dto.field, dto.value);
  }

}
