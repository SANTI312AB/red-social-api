import { ApiController } from "src/auth/guards/api_controler";
import { CometariosService } from "./comentarios.service";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Body, Controller, Delete, Param, ParseIntPipe, Patch, Post, Request } from "@nestjs/common";
import { CreateReaccionDto } from "./dto/reaction.dto";
import { CreateComentarioDto } from "./dto/create-comentario.dto";
import { UpdateComentarioDto } from "./dto/update-comentario.dto";
import { CreateRespuestaDto } from "./dto/create-respuesta.dto";
import { UpdateRespuestaDto } from "./dto/update-respuesta.dto";
import { ParseHashIdPipe } from "src/utilis/pipes/parse-hash-id.pipe";

@ApiTags('Posts')
@ApiBearerAuth()
@Controller('api')
export class CometariosController extends ApiController{
    constructor(private comentarioService: CometariosService){
        super()
    }


  @Post('reaccion/:slug')
  @ApiOperation({ summary: 'Crear o actualizar la reacción de un usuario en un post' })
  @ApiParam({ name: 'slug', description: 'Slug de la publicación a la que se va a reaccionar', type:String })
  @ApiResponse({ status: 200, description: 'Reacción guardada exitosamente.' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada.' })
  reaccionar(
    @Request() req,
    @Param('slug') slug: string,
    @Body() dto: CreateReaccionDto,
  ) {
    const userId = req.user.IDLOGIN;
    return this.comentarioService.reaccion(userId, slug, dto);
  }

  @Delete('reaccion/:slug')
  @ApiOperation({ summary: 'Eliminar la reacción de un usuario en un post' })
  @ApiParam({ name: 'slug', description: 'Slug de la publicación de la que se eliminará la reacción', type: String })
  @ApiResponse({ status: 200, description: 'Reacción eliminada exitosamente.' })
  @ApiResponse({ status: 404, description: 'Reacción no encontrada para eliminar.' })
  removeReaccion(
    @Request() req,
    @Param('slug') slug: string,
  ) {
    const userId = req.user.IDLOGIN;
    return this.comentarioService.remove_reaccion(userId, slug);
  }


  @Post('comentario/:slug')
  @ApiOperation({ summary: 'Añadir un nuevo comentario a una publicación' })
  @ApiParam({ name: 'slug', description: 'Slug de la publicación a comentar', type: String })
  @ApiResponse({ status: 201, description: 'Comentario añadido exitosamente.' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada.' })
  addComentario(
    @Request() req,
    @Param('slug') slug: string,
    @Body() dto: CreateComentarioDto,
  ) {
    const userId = req.user.IDLOGIN;
    return this.comentarioService.addComentario(userId, slug, dto);
  }

  @Patch('comentario/:comentarioId')
  @ApiOperation({ summary: 'Actualizar un comentario existente' })
  @ApiParam({ name: 'comentarioId', description: 'ID del comentario a actualizar', type: String })
  @ApiResponse({ status: 200, description: 'Comentario actualizado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Comentario no encontrado o no tienes permiso para editarlo.' })
  updateComentario(
    @Request() req,
    @Param('comentarioId', ParseHashIdPipe) comentarioId: any,
    @Body() dto: UpdateComentarioDto,
  ) {
    const userId = req.user.IDLOGIN;
    return this.comentarioService.updateComentario(userId, comentarioId, dto);
  }

  @Delete('comentario/:comentarioId')
  @ApiOperation({ summary: 'Eliminar un comentario existente' })
  @ApiParam({ name: 'comentarioId', description: 'ID del comentario a eliminar', type: String })
  @ApiResponse({ status: 200, description: 'Comentario eliminado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Comentario no encontrado o no tienes permiso para eliminarlo.' })
  deleteComentario(
    @Request() req,
    @Param('comentarioId', ParseHashIdPipe) comentarioId: any,
  ) {
    const userId = req.user.IDLOGIN;
    return this.comentarioService.deleteComentario(userId, comentarioId);
  }


  @Post('respuesta/:comentarioId')
  @ApiOperation({ summary: 'Añadir una nueva respuesta a un comentario' })
  @ApiParam({ name: 'comentarioId', description: 'ID del comentario al que se está respondiendo', type: String })
  @ApiResponse({ status: 201, description: 'Respuesta añadida exitosamente.' })
  @ApiResponse({ status: 404, description: 'Comentario no encontrado.' })
  addRespuesta(
    @Request() req,
    @Param('comentarioId', ParseHashIdPipe) comentarioId: any,
    @Body() dto: CreateRespuestaDto,
  ) {
    const userId = req.user.IDLOGIN;
    return this.comentarioService.addRespuesta(userId, comentarioId, dto);
  }

  @Patch('respuesta/:respuestaId')
  @ApiOperation({ summary: 'Actualizar una respuesta existente' })
  @ApiParam({ name: 'respuestaId', description: 'ID de la respuesta a actualizar', type: String })
  @ApiResponse({ status: 200, description: 'Respuesta actualizada exitosamente.' })
  @ApiResponse({ status: 404, description: 'Respuesta no encontrada o no tienes permiso para editarla.' })
  updateRespuesta(
    @Request() req,
    @Param('respuestaId', ParseHashIdPipe) respuestaId: any,
    @Body() dto: UpdateRespuestaDto,
  ) {
    const userId = req.user.IDLOGIN;
    return this.comentarioService.updateRespuesta(userId, respuestaId, dto);
  }

  @Delete('respuesta/:respuestaId')
  @ApiOperation({ summary: 'Eliminar una respuesta existente' })
  @ApiParam({ name: 'respuestaId', description: 'ID de la respuesta a eliminar', type: String })
  @ApiResponse({ status: 200, description: 'Respuesta eliminada exitosamente.' })
  @ApiResponse({ status: 404, description: 'Respuesta no encontrada o no tienes permiso para eliminarla.' })
  deleteRespuesta(
    @Request() req,
    @Param('respuestaId', ParseHashIdPipe) respuestaId: any,
  ) {
    const userId = req.user.IDLOGIN;
    return this.comentarioService.deleteRespuesta(userId, respuestaId);
  }


  @Post('like-comentario/:comentarioId')
  @ApiOperation({ summary: 'Aplica o quita un "me gusta" a un comentario de un post' })
  @ApiParam({ name: 'comentarioId', description: 'ID del comentario', type:String })
  @ApiResponse({ status: 200, description: 'Like actualizado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Comentario no encontrado.' })
  likeComentario(
    @Request() req,
    @Param('comentarioId', ParseHashIdPipe) idComentario: any,
  ) {
    const userId = req.user.IDLOGIN;
    return this.comentarioService.likes_comentario(userId, idComentario);
  }

  @Post('like-respuesta/:respuestaId')
  @ApiOperation({ summary: 'Aplica o quita un "me gusta" a una respuesta de un comentario de un post' })
  @ApiParam({ name: 'respuestaId', description: 'ID de la respuesta',type:String })
  @ApiResponse({ status: 200, description: 'Like actualizado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Respuesta no encontrada.' })
  likeRespuesta(
    @Request() req,
    @Param('respuestaId', ParseHashIdPipe) idRespuesta: any,
  ) {
    const userId = req.user.IDLOGIN;
    return this.comentarioService.likes_respuestas(userId, idRespuesta);
  }
  
}