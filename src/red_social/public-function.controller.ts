import {
    Controller,
    Get,
    HttpStatus,
    Param,
    Query,
    Request,
    UseGuards,
} from '@nestjs/common';
import { PublicFunctionService } from './public-function.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtOptionalAuthGuard } from 'src/auth/guards/optional-guard';
import { SearchQueryDto } from './dto/serch-user.dto';
import { SearchTags } from './dto/search-tags.dto';
import { PublicPostsQueryDto } from './dto/public-posts-query.dto';
import { ComentariosQueryDto } from './dto/comentarios-query.dto';
import { PublicUserPostsQueryDto } from './dto/public-user-posts-query.dto';
import { SeguidoresQueryDto } from './dto/seguidores-query.dto';
import { ReaccionesQueryDto } from './dto/reacciones-query.dto';
import { GlobalSearchQueryDto } from './dto/global-search-query.dto';

@Controller()
export class PublicFunctionController {
  constructor(private publicFunctionService: PublicFunctionService) {}

  @ApiTags('Posts')
  @ApiOperation({ summary: 'Obtener lista de publicaciones públicas' })
  @ApiResponse({
    status: 200,
    description: 'Lista de publicaciones obtenida con éxito.',
  })
  @UseGuards(JwtOptionalAuthGuard)
  @ApiBearerAuth()
  @Get('public-posts')
  async publicPosts(
    @Request() req,
    @Query() query: PublicPostsQueryDto, // 👈 El DTO hace toda la validación
  ) {
    const userId = req.user?.IDLOGIN;

    return this.publicFunctionService.public_posts(
      userId,
      query.mas_comentados,
      query.mas_reaccionados,
      query.seguidos,
      query.recomendados,
      query.tag,
      query.reaccion,
      query.page,  // 👈 Nuevo campo
      query.limit  // 👈 Nuevo nombre    // 👈 Pasamos el objeto construido
    );
  }

  @ApiTags('Posts')
  @ApiOperation({ summary: 'Obtener un post por slug.' })
  @ApiResponse({
    status: 200,
    description: 'Devuelve la publicación si se encuentra y se tienen permisos.',
  })
  @ApiResponse({
    status: 404,
    description: 'Publicación no encontrada o el usuario no tiene permisos para verla.',
  })
  @UseGuards(JwtOptionalAuthGuard) // El guard que permite usuarios autenticados o anónimos
  @ApiBearerAuth() // Indica que la autenticación (opcional) es Bearer
  @Get('post/:slug') // La ruta que definiste
  @ApiParam({ // <-- CORREGIDO: Se usa ApiParam para parámetros en la URL
    name: 'slug',
    description: 'El slug único del post.',
    required: true,
    type: String,
  })
  async post_slug(
    @Param('slug') slug: string, // 1. Inyectamos el 'slug' desde la URL
    @Request() req, // 2. Inyectamos el objeto 'Request' completo
  ) {
    const userId = req.user?.IDLOGIN;
    // 4. Llamamos al servicio con el userId (o undefined) y el slug
    // El servicio se encarga de TODA la lógica de permisos.
    return this.publicFunctionService.post_slug(slug,userId);
  }

