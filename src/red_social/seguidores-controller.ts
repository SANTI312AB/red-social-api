import { ApiController } from "src/auth/guards/api_controler";

import { Body, Controller, Delete, Get, HttpStatus, Optional, Param, ParseBoolPipe, ParseEnumPipe, Patch, Post, Query, Request } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SeguidoresService } from "./seguidores.service";
import { EstadoSeguidorDto } from "./dto/estado-seguidor.dto";
import { SeguidoresQueryDto } from "./dto/seguidores-query.dto";

@ApiTags('Seguidores')
@ApiBearerAuth()
@Controller('api')
export class SeguidoresController extends ApiController {
    constructor(private seguidoresService: SeguidoresService) {
        super();
    }

  @Get('seguidores')
  @ApiOperation({
    summary: 'Obtener la lista de seguidores y seguidos del usuario autenticado',
  })
  // Swagger lee automáticamente el DTO, no necesitas @ApiQuery
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de seguidores y seguidos obtenida correctamente.',
  })
  async obtenerSeguidores(
    @Request() req,
    // ✅ Usamos el DTO para validar, transformar y documentar todo
    @Query() query: SeguidoresQueryDto,
  ) {
    const userId = req.user.IDLOGIN;

    // Ya no necesitamos convertir 'orden' manualmente a minúsculas,
    // el DTO (@Transform) ya lo hizo por nosotros.

    return this.seguidoresService.obtenerSeguidores(
      userId,
      query.seguidores,
      query.seguidos,
      query.estado, // string | undefined
      query.orden,  // 'asc' | 'desc' | undefined
      query.username,
      query.page,
      query.limit
    );
  }

  @Post('seguir/:username')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seguir a un usuario por su username' })
  @ApiResponse({ status: 200, description: 'Has seguido al usuario correctamente.' })
  @ApiResponse({ status: 400, description: 'No puedes seguirte a ti mismo o ya sigues a este usuario.' })
  @ApiResponse({ status: 404, description: 'El usuario que intentas seguir no existe.' })
  @ApiResponse({ status: 500, description: 'Error al seguir al usuario.' })
  async seguirUsuario(
    @Request() req,
    @Param('username') username: string,
  ) {
    const userId = req.user?.IDLOGIN;
    if (!userId) {
      return {
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Usuario no autenticado',
      };
    }

    return await this.seguidoresService.seguirUsuario(username, userId);
  }

    @Delete('dejar-de-seguir/:username')
    @ApiOperation({ summary: 'Dejar de seguir a un usuario por su nombre de usuario' })
    @ApiResponse({ status: 200, description: 'Has dejado de seguir al usuario correctamente.' })
    @ApiResponse({ status: 404, description: 'El usuario que intentas dejar de seguir no existe. | No sigues a este usuario.' })
    @ApiResponse({ status: 500, description: 'Error al dejar de seguir al usuario.' })
    async dejarDeSeguirUsuario(@Request() req, @Param('username') username: string) {
        const userId = req.user.IDLOGIN;
        return this.seguidoresService.dejarDeSeguirUsuario(username, userId);
    }

    @Patch('actualizar-seguidor/:username')
    @ApiOperation({ summary: 'Actualizar el estado de un seguidor' })
    @ApiResponse({ status: 200, description: 'Estado del seguidor actualizado correctamente.' })
    @ApiResponse({ status: 400, description: 'El estado del seguidor debe ser uno de los siguientes: PENDING, ACCEPTED, REJECTED.' })
    @ApiResponse({ status: 404, description: 'El usuario seguidor no existe. | No tienes un seguidor con este usuario.' })
    @ApiResponse({ status: 500, description: 'Error al actualizar el estado del seguidor.' })
    async actualizarEstadoSeguidor(@Request() req, @Param('username') username: string, @Body() dto: EstadoSeguidorDto) {
        const userId = req.user.IDLOGIN;
        return this.seguidoresService.actualizarEstadoSeguidor(username, userId, dto);
    }
}