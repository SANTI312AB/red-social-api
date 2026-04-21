import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PostFormatterService } from "src/Interfaces/post-formatter.service";
import { ResponseService } from "src/Interfaces/response.service";
import { UserFormatterService } from "src/Interfaces/user-formatter.service";
import { PrismaService } from "src/prisma/prisma.service";
import { S3Service } from "src/s3/s3.service";
import { HashIdService } from "src/utilis/hash-id.service";


const postProfileIncludes: Prisma.postInclude = {
  comentarios_post: true,
  post_reaccion: true
};

@Injectable()
export class PublicFunctionService {
  constructor(
    private prisma: PrismaService,
    private responseService: ResponseService,
    private postFormatter: PostFormatterService,
    private profile: UserFormatterService,
    private s3Service: S3Service,
    private readonly hashIdService: HashIdService
  ) {}

  async public_posts(
    userId?: number,
    mas_comentados?: boolean,
    mas_reaccionados?: boolean,
    seguidos?: boolean,
    recomendados?: boolean,
    tag?:string,
    reaccion?:string,
    page: number = 1,
    limit: number = 20,
  ) {

    // 1. Configuración de Paginación (Offset)
    const pageNumber = Math.max(1, Number(page));
    const limitNumber = Math.max(1, Number(limit));
    const skip = (pageNumber - 1) * limitNumber;

    // 2. Filtros Base (Reutilizables)
    const include = postProfileIncludes;
    
    // Filtro: Usuarios activos y perfiles públicos
    const publicOnlyFilter = {
      login: {
        IDESTADO: 1,
        usuarios: { PUBLIC_PROFILE: true },
      },
    };

    // Filtro: Solo usuarios activos (para seguidos)
    const adminActiveFilter = {
      login: { IDESTADO: 1 },
    };

    // 3. Contexto del Usuario (Si está logueado)
    let followingIds: number[] = [];
    let likedTagIds: number[] = [];
    let generalExclusionIds: number[] = [];

    if (userId) {
      const user = await this.prisma.login.findUnique({
        where: { IDLOGIN: userId, IDESTADO: 1, IDVERIFICACION: 7 } as any,
      });

      if (!user) {
        return this.responseService.error('Usuario no encontrado', HttpStatus.NOT_FOUND);
      }

      // Obtener seguidos
      const followingRows = await this.prisma.seguidores.findMany({
        where: { ID_SEGUIDOR: userId, ESTADO: 'ACCEPTED', BLOQUEADO: false },
        select: { ID_SEGUIDO: true },
      });
      followingIds = followingRows.map((r) => r.ID_SEGUIDO).filter(Boolean);

      // Ya no excluimos los posts propios del feed público

      // Obtener etiquetas para recomendados
      if (recomendados) {
        const likedTags = await this.prisma.post_etiquetas.findMany({
          where: {
            post: {
              post_reaccion: { some: { IDLOGIN: userId, IDTIPO_REACCION: 1 } },
              ...adminActiveFilter,
            },
          },
          select: { ID_ETIQUETA: true },
        });
        likedTagIds = [...new Set(likedTags.map((t) => t.ID_ETIQUETA))];
      }
    }

    // 4. Construcción Dinámica del WHERE
    // Creamos una única condición principal basada en la prioridad de los flags
    let whereCondition: any = {};
    let orderByCondition: any = { FECHA_CREACION: 'desc' };

    if (seguidos && userId) {
      // 🔹 CASO 1: Feed de Seguidos
      whereCondition = {
        ...whereCondition,
        IDLOGIN: { in: followingIds },
        ...adminActiveFilter,
      };
    } else if (mas_comentados) {
      // 🔹 CASO 2: Más Comentados (Explorar)
      whereCondition = {
        ...whereCondition,
        comentarios_post: { some: {} }, // Al menos un comentario
        ...publicOnlyFilter,
      };
    } else if (mas_reaccionados) {
      // 🔹 CASO 3: Más Reaccionados (Explorar)
      whereCondition = {
        ...whereCondition,
        post_reaccion: { some: {} }, // Al menos una reacción
        ...publicOnlyFilter,
      };
    } else if (recomendados && likedTagIds.length > 0) {
      // 🔹 CASO 4: Recomendados por etiquetas
      whereCondition = {
        ...whereCondition,
        post_etiquetas: { some: { ID_ETIQUETA: { in: likedTagIds } } },
        ...publicOnlyFilter,
      };

    }else if(tag){
         
      whereCondition = {
        ...whereCondition,
        // Buscamos que el post tenga al menos una etiqueta cuyo nombre coincida
        post_etiquetas: {
          some: {
            etiqueta: {
              NOMBRE_ETIQUETA: {
                contains: tag // Busca coincidencias parciales (ej. buscar "Anime" encuentra "#Anime")
              }
            }
          }
        },
        ...publicOnlyFilter, // Aseguramos que solo muestre posts de perfiles públicos/activos
      };
    } else if(reaccion){
         whereCondition = {
        ...whereCondition,
        post_reaccion: {
          some: {
            tipo_reaccion: {
              NOMBRE: {
                contains: reaccion
              }
            }
          }
        },
        ...publicOnlyFilter,
      };

      // 👇 MAGIA: Cambiamos el orden para que cuente la cantidad de reacciones de mayor a menor
      orderByCondition = {
        post_reaccion: {
          _count: 'desc'
        }
      };

    }else {
      // 🔹 CASO 5: Feed General / Default (Mezcla segura)
      // Si el usuario está logueado y pide "General", solemos mostrar una mezcla.
      // Para paginación, debemos elegir una estrategia.
      // Estrategia: Mostrar posts de seguidos O posts públicos recientes.
      if (userId && followingIds.length > 0) {
         whereCondition = {
            ...whereCondition,
            OR: [
                { IDLOGIN: { in: followingIds }, ...adminActiveFilter }, // De mis seguidos
                { ...publicOnlyFilter } // O públicos generales
            ]
         }
      } else {
         // Usuario anónimo o sin seguidos: Todo lo público
         whereCondition = {
            ...whereCondition,
            ...publicOnlyFilter
         };
      }
    }

    // 5. Ejecución de Consultas (Count + FindMany en paralelo)
    // Usamos una transacción o Promise.all para eficiencia
    const [totalPosts, posts] = await Promise.all([
      // A. Contar el total de elementos que cumplen el filtro
      this.prisma.post.count({ where: whereCondition }),
      
      // B. Obtener la página actual
      this.prisma.post.findMany({
        where: whereCondition,
        take: limitNumber,
        skip: skip,
        orderBy: orderByCondition,
        include: include,
      }),
    ]);

    // 6. Formateo de datos
    const formattedPosts = await Promise.all(
      posts.map((p) => this.postFormatter.fetchAndFormat(p.ID_POST, userId)),
    );

    // 7. Retorno con Metadata
    return this.responseService.success('Publicaciones obtenidas con éxito', {
      pages: formattedPosts,
      meta: {
        totalItems: totalPosts,
        itemsPerPage: limitNumber,
        totalPages: Math.ceil(totalPosts / limitNumber),
        currentPage: pageNumber,
      },
    });
  }