  @ApiTags('Posts')
  @Get('comentarios/:slug')
  @UseGuards(JwtOptionalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener comentarios de un post por slug' })
  @ApiParam({ name: 'slug', description: 'El slug único del post', type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Comentarios obtenidos con éxito.' })
  async comentarios(
    @Param('slug') slug: string,
    @Request() req,
    @Query() query: ComentariosQueryDto, // 👈 Usamos el DTO
  ) {
    const userId = req.user?.IDLOGIN;
    return this.publicFunctionService.comentarios(
      slug,
      query.mas_antiguos,
      query.mas_gustados,
      query.page,
      query.limit,
      userId
    );
  }

  @ApiTags('Posts')
  @Get('reacciones/:slug')
  @ApiOperation({ summary: 'Obtener reacciones de un post por slug' })
  @ApiResponse({ status: 200, description: 'Reacciones obtenidas con éxito.' })
  async reacciones(
  @Param('slug') slug: string,
  @Query() query: ReaccionesQueryDto) {
    return this.publicFunctionService.reacciones(slug, query.orderBy,query.page,query.limit);
  }

  @ApiTags('Posts')
  @UseGuards(JwtOptionalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener publicaciones por usuario' })
  @ApiParam({ name: 'username', description: 'Nombre de usuario del perfil a consultar' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Publicaciones obtenidas con éxito.' })
  @Get('posts/:username')
  async posts(
    @Param('username') username: string, // 1. Parámetro de ruta
    @Request() req: any,                 // 2. Request para obtener el usuario logueado (opcional)
    @Query() query: PublicUserPostsQueryDto,   // 3. DTO para los filtros (?slug=...&mis_comentados=...)
  ) {
    return this.publicFunctionService.posts_user(
      username,
      query.slug,
      query.mis_comentados,
      query.mis_reaccionados,
      req.user?.IDLOGIN, // Puede ser undefined si no está logueado
      query.page,
      query.limit
    );
  }

  @ApiTags('Seguidores')
  @Get('seguidores/:username')
  @ApiOperation({
    summary: 'Obtener la lista de seguidores y seguidos del usuario por su nombre de usuario',
  })
  @ApiParam({ name: 'username', description: 'Nombre de usuario del perfil a consultar' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de seguidores y seguidos obtenida correctamente.',
  })
  async obtenerSeguidores(
    // 1. Parámetro de ruta (ej: /seguidores/juan)
    @Param('username') username: string,
    @Query() query: SeguidoresQueryDto,
  ) {
    return this.publicFunctionService.seguidores(
      username,           // El usuario del perfil
      query.seguidores,   // boolean | undefined
      query.seguidos,     // boolean | undefined
      query.estado,       // 'PENDING' | ... | undefined
      query.orden,        // 'asc' | 'desc' | undefined
      query.username,     // string | undefined (equivale a tu 'serch_user')
      query.page,
      query.limit
    );
  }

  @ApiTags('Usuario')
  @UseGuards(JwtOptionalAuthGuard) // 2. Usa el guard opcional
  @ApiBearerAuth()
  @Get('perfil-publico/:username')
  @ApiOperation({
    summary:
      'Obtener información pública de un usuario por su nombre de usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Información del usuario obtenida con éxito.',
  })
  async public_user(@Param('username') username: string, @Request() req: any) {
    const userId = req.user?.IDLOGIN;
    return this.publicFunctionService.public_user(username, userId);
  }

  @ApiTags('Posts')
  @Get('search-tags')
  @ApiOperation({
    summary: 'Buscar etiquetas que pueden ser asignadas a un post.',
  })
  @ApiResponse({ status: 200, description: 'Etiquetas encontradas.' })
  async searchTags(
    @Query() query: SearchTags, // 3. Se utiliza el DTO para validar todos los queries
  ) {
    // 4. Se pasa el término de búsqueda 'q' del DTO al servicio
    return this.publicFunctionService.search_tags(query.search,query.top_tags);
  }

  @ApiTags('Posts')
  @Get('reacciones')
  @ApiOperation({
    summary: 'Lista las reacciones disponibles para asignar en un post.',
  })
  @ApiResponse({ status: 200, description: 'Reacciones obtenidas.' })
  async obtener_reacciones() {
    return this.publicFunctionService.get_reacciones();
  }


  @ApiTags('Posts')
  @Get('global-search')
  @ApiOperation({
    summary: 'Realizar búsqueda global en posts, usuarios y productos.',
  })
  @ApiResponse({ status: 200, description: 'Búsqueda global completada.' })
  async globalSearch(@Query() query: GlobalSearchQueryDto) {
    return this.publicFunctionService.global_search(query.query, query.page, query.limit, query.searchPosts, query.searchUsers);
  }
}
