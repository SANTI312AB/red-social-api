import { ApiController } from "src/auth/guards/api_controler";
import { FavoritosService } from "./favoritos.service";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Controller, Get, HttpStatus, Param, Post, Request } from "@nestjs/common";

@ApiBearerAuth()
@Controller('api')
export class FavoritosController extends ApiController {
  constructor(private favoritosService: FavoritosService) {
    super();
  }

  @ApiTags('Posts')
  @Post('guardar-post/:slug')
  @ApiOperation({
    summary:
      'Añade o quita un post a  tu lista de guardados.',
  })
  @ApiParam({
    name: 'slug',
    description: 'El slug del post a añadir a la lista de guardados.',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Post añadido a la lista de guardados.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'El post no fue encontrado.',
  })
  guardarOEliminarGuardado(@Request() req, @Param('slug') slug: string) {
    const userId = req.userId;
    return this.favoritosService.guardad_post(userId, slug);
  }


}