   async post_slug(slug: string, userId?: number) {
  // 1. Encontrar el post por slug
  const post = await this.prisma.post.findUnique({
    where: {
      SLUG_POST: slug,
    },
    include: {
      login: {
        include: {
          usuarios: true,
        },
      },
    },
  });

  // 2. Si el post no existe
  if (!post) {
    return this.responseService.error(
      'Publicación no encontrada',
      HttpStatus.NOT_FOUND,
    );
  }

  // 3. Regla #1: Bloqueo de Administrador
  if (post.login.IDESTADO !== 1) {
    return this.responseService.error(
      'Publicación no encontrada',
      HttpStatus.NOT_FOUND,
    );
  }

  // 4. Regla #2: Posts Públicos
  const isPublic = post.login.usuarios?.PUBLIC_PROFILE === true;

  if (isPublic) {
    // Post público y autor activo. Cualquiera puede verlo.
    const formattedPost = await this.postFormatter.fetchAndFormat(
      post.ID_POST, userId,
    );
    return this.responseService.success(
      'Post obtenido con éxito',
      formattedPost,
    );
  }

  // =======================================================
  // 🔥 INICIO DE LA CORRECCIÓN
  // =======================================================

  // 5. Regla #3: Posts Privados - Verificación de autenticación
  // Si llegamos aquí, el post es PRIVADO.
  // Si el usuario NO está autenticado (!userId), no puede verlo.
  if (!userId) {
    return this.responseService.error(
      'Publicación no encontrada',
      HttpStatus.NOT_FOUND,
    );
  }
  // 6. Regla #4: El usuario SÍ está autenticado (userId existe)
  // Ahora podemos verificar si tiene permisos.

  // 6a. ¿El espectador es el dueño del post?
  if (post.IDLOGIN === userId) {
    const formattedPost = await this.postFormatter.fetchAndFormat(
      post.ID_POST, userId,
    );
    return this.responseService.success(
      'Post obtenido con éxito',
      formattedPost,
    );
  }

  // 6b. ¿El espectador es un seguidor ACEPTADO?
  // Esta consulta ahora es segura porque sabemos que 'userId' NO es undefined
  const friendship = await this.prisma.seguidores.findFirst({
    where: {
      ID_SEGUIDOR: userId, // 'userId' está garantizado que es un número
      ID_SEGUIDO: post.IDLOGIN,
      ESTADO: 'ACCEPTED',
    },
  });

  if (friendship) {
    // Sí, es un seguidor aceptado.
    const formattedPost = await this.postFormatter.fetchAndFormat(
      post.ID_POST, userId,
    );
    return this.responseService.success(
      'Post obtenido con éxito',
      formattedPost,
    );
  }

  // =======================================================
  // 🔥 FIN DE LA CORRECCIÓN
  // =======================================================

  // 7. Caso final: Post privado, usuario autenticado, pero sin permisos.
  return this.responseService.error(
    'Publicación no encontrada',
    HttpStatus.NOT_FOUND,
  );
}

