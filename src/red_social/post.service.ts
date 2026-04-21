import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ResponseService } from "src/Interfaces/response.service";
import { PrismaService } from "src/prisma/prisma.service";
import { S3Service } from "src/s3/s3.service";
import { CreatePostDto } from "./dto/create-post.dto";
import { generateUniqueSlug } from 'src/utilis/sluger.generator';
import { UpdatePostDto } from "./dto/update-post.dto";
import { PostFormatterService } from "src/Interfaces/post-formatter.service";
import { CreateHotspotDto } from "./dto/create-hotspot.dto";
import { UpdateHotspotDto } from "./dto/update-hotspot.dto";
import { Prisma } from "@prisma/client";
import { FrameVideoService } from "src/Services/framevideo.service";
import * as fs from 'fs';
import * as path from 'path';

const postProfileIncludes: Prisma.postInclude = {
  comentarios_post: true,
  post_reaccion: true,
  posts_guardados:true
};

@Injectable()
export class PostService {
  constructor(
    private prisma: PrismaService,
    private responseService: ResponseService,
    private s3Service: S3Service,
    private postFormatter: PostFormatterService,
    private frameVideoService: FrameVideoService
  ) {}

   async listPosts(
    userId: number,
    postId?: any,
    mis_comentados?: boolean,
    mis_reaccionados?: boolean,
    posts_guardados?: boolean,
    page: number = 1,
    limit: number = 20
  ) {
    try {
      // --- CASO A: Se solicita un post específico por ID ---
      if (postId) {
        const post = await this.prisma.post.findFirst({
          where: {
            ID_POST: Number(postId), // Aseguramos que sea número
            IDLOGIN: userId, // Se añade la validación para asegurar que el post pertenece al usuario
          },
        });

        if (!post) {
          return this.responseService.error(
            'Publicación no encontrada o no pertenece a este usuario.',
            HttpStatus.NOT_FOUND,
          );
        }

        const formattedPost = await this.postFormatter.fetchAndFormat(post.ID_POST, userId);
        return this.responseService.success('Publicación obtenida exitosamente.', formattedPost);
      }

      // --- CASO B: Se solicita una lista de posts con filtros y paginación ---
      
      // 1. Configuración de Paginación
      const pageNumber = Math.max(1, Number(page));
      const limitNumber = Math.max(1, Number(limit));
      const skip = (pageNumber - 1) * limitNumber;

      // 2. Construcción del Filtro (whereClause)
      let whereClause: Prisma.postWhereInput = {};

      const commentedFilter = { comentarios_post: { some: { IDLOGIN: userId } } };
      const reactedFilter = { post_reaccion: { some: { IDLOGIN: userId } } };
      const post_guardadosFilter = { posts_guardados: { some: { IDLOGIN: userId } } };

      if (mis_comentados && mis_reaccionados && posts_guardados) {
        // Devuelve posts que cumplen CUALQUIERA de las condiciones
        whereClause = { OR: [commentedFilter, reactedFilter, post_guardadosFilter] };
      } else if (mis_comentados) {
        whereClause = commentedFilter;
      } else if (mis_reaccionados) {
        whereClause = reactedFilter;
      } else if (posts_guardados) {
        whereClause = post_guardadosFilter;
      } else {
        // Comportamiento por defecto: devuelve los posts del propio usuario
        whereClause = { IDLOGIN: userId };
      }

      // 3. Ejecución Paralela: Contar el total de items y traer los items paginados
      const [totalPosts, posts] = await Promise.all([
        this.prisma.post.count({ where: whereClause }),
        this.prisma.post.findMany({
          where: whereClause,
          orderBy: { FECHA_CREACION: 'desc' },
          include: postProfileIncludes,
          take: limitNumber,
          skip: skip, // 👈 Se añade el skip para la paginación real
        })
      ]);

      // 4. Convertir y formatear cada post
      const formattedPosts = await Promise.all(
        posts.map((p) => this.postFormatter.fetchAndFormat(p.ID_POST, userId)),
      );

      // 5. Retorno con la estructura solicitada (Data + Meta)
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

   async createPost(
    userId: number,
    createPostDto: CreatePostDto,
    files?: Express.Multer.File[],
  ) {
    // 1. Verificar que el usuario exista
    const userLogin = await this.prisma.login.findUnique({
      where: { IDLOGIN: userId },
    });

    if (!userLogin) {
      return this.responseService.error(
        'Usuario no encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }

    // Usaremos un arreglo de objetos para rastrear archivos y carátulas subidas a S3
    const uploadedMedia: Array<{ filename: string, thumb: string | null, type: string }> = [];

    try {
      const checkExistsFn = (slug: string) =>
        this.prisma.post
          .count({ where: { SLUG_POST: slug } })
          .then((count) => count > 0);

      const slugBase = createPostDto.descripcion.substring(0, 40);
      const slug = await generateUniqueSlug(slugBase, checkExistsFn);

      const etiquetaOps = (createPostDto.etiquetas || []).map(tagName => ({
        etiqueta: {
          connectOrCreate: {
            where: { NOMBRE_ETIQUETA: tagName },
            create: { NOMBRE_ETIQUETA: tagName },
          }
        }
      }));

      // =========================================================
      // 2. PROCESAMIENTO DE ARCHIVOS MULTIMEDIA Y CARÁTULAS
      // =========================================================
      if (files && files.length > 0) {
        // Aseguramos que exista la carpeta /temp en el proyecto
        const tempDir = path.resolve(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        for (const file of files) {
          const isVideo = file.originalname.match(/\.(mp4|mov|avi|mkv)$/i) || file.mimetype.startsWith('video/');

          if (isVideo) {
            // A. Guardar el video temporalmente para que FFmpeg/ffprobe lo pueda leer
            const tempVideoPath = path.join(tempDir, `${Date.now()}_${file.originalname}`);
            fs.writeFileSync(tempVideoPath, file.buffer);

            // ==========================================
            // 🚨 NUEVO: VALIDACIÓN DE DURACIÓN (MÁX 10 MIN)
            // ==========================================
            const esVideoValido = await this.frameVideoService.validarVideo(tempVideoPath);
            
            if (!esVideoValido) {
              // 1. Limpiamos el archivo temporal antes de abortar (VITAL)
              fs.unlinkSync(tempVideoPath);
              
              // 2. Retornamos el JSON de error deteniendo el proceso
              return this.responseService.error(
                `El video '${file.originalname}' supera el límite permitido de 10 minutos.`,
                HttpStatus.BAD_REQUEST,
              );
        
            }
            // ==========================================

            // B. Extraer la carátula
            const tempThumbName = `thumb_${Date.now()}`;
            const tempThumbPath = await this.frameVideoService.extraerCaratula(tempVideoPath, tempDir, tempThumbName);

            // C. Leer la imagen generada y convertirla en un objeto compatible con tu s3Service
            const thumbBuffer = fs.readFileSync(tempThumbPath);
            const thumbFile = {
              buffer: thumbBuffer,
              originalname: `${tempThumbName}.jpg`,
              mimetype: 'image/jpeg',
            } as Express.Multer.File;

            // D. Subir AMBOS a AWS S3 en paralelo
            const [videoS3Key, thumbS3Key] = await Promise.all([
              this.s3Service.uploadFile(file, 'post', slug),
              this.s3Service.uploadFile(thumbFile, 'post', slug)
            ]);

            // E. Limpiar archivos temporales para no llenar el disco del servidor
            fs.unlinkSync(tempVideoPath);
            fs.unlinkSync(tempThumbPath);

            // F. Guardar en el historial
            uploadedMedia.push({ filename: videoS3Key, thumb: thumbS3Key, type: 'video' });
            
          } else {
            // Si es imagen, simplemente la subimos normal
            const imageS3Key = await this.s3Service.uploadFile(file, 'post', slug);
            uploadedMedia.push({ filename: imageS3Key, thumb: null, type: 'image' });
          }
        }
      }

      // =========================================================
      // 3. GUARDAR EN BASE DE DATOS
      // =========================================================
      const newPost = await this.prisma.post.create({
        data: {
          DESCRIPCION: createPostDto.descripcion,
          SLUG_POST: slug,
          IDLOGIN: userLogin.IDLOGIN,
          FECHA_CREACION: new Date(),
          post_etiquetas: {
            create: etiquetaOps
          },
          multimedia_post: uploadedMedia.length > 0
              ? {
                  create: uploadedMedia.map((media, index) => ({
                    ARCHIVO_MULTIMEDIA: media.filename,
                    THUMBNAIL_MULTIMEDIA: media.thumb, // 👈 Ahora enviamos la clave real de S3
                    ORDER: index + 1,
                    MULTIMEDIA_TYPE: media.type,
                  })),
                }
              : undefined,
        },
        include: { multimedia_post: true },
      });

      const formattedPost = await this.postFormatter.fetchAndFormat(
        newPost.ID_POST, userId,
      );

      return this.responseService.success(
        'Publicación creada exitosamente.',
        formattedPost,
      );

    } catch (error) {

       if (error instanceof HttpException) {
        throw error; // Esto lanza el JSON al cliente
      }
      // =========================================================
      // 4. ROLLBACK (Si algo falla, borramos todo de S3)
      // =========================================================
      if (uploadedMedia.length > 0) {
        await Promise.all(
          uploadedMedia.flatMap(media => {
            const keysToDelete = [this.s3Service.deleteFile('post', media.filename)];
            // Si hay carátula, también mandamos a borrarla
            if (media.thumb) {
              keysToDelete.push(this.s3Service.deleteFile('post', media.thumb));
            }
            return keysToDelete;
          })
        );
      }
      
      console.error('Error creando la publicación:', error);
      return this.responseService.error(
        'No se pudo crear la publicación.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

   /**
   * Actualiza un post existente, incluyendo su descripción y/o elementos multimedia.
   * @param userId ID del usuario que realiza la acción.
   * @param postId ID del post a actualizar.
   * @param dto Datos de la actualización.
   * @param file Archivo multimedia opcional para añadir o reemplazar.
   */
  async updatePost(
    userId: number,
    postId: any,
    dto: UpdatePostDto,
    file?: Express.Multer.File,
  ) {
    const post = await this.prisma.post.findFirst({
      where: { ID_POST: postId, IDLOGIN: userId },
    });

    if (!post) {
      return this.responseService.error(
        'Publicación no encontrada o no tienes permiso para editarla.',
        HttpStatus.NOT_FOUND,
      );
    }

    // Arreglo para acumular todos los archivos que debemos borrar de S3 si la operación es un éxito
    const s3KeysToDelete: string[] = []; 
    
    // Variables para hacer rollback si la base de datos falla
    let uploadedS3Key: string | null = null;
    let uploadedThumbS3Key: string | null = null; 

    try {
      await this.prisma.$transaction(async (tx) => {
        // --- SECCIÓN A: LÓGICA DE GESTIÓN DE MULTIMEDIA ---
        const hasNewFile = !!file;
        let slug = post.SLUG_POST;
        
        if (dto.descripcion && dto.descripcion !== post.DESCRIPCION) {
          const checkExistsFn = (s: string) => tx.post.count({ where: { SLUG_POST: s, NOT: { ID_POST: postId } } }).then(c => c > 0);
          slug = await generateUniqueSlug(dto.descripcion, checkExistsFn);
        }

        if (hasNewFile) {
          const isVideo = file.originalname.match(/\.(mp4|mov|avi|mkv)$/i) || file.mimetype.startsWith('video/');

          // =======================================================
          // 1. PROCESAR EL NUEVO ARCHIVO (Video o Imagen)
          // =======================================================
          if (isVideo) {
            const tempDir = path.resolve(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const tempVideoPath = path.join(tempDir, `${Date.now()}_${file.originalname}`);
            fs.writeFileSync(tempVideoPath, file.buffer);

            // ==========================================
            // 🚨 NUEVO: VALIDACIÓN DE DURACIÓN (MÁX 10 MIN)
            // ==========================================
            const esVideoValido = await this.frameVideoService.validarVideo(tempVideoPath);
            
            if (!esVideoValido) {
              // 1. Limpiamos el archivo temporal antes de abortar (VITAL)
              fs.unlinkSync(tempVideoPath);
              
              // 2. Retornamos el JSON de error deteniendo la edición
              return this.responseService.error(
                `El nuevo video '${file.originalname}' supera el límite permitido de 10 minutos.`,
                HttpStatus.BAD_REQUEST,
              );
            }
            // ==========================================

            const tempThumbName = `thumb_${Date.now()}`;
            const tempThumbPath = await this.frameVideoService.extraerCaratula(tempVideoPath, tempDir, tempThumbName);

            const thumbBuffer = fs.readFileSync(tempThumbPath);
            const thumbFile = {
              buffer: thumbBuffer,
              originalname: `${tempThumbName}.jpg`,
              mimetype: 'image/jpeg',
            } as Express.Multer.File;

            // Subimos ambos en paralelo
            [uploadedS3Key, uploadedThumbS3Key] = await Promise.all([
              this.s3Service.uploadFile(file, 'post', post.SLUG_POST),
              this.s3Service.uploadFile(thumbFile, 'post', post.SLUG_POST)
            ]);

            fs.unlinkSync(tempVideoPath);
            fs.unlinkSync(tempThumbPath);
          } else {
            // Es una imagen, solo subimos el archivo original
            uploadedS3Key = await this.s3Service.uploadFile(file, 'post', post.SLUG_POST);
          }

          // =======================================================
          // 2. GUARDAR EN BASE DE DATOS (Añadir o Reemplazar)
          // =======================================================
          if (dto.multimedia_setting?.id) {
            // REEMPLAZAR
            const mediaToUpdate = await tx.multimedia_post.findFirst({
              where: { ID_MULTIMEDIA: dto.multimedia_setting.id, ID_POST: postId },
            });
            
            if (!mediaToUpdate) {
              throw new Error(`El elemento multimedia con ID ${dto.multimedia_setting.id} no pertenece a esta publicación.`);
            }

            // Marcamos el archivo antiguo (y su carátula si la tenía) para borrarlos luego
            if (mediaToUpdate.ARCHIVO_MULTIMEDIA) s3KeysToDelete.push(mediaToUpdate.ARCHIVO_MULTIMEDIA);
            if (mediaToUpdate.THUMBNAIL_MULTIMEDIA) s3KeysToDelete.push(mediaToUpdate.THUMBNAIL_MULTIMEDIA);

            await tx.multimedia_post.update({
              where: { ID_MULTIMEDIA: dto.multimedia_setting.id },
              data: {
                ARCHIVO_MULTIMEDIA: uploadedS3Key,
                THUMBNAIL_MULTIMEDIA: uploadedThumbS3Key, // 👈 Se guarda la nueva carátula (o null si es imagen)
                ORDER: dto.multimedia_setting.orden,
                DESCRIPCION: dto.multimedia_setting.descripcion,
                MULTIMEDIA_TYPE: isVideo ? 'video' : 'image',
              },
            });
          } else {
            // AÑADIR
            const mediaCount = await tx.multimedia_post.count({ where: { ID_POST: postId } });
            if (mediaCount >= 10) throw new Error('No se pueden añadir más de 10 elementos multimedia.');
            
            const maxOrder = (await tx.multimedia_post.aggregate({
                where: { ID_POST: postId },
                _max: { ORDER: true },
            }))._max?.ORDER ?? 0;

            await tx.multimedia_post.create({
              data: {
                ID_POST: postId,
                ARCHIVO_MULTIMEDIA: uploadedS3Key,
                THUMBNAIL_MULTIMEDIA: uploadedThumbS3Key, // 👈 Nueva carátula
                ORDER: maxOrder + 1,
                MULTIMEDIA_TYPE: isVideo ? 'video' : 'image'
              },
            });
          }
        } 
        else if (dto.multimedia_setting?.id) {
          // MANEJAR MULTIMEDIA EXISTENTE SIN SUBIR ARCHIVO (Actualizar metadatos o Eliminar)
          const mediaToManage = await tx.multimedia_post.findFirst({
            where: { ID_MULTIMEDIA: dto.multimedia_setting.id, ID_POST: postId },
          });

          if (!mediaToManage) throw new Error(`El elemento multimedia con ID ${dto.multimedia_setting.id} no pertenece a esta publicación.`);

          if (dto.multimedia_setting.orden !== undefined || dto.multimedia_setting.descripcion !== undefined) {
            // ACTUALIZAR METADATOS
            await tx.multimedia_post.update({
              where: { ID_MULTIMEDIA: dto.multimedia_setting.id },
              data: {
                ORDER: dto.multimedia_setting.orden,
                DESCRIPCION: dto.multimedia_setting.descripcion,
              },
            });
          } else {
            // ELIMINAR (Guardamos el archivo y la carátula antiguos para borrarlos)
            if (mediaToManage.ARCHIVO_MULTIMEDIA) s3KeysToDelete.push(mediaToManage.ARCHIVO_MULTIMEDIA);
            if (mediaToManage.THUMBNAIL_MULTIMEDIA) s3KeysToDelete.push(mediaToManage.THUMBNAIL_MULTIMEDIA);
            
            await tx.multimedia_post.delete({
              where: { ID_MULTIMEDIA: dto.multimedia_setting.id },
            });
          }
        }

        // --- SECCIÓN B: LÓGICA DE DATOS DEL POST ---
        await tx.post.update({
          where: { ID_POST: postId },
          data: {
            DESCRIPCION: dto.descripcion,
            SLUG_POST: slug,
            FECHA_EDICION: new Date(),
            post_etiquetas: dto.hasOwnProperty('etiquetas')
              ? {
                  deleteMany: {}, 
                  create: (dto.etiquetas || []).map(tagName => ({
                    etiqueta: {
                      connectOrCreate: {
                        where: { NOMBRE_ETIQUETA: tagName },
                        create: { NOMBRE_ETIQUETA: tagName },
                      }
                    }
                  }))
                }
              : undefined,
          },
        });
      }); // Fin de la transacción

      // =======================================================
      // 3. LIMPIEZA POST-TRANSACCIÓN (Éxito)
      // =======================================================
      if (s3KeysToDelete.length > 0) {
        await Promise.all(
          // Cambié 'posts' a 'post' para que coincida con tu uploadFile('post', ...)
          s3KeysToDelete.map(key => this.s3Service.deleteFile('post', key)) 
        );
      }

      const formattedPost = await this.postFormatter.fetchAndFormat(postId, userId);

      return this.responseService.success(
        'Publicación actualizada exitosamente.',
        formattedPost,
      );

    } catch (error) {

      if (error instanceof HttpException) {
        throw error; // Esto lanza el JSON al cliente
      }
      // =======================================================
      // 4. ROLLBACK (Fallo la transacción)
      // =======================================================
      if (uploadedS3Key) {
        await this.s3Service.deleteFile('post', uploadedS3Key);
      }
      if (uploadedThumbS3Key) {
        await this.s3Service.deleteFile('post', uploadedThumbS3Key);
      }

      console.error('Error al actualizar la publicación:', error);
      return this.responseService.error(
        error.message || 'Error al actualizar la publicación.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

   /**
   * Elimina una publicación y todos sus archivos multimedia asociados (incluyendo carátulas).
   * @param userId ID del usuario que realiza la acción.
   * @param postId ID del post a eliminar.
   */
  async deletePost(userId: number, postId: any) {
    const post = await this.prisma.post.findFirst({
      where: { ID_POST: postId, IDLOGIN: userId },
      include: { multimedia_post: true }, // Incluir para obtener las claves de los archivos
    });

    if (!post) {
      return this.responseService.error(
        'Publicación no encontrada o no tienes permiso para eliminarla.',
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      // 1. Recopilar TODAS las claves (Archivo original + Carátula)
      const keysToDelete = post.multimedia_post
        // flatMap une todo en un solo arreglo plano
        .flatMap((media) => [media.ARCHIVO_MULTIMEDIA, media.THUMBNAIL_MULTIMEDIA])
        // Filtramos para quitar los null o undefined (por ejemplo, imágenes que no tienen THUMBNAIL)
        .filter((key): key is string => !!key);

      // 2. Eliminar los archivos de S3 primero. Si esto falla, la base de datos no se toca.
      if (keysToDelete.length > 0) {
        await Promise.all(
          keysToDelete.map((key) => this.s3Service.deleteFile('post', key)),
        );
      }

      // 3. Eliminar el post de la base de datos.
      // La eliminación en cascada se encargará de los registros en `multimedia_post`.
      await this.prisma.post.delete({ where: { ID_POST: postId } });

      return this.responseService.success(
        'Publicación eliminada exitosamente.',
      );
    } catch (error) {
      console.error('Error al eliminar la publicación:', error);
      // Nota: En un escenario real, aquí se podría añadir lógica para manejar
      // el caso en que los archivos de S3 se borraron pero la BD falló.
      return this.responseService.error(
        error.message || 'Error al eliminar la publicación.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

   /**
     * Añade un hotspot a un elemento multimedia específico de un post.
     * @param userId - ID del usuario autenticado.
     * @param multimediaId - ID del elemento multimedia (imagen/video) al que se añadirá el hotspot.
     * @param dto - Contiene los datos del hotspot a crear.
     */
    async addHotspot(userId: number, multimediaId: number, dto: CreateHotspotDto) {
        // 1. Validar que el elemento multimedia exista y pertenezca al usuario.
        const multimediaItem = await this.prisma.multimedia_post.findFirst({
            where: {
                ID_MULTIMEDIA: multimediaId,
                post: {
                    IDLOGIN: userId,
                },
            },
        });

        if (!multimediaItem) {
            return this.responseService.error('El elemento multimedia no fue encontrado o no tienes permiso para editarlo.', HttpStatus.NOT_FOUND);
        }

        const postId = multimediaItem.ID_POST;
        let slugParaGuardar: string | null = null;
        try {
          
          if(dto.username){

          }
             if (dto.username) {
                const user = await this.prisma.login.findFirst({
                    where: {
                        USUARIO_LOGIN: dto.username,
                        IDESTADO: 1,
                        IDVERIFICACION: 7
                    },
                });

                // Si mandó un slug pero el producto no existe o no está disponible, lanzamos error
                if (!user) {
                    return this.responseService.error('El usuario seleccionado no está disponible o no existe.', HttpStatus.BAD_REQUEST);
                }

                // Si todo está bien, asignamos el slug real que vamos a guardar
                slugParaGuardar = user.USUARIO_LOGIN;
            }
            // 2. Crear el nuevo registro de hotspot
            await this.prisma.multimedia_pot.create({
                data: {
                    ID_MULTIMEDIA: multimediaId,
                    CORDENADA_X: dto.cordenada_x,
                    CORDENADA_Y: dto.cordenada_y,
                    DESCRIPCION: dto.descripcion,
                    USERNAME: slugParaGuardar,
                },
            });

             const formattedPost = await this.postFormatter.fetchAndFormat(
               postId, userId,
             );

            return this.responseService.success('Hotspot añadido exitosamente.', formattedPost);

        } catch (error) {
            console.error("Error al añadir hotspot:", error);
            // Error común: si un 'slug_producto' no existe en la tabla de productos.
            // Prisma puede no tener un código específico para esto, pero la validación de la FK fallará.
            if (error.code === 'P2003') { // Prisma foreign key constraint failed
                return this.responseService.error('El slug de producto proporcionado no es válido o no existe.', HttpStatus.BAD_REQUEST);
            }
            return this.responseService.error('No se pudo añadir el hotspot.', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    
    /**
     * Actualiza un hotspot existente.
     * @param userId - ID del usuario autenticado para validación de permisos.
     * @param hotspotId - ID del hotspot a actualizar.
     * @param dto - Datos a actualizar.
     */
    async updateHotspot(userId: number, hotspotId: any, dto: UpdateHotspotDto) {
        // 1. Validar que el hotspot exista y pertenezca al usuario a través de la cadena de relaciones.
      const hotspot = await this.prisma.multimedia_pot.findFirst({
        where: {
          ID_MULTIMEDIA_POT: hotspotId,
          multimedia_post: {
            post: {
              IDLOGIN: userId,
            },
          },
        },
        include: {
          multimedia_post: {
            include: {
              post: true,
            },
          },
        },
      });

        if (!hotspot) {
            return this.responseService.error('Hotspot no encontrado o no tienes permiso para editarlo.', HttpStatus.NOT_FOUND);
        }

        const postId = hotspot.multimedia_post.ID_POST;

        try {
            const user = await this.prisma.login.findUnique({
                where: {
                    USUARIO_LOGIN: dto.username,
                    IDESTADO: 1,
                    IDVERIFICACION: 7
                },
            });
            if (!user && dto.username) {
                return this.responseService.error('El usuario seleccionado no está disponible o no existe.', HttpStatus.BAD_REQUEST);
            }
            // 2. Actualizar el hotspot con los nuevos datos.
            await this.prisma.multimedia_pot.update({
                where: {
                    ID_MULTIMEDIA_POT: hotspotId
                },
                data: {
                    CORDENADA_X: dto.cordenada_x,
                    CORDENADA_Y: dto.cordenada_y,
                    DESCRIPCION: dto.descripcion,
                    USERNAME: dto.username ? user!.USUARIO_LOGIN : hotspot.USERNAME,
                }
            });

            const formattedPost = await this.postFormatter.fetchAndFormat(postId, userId);

            return this.responseService.success('Hotspot actualizado exitosamente.',formattedPost);

        } catch (error) {
            console.error("Error al actualizar el hotspot:", error);
            if (error.code === 'P2003') {
                return this.responseService.error('El slug de producto proporcionado no es válido o no existe.', HttpStatus.BAD_REQUEST);
            }
            return this.responseService.error('No se pudo actualizar el hotspot.', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Elimina un hotspot existente.
     * @param userId - ID del usuario autenticado para validación de permisos.
     * @param hotspotId - ID del hotspot a eliminar.
     */
    async deleteHotspot(userId: number, hotspotId: any) {
        // 1. Validar que el hotspot exista y pertenezca al usuario.
        const hotspot = await this.prisma.multimedia_pot.findFirst({
            where: {
                ID_MULTIMEDIA_POT: hotspotId,
                multimedia_post: {
                    post: {
                        IDLOGIN: userId,
                    }
                }
            },
            include:{
               multimedia_post:{
                 include:{
                  post:true
                 }
               }
            }
        });

        if (!hotspot) {
            return this.responseService.error('Hotspot no encontrado o no tienes permiso para eliminarlo.', HttpStatus.NOT_FOUND);
        }

        const postId = hotspot.multimedia_post.ID_POST;
        try {
            // 2. Eliminar el hotspot.
            await this.prisma.multimedia_pot.delete({
                where: {
                    ID_MULTIMEDIA_POT: hotspotId
                }
            });

             const formattedPost = await this.postFormatter.fetchAndFormat(postId, userId);

            return this.responseService.success('Hotspot eliminado exitosamente.',formattedPost);

        } catch (error) {
            console.error("Error al eliminar el hotspot:", error);
            return this.responseService.error('No se pudo eliminar el hotspot.', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}