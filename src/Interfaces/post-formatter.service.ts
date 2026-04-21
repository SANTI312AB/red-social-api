import { Injectable, NotFoundException } from '@nestjs/common';
import { etiquetas, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/s3/s3.service';
import { PostProfile, PostUser, MultimediaContent, Hotspot, ReactionCount, PostTags, PostViewState } from './post.interface';
import { HashIdService } from 'src/utilis/hash-id.service';

// 1. Objeto de inclusión reutilizable para obtener un post con todas sus relaciones
export const postProfileIncludes: Prisma.postInclude = {
  login: {
    include: {
      usuarios: {
        include: {
          estados: true, // Para el estado de verificación del usuario
        },
      },
    },
  },
  multimedia_post: {
    include: {
      multimedia_pot: true, // Hotspots
    },
    orderBy: {
      ORDER: 'asc',
    },
  },
  _count: {
    select: {
      comentarios_post: true, // Para contar los comentarios
    },
  },
  // NOTA: Para que esto funcione, la relación en tu `schema.prisma` en el modelo `post`
  // debe ser de uno a muchos: `post_reaccion post_reaccion[]`
  post_reaccion: {
    include: {
      tipo_reaccion: true, // Para obtener el nombre de la reacción
    },
  },
  post_etiquetas: {
    include: {
      etiqueta: true
    }
  }
};

// 2. Tipo auxiliar para un post con todas las relaciones cargadas
type PostWithRelations = Prisma.postGetPayload<{
  include: typeof postProfileIncludes;
}>;

@Injectable()
export class PostFormatterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly hashIdService: HashIdService,
  ) {}

  /**
   * Busca un post por su ID y lo transforma en un perfil formateado.
   * @param postId El ID del post a buscar.
   * @returns El perfil del post formateado.
   * @throws NotFoundException si el post no existe.
   */
  async fetchAndFormat(postId: number, viewerId?: number): Promise<PostProfile> {
    const post = await this.prisma.post.findUnique({
      where: { ID_POST: postId },
      include: postProfileIncludes,
    });

    if (!post) {
      throw new NotFoundException('Publicación no encontrada.');
    }

    // --- CORRECCIÓN AQUÍ ---
    // Se utiliza una doble aserción de tipo para indicarle a TypeScript que confíe
    // en que la forma del objeto 'post' es la correcta, resolviendo el error.
    return this._mapPostToProfile(post as unknown as PostWithRelations, viewerId);
  }

  /**
   * Transforma un objeto de post ya obtenido en el formato de perfil.
   * @param post El objeto completo del post con sus relaciones.
   */
  private async _mapPostToProfile(post: PostWithRelations, viewerId?: number): Promise<PostProfile> {
    // Mapear datos del usuario
    const usuario = (post.login as any)?.usuarios ?? null;
    const postUser: PostUser = {
      avatar: usuario?.AVATAR_USUARIO ? this.s3Service.getPublicUrl('avatars', usuario.AVATAR_USUARIO) : '',
      username: post.login.USUARIO_LOGIN,
      nombre: usuario?.NOMBRE_USUARIO ?? '',
      // Se añade optional chaining ('?') para más seguridad
      apellido: (usuario?.TIPO_DOCUMENTO_USUARIO === 'CI' || usuario?.TIPO_DOCUMENTO_USUARIO === 'PPN' || usuario?.TIPO_DOCUMENTO_USUARIO === null) ? usuario?.APELLIDO_USUARIO : null,
      verificado: usuario?.estados?.NOMBRE_ESTADO === 'VERIFICADO',
    };

    // Mapear contenido multimedia y hotspots
    // Mapear contenido multimedia y hotspots
     // 👇 NOTA EL AWAIT PROMISE.ALL AQUÍ
    const contenido: MultimediaContent[] = await Promise.all(
      post.multimedia_post.map(async (item) => {
        
        const hotpotsRaw = ((item as any).multimedia_pot) ?? [];
        
        // 👇 OTRO AWAIT PROMISE.ALL PARA LOS HOTSPOTS
        const hotpots: Hotspot[] = await Promise.all(
          hotpotsRaw.map(async (hp: any) => {
            
            let productoFormateado: any = null;


            return {
              id: this.hashIdService.encode(hp.ID_MULTIMEDIA_POT),
              descripcion: hp.DESCRIPCION,
              coordX: hp.CORDENADA_X,
              coordY: hp.CORDENADA_Y,
              username: hp.USERNAME, // 👈 ¡Listo! Se envía el objeto completo
            };
          })
        );

        return {
          id: this.hashIdService.encode(item.ID_MULTIMEDIA),
          archivo: item.ARCHIVO_MULTIMEDIA ? this.s3Service.getPublicUrl('post', item.ARCHIVO_MULTIMEDIA) : null,
          thumb: item.THUMBNAIL_MULTIMEDIA ? this.s3Service.getPublicUrl('post', item.THUMBNAIL_MULTIMEDIA) : null,
          tipo: item.MULTIMEDIA_TYPE ?? null,
          descripcion: item.DESCRIPCION,
          orden: (item as any).ORDER ?? 0,
          hotpots: hotpots.length > 0 ? hotpots : null,
        };
      })
    );

    // Agrupar y contar reacciones
     const reaccionesMap = new Map<number, ReactionCount>();
    
    // Con el schema corregido, 'post.post_reaccion' es siempre un array.
    // Usamos un bucle 'for...of' que es más limpio y seguro.
    for (const pr of post.post_reaccion) {
      const tipo = (pr as any).tipo_reaccion;
      if (tipo) { // Verificamos que la relación exista
        const reaccionId = tipo.IDTIPO_REACCION;
        const reaccionNombre = tipo.NOMBRE;

        if (reaccionesMap.has(reaccionId)) {
          reaccionesMap.get(reaccionId)!.cantidad++;
        } else {
          reaccionesMap.set(reaccionId, {
            tipo: reaccionNombre,
            cantidad: 1,
          });
        }
      }
    }
    const reacciones: ReactionCount[] = Array.from(reaccionesMap.values());

      // Mapear etiquetas desde post.post_etiquetas
    const etiquetas: PostTags[] = (post.post_etiquetas ?? []).map((etiquetaObj: any) => ({
        id: etiquetaObj.etiqueta?.ID_ETIQUETA ?? 0,
        nombre: etiquetaObj.etiqueta?.NOMBRE_ETIQUETA ?? '',
    }));

    // Calcular viewState del usuario que visualiza
    let viewState: PostViewState | null = null;
    if (viewerId) {
      const es_propio = post.IDLOGIN === viewerId;

      // Verificar si el viewer sigue al dueño del post
      let siguiendo = false;
      if (!es_propio) {
        const relacion = await this.prisma.seguidores.findFirst({
          where: {
            ID_SEGUIDOR: viewerId,
            ID_SEGUIDO: post.IDLOGIN,
            ESTADO: 'ACCEPTED',
          },
        });
        siguiendo = !!relacion;
      }

      const userReaction = post.post_reaccion.find(
        (pr) => (pr as any).IDLOGIN === viewerId,
      );
      if (userReaction) {
        const tipo = (userReaction as any).tipo_reaccion;
        viewState = {
          es_propio,
          siguiendo,
          reaccionado: true,
          id_reaccion: (userReaction as any).IDTIPO_REACCION,
          tipo_reaccion: tipo?.NOMBRE ?? null,
        };
      } else {
        viewState = { es_propio, siguiendo, reaccionado: false, id_reaccion: null, tipo_reaccion: null };
      }
    }

    const postProfile: PostProfile = {
      id:this.hashIdService.encode(post.ID_POST),
      slug:post.SLUG_POST,
      usuario: postUser,
      descripcion: post.DESCRIPCION,
      contenido: contenido,
      fecha_creacion: post.FECHA_CREACION,
      fecha_edicion: post.FECHA_EDICION,
      total_comentarios: post._count.comentarios_post,
      reacciones: reacciones,
      etiquetas:etiquetas,
      viewState,
    };

    return postProfile;
  }
}