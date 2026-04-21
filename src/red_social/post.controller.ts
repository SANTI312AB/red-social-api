import {
  Controller,
  Post,
  Body,
  Request,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Patch,
  Param,
  ParseIntPipe,
  Delete,
  UploadedFile,
  Get,
  Query,
  ParseBoolPipe,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';

import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UpdatePostDto } from './dto/update-post.dto';
import { ApiController } from 'src/auth/guards/api_controler';
import { CreateHotspotDto } from './dto/create-hotspot.dto';
import { UpdateHotspotDto } from './dto/update-hotspot.dto';
import { UserPostsQueryDto } from './dto/user-posts-query.dto';
import { ParseHashIdPipe } from 'src/utilis/pipes/parse-hash-id.pipe';

@ApiTags('Posts')
@ApiBearerAuth()
@Controller('api')
export class PostController extends ApiController {
  constructor(private postService: PostService) {
    super();
  }

  @Get('posts')
  @ApiOperation({
    summary: 'Listar todas las publicaciones o una específica del usuario',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Publicación(es) obtenida(s) exitosamente.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No se encontró el recurso.',
  })
  listPosts(
    @Request() req,
    // 1. Usamos el DTO para capturar y validar todos los query params
    @Query() query: UserPostsQueryDto,
  ) {
    const userId = req.user.IDLOGIN;

    // 2. Pasamos los valores ya transformados al servicio
    return this.postService.listPosts(
      userId,
      query.postId,
      query.mis_comentados,
      query.mis_reaccionados,
      query.posts_guardados,
      query.page,
      query.limit,
    );
  }

  @Post('post')
  @UseInterceptors(FilesInterceptor('multimedia', 10)) // Acepta hasta 10 archivos en el campo 'multimedia'
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Crear una nueva publicación' })
  @ApiResponse({ status: 201, description: 'Publicación creada exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  create(
    @Request() req,
    @Body() createPostDto: CreatePostDto,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 }), // 10 MB por archivo
          new FileTypeValidator({
            fileType: '.(png|jpeg|jpg|gif|webp|mp4|mov|avi)',
          }),
        ],
        fileIsRequired: false, // Los archivos son opcionales al crear un post
      }),
    )
    files?: Express.Multer.File[],
  ) {
    const userId = req.user.IDLOGIN;
    return this.postService.createPost(userId, createPostDto, files);
  }

  @Patch('post/:id')
  @UseInterceptors(FileInterceptor('multimedia')) // Acepta un solo archivo para añadir o reemplazar
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar una publicación existente' })
  @ApiParam({
    name: 'id',
    description: 'ID de la publicación a actualizar',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Publicación actualizada exitosamente.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'No tienes permiso para editar esta publicación.',
  })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada.' })
  update(
    @Request() req,
    @Param('id', ParseHashIdPipe) id: any,
    @Body() dto: UpdatePostDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: '.(png|jpeg|jpg|gif|webp|mp4|mov|avi)',
          }),
        ],
        fileIsRequired: false, // El archivo es opcional al actualizar
      }),
    )
    file?: Express.Multer.File,
  ) {
    const userId = req.user.IDLOGIN;
    return this.postService.updatePost(userId, id, dto, file);
  }

  @Delete('post/:id')
  @ApiOperation({ summary: 'Eliminar una publicación' })
  @ApiParam({
    name: 'id',
    description: 'ID de la publicación a eliminar',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Publicación eliminada exitosamente.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'No tienes permiso.' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada.' })
  deletePost(@Request() req, @Param('id', ParseHashIdPipe) id: any) {
    const userId = req.user.IDLOGIN;
    return this.postService.deletePost(userId, id);
  }

  @Post('hotspot/:multimediaId')
  @ApiOperation({ summary: 'Añadir un nuevo hotspot a un elemento multimedia' })
  @ApiParam({
    name: 'multimediaId',
    description: 'ID del elemento multimedia (imagen/video)',
    type: String,
  })
  @ApiResponse({ status: 201, description: 'Hotspot añadido exitosamente.' })
  @ApiResponse({
    status: 404,
    description: 'Elemento multimedia no encontrado o sin permisos.',
  })
  addHotspot(
    @Request() req,
    @Param('multimediaId', ParseHashIdPipe) multimediaId: any,
    @Body() dto: CreateHotspotDto,
  ) {
    const userId = req.user.IDLOGIN;
    return this.postService.addHotspot(userId, multimediaId, dto);
  }

  @Patch('hotspot/:hotspotId')
  @ApiOperation({ summary: 'Actualizar un hotspot existente' })
  @ApiParam({
    name: 'hotspotId',
    description: 'ID del hotspot a actualizar',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Hotspot actualizado exitosamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'Hotspot no encontrado o sin permisos.',
  })
  updateHotspot(
    @Request() req,
    @Param('hotspotId', ParseHashIdPipe) hotspotId: any,
    @Body() dto: UpdateHotspotDto,
  ) {
    const userId = req.user.IDLOGIN;
    return this.postService.updateHotspot(userId, hotspotId, dto);
  }

  @Delete('hotspot/:hotspotId')
  @ApiOperation({ summary: 'Eliminar un hotspot existente' })
  @ApiParam({
    name: 'hotspotId',
    description: 'ID del hotspot a eliminar',
    type: String,
  })
  @ApiResponse({ status: 200, description: 'Hotspot eliminado exitosamente.' })
  @ApiResponse({
    status: 404,
    description: 'Hotspot no encontrado o sin permisos.',
  })
  deleteHotspot(
    @Request() req,
    @Param('hotspotId', ParseHashIdPipe) hotspotId: any,
  ) {
    const userId = req.user.IDLOGIN;
    return this.postService.deleteHotspot(userId, hotspotId);
  }
}
