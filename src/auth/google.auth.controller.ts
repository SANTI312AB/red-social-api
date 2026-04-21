import { Controller, Get, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigDbService } from 'src/config-db/config-db.service'; // 👈 1. Importar
import { URLSearchParams } from 'url'; // 👈 3. Importar
import { ResponseService } from 'src/Interfaces/response.service';
import { GoogleAuthService } from './google.auth.service';
import { PrismaService } from 'src/prisma/prisma.service';

@ApiTags('GoogleAuth') // 👈 Renombrado para agrupar
@Controller('') // 👈 Asumí la ruta base 'auth'
export class GoogleAuthController {
  // 4. Inyectar los servicios necesarios
  constructor(
    private readonly authService: GoogleAuthService,
    private readonly configService: ConfigDbService,
    private responseService: ResponseService,
    private prisma: PrismaService,
  ) { }

  @Get('google')
  @ApiOperation({ summary: '1. Obtener la URL de redirección de Google' })
  async googleAuth(/* @Req() req */) {
    // 6. Lógica para construir y devolver la URL

    const google= await this.prisma.metodos_logeo.findFirst({
      where: { ID_METODO_LOGEO: 1,
        HABILITADO_METODO_LOGEO: true
       },
    })

    if (!google) {
      return this.responseService.error(
        'El método de autenticación Google no está habilitado.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
       const googleConfig = await this.configService.getgoogle_config();

    const scope = 'email profile';

    const params = new URLSearchParams({
      client_id: googleConfig.client_id,
      redirect_uri: googleConfig.callback_url,
      response_type: 'code',
      scope: scope,
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // 7. Devolver la URL como JSON
    return this.responseService.success('Link de google obtenido.', googleAuthUrl);
      
    } catch (error) {

        return this.responseService.error(
                'Ocurrió un error con  los servicios de google.',
                HttpStatus.INTERNAL_SERVER_ERROR,
                error
              );
      
    }
  }

  @Get('google/callback')
  @ApiOperation({ summary: '2. Callback de Google (Procesa el login)' })
  @UseGuards(AuthGuard('google')) // El guard se mantiene aquí
  async googleAuthRedirect(@Req() req) {
    // 1. 'req.user' contiene el registro 'login' completo
    //    que devolviste desde GoogleStrategy -> GoogleAuthService
    const loginData = req.user; // <-- 'loginData' es el objeto { IDLOGIN, EMAIL_LOGIN, ... }

    // 2. Llama a tu servicio para generar el token JWT final
    return this.authService.loginFromGoogle(loginData);
  }
}