  async posts_user(
    username: string,
    slug?: string,
    mis_comentados?: boolean,
    mis_reaccionados?: boolean,
    userId?: number,
    page: number = 1,
    limit: number = 20
  ) {
    // 1. Buscamos al usuario dueño del perfil una sola vez (optimizando)
    const user = await this.prisma.login.findUnique({
      where: {
        USUARIO_LOGIN: username,
        IDESTADO: 1,
        IDVERIFICACION: 7,
      },
      include: { usuarios: true },
    });

    if (!user) {
      return this.responseService.error(
        'Usuario no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Lógica de Perfil Privado y Seguidores
    if (user.usuarios?.PUBLIC_PROFILE === false) {
      let tienePermiso = false;

      if (userId) {
        // Caso A: El usuario está viendo su propio perfil
        if (userId === user.IDLOGIN) {
          tienePermiso = true;
        } else {
          // Caso B: Verificar si lo sigue y está aceptado
          const relacion = await this.prisma.seguidores.findFirst({
            where: {
              ID_SEGUIDOR: userId,      // El que mira
              ID_SEGUIDO: user.IDLOGIN, // El dueño del perfil
              ESTADO: 'ACCEPTED',       // 🔥 IMPORTANTE: Solo si fue aceptado
              BLOQUEADO: false,         // Que no esté bloqueado
            },
          });

          if (relacion) {
            tienePermiso = true;
          }
        }
      }

      // Si no tiene permiso (no es el dueño y no es seguidor aceptado), rechazamos
      if (!tienePermiso) {
        return this.responseService.error(
          'El perfil de este usuario es privado. Debes seguirlo para ver sus publicaciones.',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // 3. Verificación de Bloqueo (Seguridad adicional)
    if (userId && userId !== user.IDLOGIN) {
      const blockRecord = await this.prisma.seguidores.findFirst({
        where: {
          ID_SEGUIDOR: userId,
          ID_SEGUIDO: user.IDLOGIN,
          BLOQUEADO: true,
        },
      });

      if (blockRecord) {
        return this.responseService.error(
          'Este usuario te ha bloqueado. No puedes ver sus publicaciones.',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    try {
      // --- CASO A: Se solicita un post específico por Slug ---
      if (slug) {
        const post = await this.prisma.post.findFirst({
          where: {
            SLUG_POST: slug,
            IDLOGIN: user.IDLOGIN,
          },
        });

        if (!post) {
          return this.responseService.error(
            'Publicación no encontrada o no pertenece a este usuario.',
            HttpStatus.NOT_FOUND,
          );
        }

        const formattedPost = await this.postFormatter.fetchAndFormat(
          post.ID_POST,
          userId // 👈 Inyectamos el userId para saber si el que mira ya reaccionó/comentó
        );
        return this.responseService.success(
          'Publicación obtenida exitosamente.',
          formattedPost,
        );
      }

      // --- CASO B: Se solicita una lista de posts con filtros y paginación ---
      
      // A. Configuración de Paginación
      const pageNumber = Math.max(1, Number(page));
      const limitNumber = Math.max(1, Number(limit));
      const skip = (pageNumber - 1) * limitNumber;

      // B. Construcción Dinámica del WHERE
      let whereClause: Prisma.postWhereInput = {};

      const commentedFilter = {
        comentarios_post: { some: { IDLOGIN: user.IDLOGIN } },
      };
      const reactedFilter = {
        post_reaccion: { some: { IDLOGIN: user.IDLOGIN } },
      };

      if (mis_comentados && mis_reaccionados) {
        whereClause = { OR: [commentedFilter, reactedFilter] };
      } else if (mis_comentados) {
        whereClause = commentedFilter;
      } else if (mis_reaccionados) {
        whereClause = reactedFilter;
      } else {
        whereClause = { IDLOGIN: user.IDLOGIN };
      }

      // C. Ejecución de Consultas Paralelas (Eficiencia)
      const [totalPosts, posts] = await Promise.all([
        this.prisma.post.count({ where: whereClause }),
        this.prisma.post.findMany({
          where: whereClause,
          orderBy: { FECHA_CREACION: 'desc' },
          include: postProfileIncludes,
          take: limitNumber,
          skip: skip, // 👈 Se aplica el salto matemático
        })
      ]);

      // D. Formateo de los Posts devueltos
      const formattedPosts = await Promise.all(
        posts.map((p) => this.postFormatter.fetchAndFormat(p.ID_POST, userId)),
      );

      // E. Retorno estructurado con Metadata
      return this.responseService.success(
        'Publicaciones listadas exitosamente.',
        {
          pages: formattedPosts,
          meta: {
            totalItems: totalPosts,
            itemsPerPage: limitNumber,
            totalPages: Math.ceil(totalPosts / limitNumber),
            currentPage: pageNumber,
          },
        }
      );
    } catch (error) {
      console.error('Error al listar las publicaciones:', error);
      return this.responseService.error(
        'Ocurrió un error al obtener las publicaciones.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

   async comentarios(
    slug: string,
    mas_antiguos?: boolean,
    mas_gustados?: boolean,
    page: number = 1,
    limit: number = 20,
    viewerId?: number
  ) {
    // 1. Configuración de Paginación
    const pageNumber = Math.max(1, Number(page));
    const limitNumber = Math.max(1, Number(limit));
    const skip = (pageNumber - 1) * limitNumber;

    // 2. Lógica para determinar el orden de los comentarios principales
    let orderByClause: Prisma.comentarios_postOrderByWithRelationInput;

    if (mas_gustados) {
      // Ordenar por el conteo de "me gusta" descendente
      orderByClause = {
        likes_comentario: {
          _count: 'desc',
        },
      };
    } else if (mas_antiguos) {
      // Ordenar por fecha de creación ascendente
      orderByClause = {
        FECHA_COMENTARIO: 'asc',
      };
    } else {
      // Orden por defecto: más recientes primero
      orderByClause = {
        FECHA_COMENTARIO: 'desc',
      };
    }

    // 3. Condición de búsqueda centralizada
    const whereCondition = { post: { SLUG_POST: slug } };

    // 4. Ejecución paralela del conteo y la búsqueda de comentarios
    const [totalComentarios, comentarios] = await Promise.all([
      this.prisma.comentarios_post.count({ where: whereCondition }),
      this.prisma.comentarios_post.findMany({
        where: whereCondition,
        include: {
          login: {
            include: {
              usuarios: true,
            },
          },
          // Conteo eficiente de "me gusta"
          _count: {
            select: { likes_comentario: true },
          },
          // Likes del viewer para viewer_state
          ...(viewerId ? {
            likes_comentario: {
              where: { IDLOGIN: viewerId },
              take: 1,
            },
          } : {}),
          respuestas_post: {
            include: {
              login: {
                include: {
                  usuarios: true,
                },
              },
              // Conteo eficiente de "me gusta" para las respuestas
              _count: {
                select: { likes_respuestas: true },
              },
              // Likes del viewer para viewer_state en respuestas
              ...(viewerId ? {
                likes_respuestas: {
                  where: { IDLOGIN: viewerId },
                  take: 1,
                },
              } : {}),
            },
            // Ordenamiento por defecto para las respuestas
            orderBy: [
              {
                likes_respuestas: {
                  _count: 'desc',
                },
              },
              {
                FECHA_RESPUESTA: 'asc',
              },
            ],
          },
        },
        orderBy: orderByClause, // Aplicar el ordenamiento dinámico
        take: limitNumber,
        skip: skip,
      })
    ]);

    // 5. Mapear los resultados
    const comentariosMapeados = comentarios.map((comentario: any) => {
      return {
        id: this.hashIdService.encode(comentario.ID_COMENTARIO),
        comentario: comentario.COMENTARIO,
        user: comentario.login.USUARIO_LOGIN,
        avatar: comentario.login?.usuarios?.AVATAR_USUARIO
          ? this.s3Service.getPublicUrl(
              'avatars',
              comentario.login.usuarios.AVATAR_USUARIO,
            )
          : null,
        fecha_comentario: comentario.FECHA_COMENTARIO,
        fecha_edicion: comentario.FECHA_EDICION,
        likes: comentario._count.likes_comentario || 0,
        respuestas: comentario.respuestas_post.map((respuesta: any) => ({
          id: this.hashIdService.encode(respuesta.ID_RESPUESTA),
          respuesta: respuesta.RESPUESTA,
          user: respuesta.login.USUARIO_LOGIN,
          avatar: respuesta.login?.usuarios?.AVATAR_USUARIO
            ? this.s3Service.getPublicUrl(
                'avatars',
                respuesta.login.usuarios.AVATAR_USUARIO,
              )
            : null,
          fecha_respuesta: respuesta.FECHA_RESPUESTA,
          fecha_edicion: respuesta.FECHA_EDICION,
          likes: respuesta._count.likes_respuestas || 0,
          viewer_state: viewerId ? {
            es_propio: respuesta.IDLOGIN === viewerId,
            me_gusta: (respuesta.likes_respuestas?.length ?? 0) > 0,
          } : null,
        })),
        viewer_state: viewerId ? {
          es_propio: comentario.IDLOGIN === viewerId,
          me_gusta: (comentario.likes_comentario?.length ?? 0) > 0,
        } : null,
      };
    });

    // 6. Retorno estructurado con Metadata
    return this.responseService.success(
      'Comentarios obtenidos con éxito',
      {
        pages: comentariosMapeados,
        meta: {
          totalItems: totalComentarios,
          itemsPerPage: limitNumber,
          totalPages: Math.ceil(totalComentarios / limitNumber),
          currentPage: pageNumber,
        },
      }
    );
  }

  async reacciones(slug: string,orderBy: 'asc' | 'desc' = 'desc', page: number = 1, limit: number = 20) {
    // 1. Configuración de Paginación
    const pageNumber = Math.max(1, Number(page));
    const limitNumber = Math.max(1, Number(limit));
    const skip = (pageNumber - 1) * limitNumber;

    // 2. Condición de búsqueda centralizada
    const whereCondition = { post: { SLUG_POST: slug } };

    // 3. Ejecución paralela del conteo y la búsqueda (Promesas concurrentes)
    const [totalReacciones, reacciones] = await Promise.all([
      this.prisma.post_reaccion.count({ where: whereCondition }),
      this.prisma.post_reaccion.findMany({
        where: whereCondition,
        include: {
          post: true, // Tip: Si no usas los datos del post en el map de abajo, podrías quitar esto para optimizar
          login: { include: { usuarios: true } },
          tipo_reaccion: true,
        },
        orderBy: {
          FECHA_REACCION: orderBy,
        },
        take: limitNumber,
        skip: skip, // 👈 Aplicamos el salto para la paginación real
      })
    ]);

    // 4. Mapear los resultados
    const reaccionesMapeadas = reacciones.map((reaccion) => {
      return {
        user: reaccion.login.USUARIO_LOGIN,
        avatar: reaccion.login?.usuarios?.AVATAR_USUARIO
          ? this.s3Service.getPublicUrl(
              'avatars',
              reaccion.login.usuarios.AVATAR_USUARIO,
            )
          : null,
        tipo: reaccion.tipo_reaccion.NOMBRE,
        fecha_reaccion: reaccion.FECHA_REACCION,
      };
    });

    // 5. Retorno estructurado con Metadata
    return this.responseService.success(
      'Reacciones obtenidas con éxito',
      {
        pages: reaccionesMapeadas,
        meta: {
          totalItems: totalReacciones,
          itemsPerPage: limitNumber,
          totalPages: Math.ceil(totalReacciones / limitNumber),
          currentPage: pageNumber,
        },
      }
    );
  }

  async public_user(username: string, userId?: number) {
    const user = await this.prisma.login.findUnique({
      where: {
        USUARIO_LOGIN: username,
        IDESTADO: 1,
        IDVERIFICACION: 7,
      },
    });
    if (!user) {
      return this.responseService.error(
        'Usuario no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    const userProfile = await this.profile.publicProfile(
      user.USUARIO_LOGIN,
      userId,
    );
    return this.responseService.success(
      'Usuario obtenido con éxito',
      userProfile,
    );
  }

  async seguidores(
    username: string,
    seguidores?: boolean,
    seguidos?: boolean,
    estado?: string,
    orden?: 'asc' | 'desc',
    serch_user?: string,
    page: number = 1,
    limit: number = 20
  ) {
    // 1. Configuración de Paginación
    const pageNumber = Math.max(1, Number(page));
    const limitNumber = Math.max(1, Number(limit));
    const skip = (pageNumber - 1) * limitNumber;

    // 2. Validaciones iniciales del perfil
    const user = await this.prisma.login.findUnique({
      where: {
        USUARIO_LOGIN: username,
        IDESTADO: 1,
        IDVERIFICACION: 7,
      },
      include: {
        usuarios: true,
      },
    });

    if (!user) {
      return this.responseService.error(
        'Usuario no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    if (user.usuarios?.PUBLIC_PROFILE === false) {
      return this.responseService.error('Perfil privado', HttpStatus.CONFLICT);
    }

    // 3. Variables de consulta
    const orderBy: Prisma.seguidoresOrderByWithRelationInput = {
      FECHA_CREACION: orden || 'desc',
    };

    const userId = user.IDLOGIN;
    const usernameFilter = serch_user
      ? {
          USUARIO_LOGIN: {
            contains: serch_user.toLowerCase(),
          },
        }
      : {};

    // Variables que guardarán la data final y el total
    let listaFinal: any[] = [];
    let totalItems = 0;

    // 4. LÓGICA DE DECISIÓN
    const buscarSeguidos = seguidos && !seguidores;

    if (buscarSeguidos) {
      // --- CASO A: BUSCAR A LOS QUE EL USUARIO SIGUE (SEGUIDOS) ---
      const whereCondition = {
        ID_SEGUIDOR: userId,
        ...(estado && { ESTADO: estado }),
        login_seguidores_ID_SEGUIDOTologin: usernameFilter,
      };

      // Ejecución paralela de Conteo y Búsqueda
      const [total, data] = await Promise.all([
        this.prisma.seguidores.count({ where: whereCondition }),
        this.prisma.seguidores.findMany({
          where: whereCondition,
          include: {
            login_seguidores_ID_SEGUIDOTologin: {
              include: { usuarios: true },
            },
          },
          orderBy,
          skip: skip,
          take: limitNumber,
        })
      ]);

      totalItems = total;

      listaFinal = data.map((s) => {
        const followedUser = s.login_seguidores_ID_SEGUIDOTologin;
        return {
          username: followedUser.USUARIO_LOGIN,
          avatar: followedUser.usuarios?.AVATAR_USUARIO
            ? this.s3Service.getPublicUrl(
                'avatars',
                followedUser.usuarios.AVATAR_USUARIO,
              )
            : null,
          fecha_creacion: s.FECHA_CREACION,
          fecha_edicion: s.FECHA_ACTUALIZACION,
          estado: s.ESTADO,
          bloqueado: (s as any).BLOQUEADO,
          tipo: 'siguiendo',
        };
      });

    } else {
      // --- CASO B (DEFAULT): BUSCAR A LOS SEGUIDORES DEL USUARIO ---
      const whereCondition = {
        ID_SEGUIDO: userId,
        ...(estado && { ESTADO: estado }),
        login_seguidores_ID_SEGUIDORTologin: usernameFilter, 
      };

      // Ejecución paralela de Conteo y Búsqueda
      const [total, data] = await Promise.all([
        this.prisma.seguidores.count({ where: whereCondition }),
        this.prisma.seguidores.findMany({
          where: whereCondition,
          include: {
            login_seguidores_ID_SEGUIDORTologin: {
              include: { usuarios: true },
            },
          },
          orderBy,
          skip: skip,
          take: limitNumber,
        })
      ]);

      totalItems = total;

      listaFinal = data.map((s) => {
        const followerUser = s.login_seguidores_ID_SEGUIDORTologin;
        return {
          username: followerUser.USUARIO_LOGIN,
          avatar: followerUser.usuarios?.AVATAR_USUARIO
            ? this.s3Service.getPublicUrl(
                'avatars',
                followerUser.usuarios.AVATAR_USUARIO,
              )
            : null,
          fecha_creacion: s.FECHA_CREACION,
          fecha_edicion: s.FECHA_ACTUALIZACION,
          estado: s.ESTADO,
          bloqueado: (s as any).BLOQUEADO,
          tipo: 'seguidor',
        };
      });
    }

    // 5. Retornamos la respuesta unificada con la Metadata
    return this.responseService.success(
      'Lista obtenida correctamente',
      {
        pages: listaFinal,
        meta: {
          totalItems: totalItems,
          itemsPerPage: limitNumber,
          totalPages: Math.ceil(totalItems / limitNumber),
          currentPage: pageNumber,
        }
      }
    );
  }
  

  async serch_user(query: string) {
    // 3. Usar 'findMany' y 'contains' para una búsqueda flexible
    const users = await this.prisma.login.findMany({
      where: {
        USUARIO_LOGIN: {
          contains: query.toLowerCase(), // Convertimos la búsqueda a minúsculas
        },
        // Opcional: filtrar solo usuarios activos y verificados
        IDESTADO: 1,
        IDVERIFICACION: 7,
      },
      include: {
        usuarios: true,
      },
      take: 10, // Limitar el número de resultados
      orderBy: { FECHA_REGISTRO_LOGIN: 'desc' },
    });

    // 4. Mapear la respuesta a un formato limpio
    const mappedUsers = users.map((user) => {
      const avatarUrl = user.usuarios?.AVATAR_USUARIO
        ? this.s3Service.getPublicUrl('avatars', user.usuarios.AVATAR_USUARIO)
        : null;

      return {
        username: user.USUARIO_LOGIN,
        avatar: avatarUrl,
      };
    });

    return this.responseService.success('Usuarios encontrados', mappedUsers);
  }

  
  async search_tags(query: string = '', top_tags?: boolean): Promise<any> {
    const searchTerms = query
      .trim()
      .split(' ')
      .filter((term) => term.length > 0);

    let tags;
    let message = 'Tags obtenidos.'; // 👈 Declaramos con let para poder modificarlo
    
    // Si piden los top explícitamente, o si la búsqueda está vacía
    if (top_tags || searchTerms.length === 0) {
      
      message = 'Tags más usados.'; // 👈 Actualizamos el mensaje correctamente
      
      tags = await this.prisma.etiquetas.findMany({
        // 👇 MAGIA: El filtro para excluir los ceros
        where: {
          post_etiquetas: {
            some: {} // Significa: "Que exista AL MENOS UN registro relacionado"
          }
        },
        take: 10,
        include: {
          _count: {
            select: { post_etiquetas: true }, 
          },
        },
        orderBy: {
          post_etiquetas: {
            _count: 'desc',
          },
        },
      });
    } else {
      // Búsqueda normal por texto
      tags = await this.prisma.etiquetas.findMany({
        where: {
          OR: searchTerms.map((term) => ({
            NOMBRE_ETIQUETA: {
              contains: term,
            },
          })),
        },
        take: 10,
        include: {
          _count: {
            select: { post_etiquetas: true }, 
          },
        },
        orderBy: {
          NOMBRE_ETIQUETA: 'desc',
        },
      });
    }

    // Mantenemos el mapeo intacto para no romper el frontend
    const tags_map = tags.map((tag) => {
      return {
        etiqueta: tag.NOMBRE_ETIQUETA,
        // 👇 (Opcional) Si en algún momento tu front quiere mostrar el número de posts:
        // cantidad: tag._count.post_etiquetas 
      };
    });

    return this.responseService.success(message, tags_map);
}

  async get_reacciones() {
    const reacciones = await this.prisma.tipo_reaccion.findMany({
      where: {
        ACTIVO: true,
      },
      include:{
          _count:{
             select:{post_reaccion:true}
          }
      },
      orderBy:{
           post_reaccion: {
            _count: 'desc',
          },
      }
    });

    const map_reacciones = reacciones.map((reaccion) => {
      return {
        id: reaccion.IDTIPO_REACCION,
        nombre: reaccion.NOMBRE,
        icono: reaccion.ICONO,
        usado: reaccion._count.post_reaccion
      };
    });

    return this.responseService.success('Reacciones obtenidas', map_reacciones);
  }



   async global_search(
    query: string,
    page: number = 1,
    limit: number = 10,
    searchPosts?: boolean,
    searchUsers?: boolean
  ) {
    try {
      // Aseguramos que page y limit sean números reales (por si llegan como string)
      const pageNumber = Number(page) || 1;
      const limitNumber = Number(limit) || 10;

      // Generador de estructura vacía por si no hay búsqueda
      const emptyResult = {
        pages: [],
        meta: { totalItems: 0, itemsPerPage: limitNumber, totalPages: 0, currentPage: pageNumber },
      };

      if (!query || !query.trim()) {
        return this.responseService.success('Búsqueda vacía', {
          users: emptyResult,
          products: emptyResult,
          posts: emptyResult,
        });
      }

      const skip = (pageNumber - 1) * limitNumber;
      const searchAll = !searchPosts && !searchUsers;
      const shouldSearchPosts = searchPosts || searchAll;
      const shouldSearchUsers = searchUsers || searchAll;

      const cleanQuery = query.trim();
      const lowerQuery = cleanQuery.toLowerCase();

      // Variables para almacenar las Promesas (ahora esperan { items, total })
      // Le explicamos a TypeScript la estructura exacta que van a tener estas Promesas
      let usersPromise = Promise.resolve<{ items: any[]; total: number }>({ items: [], total: 0 });
      let postsPromise = Promise.resolve<{ items: any[]; total: number }>({ items: [], total: 0 });

      // ==========================================
      // 1. PROMESA: BÚSQUEDA DE USUARIOS
      // ==========================================
      if (shouldSearchUsers) {
        const whereUser = {
          USUARIO_LOGIN: { contains: lowerQuery },
          IDESTADO: 1,
          IDVERIFICACION: 7,
        };

        // Ejecutamos la búsqueda y el conteo al mismo tiempo
        usersPromise = Promise.all([
          this.prisma.login.findMany({
            where: whereUser,
            include: { usuarios: true },
            skip,
            take: limitNumber,
            orderBy: { FECHA_REGISTRO_LOGIN: 'desc' },
          }),
          this.prisma.login.count({ where: whereUser })
        ]).then(([users, total]) => ({
          items: users.map((user) => ({
            username: user.USUARIO_LOGIN,
            avatar: user.usuarios?.AVATAR_USUARIO
              ? this.s3Service.getPublicUrl('avatars', user.usuarios.AVATAR_USUARIO)
              : null,
          })),
          total
        }));
      }


      // ==========================================
      // 3. PROMESA: BÚSQUEDA DE POSTS
      // ==========================================
      if (shouldSearchPosts) {
        const wherePosts = {
          OR: [
            { DESCRIPCION: { contains: cleanQuery } },
            {
              post_etiquetas: {
                some: { etiqueta: { NOMBRE_ETIQUETA: { contains: cleanQuery } } },
              },
            },
          ],
        };

        postsPromise = Promise.all([
          this.prisma.post.findMany({
            where: wherePosts,
            skip,
            take: limitNumber,
            
          }),
          this.prisma.post.count({ where: wherePosts })
        ]).then(async ([postsRaw, total]) => {
          
          // 👇 CÓDIGO CORREGIDO AQUÍ 👇
          // Si existe el formateador, lo aplicamos y retornamos eso.
          if (this.postFormatter?.fetchAndFormat) {
            const formattedPosts = await Promise.all(
              postsRaw.map(p => this.postFormatter.fetchAndFormat(p.ID_POST, 0))
            );
            return { items: formattedPosts, total };
          }
          
          // Si no existe el formateador, retornamos los datos crudos.
          return { items: postsRaw, total };
        });
      }

      // ==========================================
      // 4. EJECUCIÓN PARALELA Y RESPUESTA
      // ==========================================
      const [usersResult, postsResult] = await Promise.all([
        usersPromise,
        postsPromise,
      ]);

      // Función helper para construir la metadata limpia
      const buildMeta = (total: number) => ({
        totalItems: total,
        itemsPerPage: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
        currentPage: pageNumber,
      });

      // Retornamos cada categoría con su array de datos (pages) y su paginación (meta)
      return this.responseService.success('Resultados de búsqueda global', {
        users: { 
          pages: usersResult.items, 
          meta: buildMeta(usersResult.total) 
        },
        posts: { 
          pages: postsResult.items, 
          meta: buildMeta(postsResult.total) 
        },
      });

    } catch (error) {
      console.error('Error en la búsqueda global:', error);
      return this.responseService.error(
        'Error al realizar la búsqueda global.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}