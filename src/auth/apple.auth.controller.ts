import { Controller, Get, Post, Query, Body, Res, BadRequestException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AppleAuthService } from './apple.auth.service';
import { ResponseService } from 'src/Interfaces/response.service';
import { ConfigDbService } from 'src/config-db/config-db.service';
import { PrismaService } from 'src/prisma/prisma.service';
// Importa tu AppleAuthService y ConfigDbService

@ApiTags('Apple')
@Controller('connect/apple')
export class AppleAuthController {
  constructor(
    private readonly appleAuthService: AppleAuthService,
    private responseService: ResponseService,
    private readonly configService: ConfigDbService,
    private prisma: PrismaService,

  ) {}

  @Get()
  @ApiOperation({ summary: 'Retorna el link de login de APPLE' })
  @ApiQuery({ name: 'redirect_to', required: false, description: 'Path de redirección' })
  async connectAction(@Query('redirect_to') redirectTo: string = '/') {

     const apple= await this.prisma.metodos_logeo.findFirst({
          where: { ID_METODO_LOGEO: 2,
            HABILITADO_METODO_LOGEO: true
           },
        })
    
        if (!apple) {
          return this.responseService.error(
            'El método de autenticación Apple no está habilitado.',
            HttpStatus.BAD_REQUEST,
          );
        }
    // Aquí puedes meter la validación de si está habilitado (isEnable) como tenías en PHP
    const encodedState = encodeURIComponent(redirectTo);
    const authorizationUrl = await this.appleAuthService.getAuthorizationUrl(encodedState);
    
    return {
      message: 'Link retornado con éxito.',
      data: { url: authorizationUrl }
    };
  }

  @Post('callback')
  @ApiOperation({ summary: 'Verifica login de usuario Apple' })
  async callbackAction(
    @Body('code') code: string,
    @Body('state') state: string,
    @Body('user') userJson: string, // Apple solo lo envía la primera vez
    @Res() res: Response
  ) {
    if (!code) {
      throw new BadRequestException('Authorization code is missing.');
    }
    // Procesamos todo en el servicio
    const { accessToken, refreshToken, state: redirectPath } = await this.appleAuthService.processAppleCallback(code, state, userJson);
    // Redirección al frontend (Como tenías en PHP)
    const urlFront = await this.configService.getFrontUrlConfig(); // Traes la URL de tu BD 'front'
    const finalUrl = `${urlFront.url}/token?accessToken=${accessToken}&refreshToken=${refreshToken}&redirect_to=${redirectPath}`;
    
    // Puedes retornar JSON o hacer un redirect real según necesite tu frontend
    return this.responseService.success('Login exitoso.', { url: finalUrl });
    
  }
}