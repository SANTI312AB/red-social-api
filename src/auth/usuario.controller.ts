import {
  Controller,
  Get,
  Post,
  Request,
  Patch,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator

} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { ApiController } from './guards/api_controler';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChangePasswordDto } from './dto/change-password.dto';
import { InjectIdsInterceptor } from 'src/utilis/inject-user.interceptor';
import { LogoutDto } from './dto/logout.dto';

@ApiTags('Usuario')
@Controller('api') 
export class UsuarioController extends ApiController {
  // 2. Heredar para ser protegido

  constructor(private authService: AuthService) {
    super(); // Llama al constructor de la clase padre
  }

  @Get('perfil') 
  @ApiOperation({ summary: 'Obtener el perfil del usuario autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Devuelve los datos del perfil del usuario.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado (token inválido o no proporcionado).',
  })
  async profile(@Request() req) {
    // El guardián ya ha verificado el token y ha puesto al usuario en `req.user`.
    const userId = req.user.IDLOGIN;

    // Llamamos a la función `getProfile` del AuthService.
    return this.authService.getProfile(userId);
  }

  
  @Patch('perfil')
  @UseInterceptors(FileInterceptor('avatar'),InjectIdsInterceptor) // Intercepta un solo archivo del campo 'avatar'
  @ApiConsumes('multipart/form-data') // Indica a Swagger que se envían datos y/o archivos
  @ApiOperation({ summary: 'Actualizar el perfil del usuario (incluyendo avatar)' })
  @ApiResponse({ status: 200, description: 'Perfil actualizado exitosamente.'})
  @ApiResponse({ status: 401, description: 'No autorizado.'})
  @ApiResponse({ status: 409, description: 'Conflicto de datos (ej. email ya en uso).'})
  updateProfile(
    @Request() req,
    @Body() dto: UpdateProfileDto,
    @UploadedFile(
      // Validador de archivo, pero es opcional
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5 MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|gif|webp)' }),
        ],
        fileIsRequired: false, // El archivo no es obligatorio
      }),
    ) file?: Express.Multer.File,
  ) {
    const userId = req.user.IDLOGIN;
    return this.authService.updateProfile(userId, dto, file);
  }


  @Patch('change-password')
  @ApiOperation({ summary: 'Cambiar la contraseña del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada exitosamente.' })
  @ApiResponse({ status: 400, description: 'La nueva contraseña no puede ser igual a la anterior.' })
  @ApiResponse({ status: 401, description: 'La contraseña actual es incorrecta.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    // El 'userId' se extrae del payload del token JWT, que el 'JwtAuthGuard' añade al objeto 'request'.
    const userId = req.user.IDLOGIN; // Asegúrate de que tu payload del token contenga 'userId'.
    return this.authService.changePassword(userId, changePasswordDto);
  }


  @Post('logout')
  @ApiOperation({ summary: 'Cerrar la sesión del usuario actual' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async logout(@Request() req, @Body() logoutDto: LogoutDto) {
    // 2. El token está en el encabezado de la petición.
    const authHeader = req.headers.authorization;
    
    // 3. Llamamos a la función de logout en el servicio, pasándole el encabezado completo.
    return this.authService.logout(authHeader, logoutDto.deviceId);
  }
}
