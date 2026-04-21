import { HttpStatus,HttpException, Injectable } from "@nestjs/common";
import { ResponseService } from "src/Interfaces/response.service";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateReaccionDto } from "./dto/reaction.dto";
import { PostFormatterService } from "src/Interfaces/post-formatter.service";
import { CreateComentarioDto } from "./dto/create-comentario.dto";
import { UpdateComentarioDto } from "./dto/update-comentario.dto";
import { CreateRespuestaDto } from "./dto/create-respuesta.dto";
import { UpdateRespuestaDto } from "./dto/update-respuesta.dto";
import { HashIdService } from "src/utilis/hash-id.service";

@Injectable()
export class CometariosService {
  constructor(
    private prisma: PrismaService,
    private responseService: ResponseService,
    private postFormatter: PostFormatterService,
  ) {}

  /**
   * Crea o actualiza la reacción de un usuario en una publicación.
   * @param userId El ID del usuario que reacciona.
   * @param slug El slug de la publicación a la que se reacciona.
   * @param dto Contiene el ID del tipo de reacción.
   */
  async reaccion(userId: number, slug: string, dto: CreateReaccionDto) {
    try {
      // 1. Verificar que el post exista.
      const post = await this.prisma.post.findUnique({
        where: { SLUG_POST: slug },
      });

      if (!post) {
        // Tu responseService lanza una HttpException aquí
        return this.responseService.error(
          'Publicación no encontrada.',
          HttpStatus.NOT_FOUND,
        );
      }

      // 2. Usar 'upsert' para crear o actualizar la reacción.
      await this.prisma.post_reaccion.upsert({
        where: {
          IDLOGIN_ID_POST: {
            IDLOGIN: userId,
            ID_POST: post.ID_POST,
          },
        },
        update: {
          IDTIPO_REACCION: dto.id_tipo_reaccion,
          FECHA_REACCION: new Date(),
        },
        create: {
          IDLOGIN: userId,
          ID_POST: post.ID_POST,
          IDTIPO_REACCION: dto.id_tipo_reaccion,
          FECHA_REACCION: new Date(),
        },
      });

      const formattedPost = await this.postFormatter.fetchAndFormat(
        post.ID_POST,
        userId, // Te sugiero pasar el userId aquí para que el formato sepa que este usuario ya le dio like
      );

      return this.responseService.success(
        'Reacción guardada exitosamente.',
        formattedPost,
      );
    } catch (error) {
      // 👇 MAGIA: Si el error es una excepción HTTP controlada (como el 404 de arriba), la dejamos pasar.
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Error al procesar la reacción:', error);
      return this.responseService.error(
        'No se pudo procesar la reacción.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Elimina una reacción de un post.
   * @param userId El ID del usuario que elimina la reacción.
   * @param slug El slug de la publicación de la que se elimina la reacción.
   */
  async remove_reaccion(userId: number, slug: string) {
    try {
      const post = await this.prisma.post.findUnique({
        where: { SLUG_POST: slug },
      });

      if (!post) {
        return this.responseService.error(
          'No se encontró el post.',
          HttpStatus.NOT_FOUND,
        );
      }
      // 1. Identificar la reacción a eliminar usando el índice único compuesto.
      const reactionIdentifier = {
        IDLOGIN_ID_POST: {
          IDLOGIN: userId,
          ID_POST: post.ID_POST,
        },
      };

      // 2. Comprobar que la reacción exista antes de intentar borrarla.
      const existingReaction = await this.prisma.post_reaccion.findUnique({
        where: reactionIdentifier,
      });

      if (!existingReaction) {
        return this.responseService.error(
          'No se encontró una reacción para eliminar.',
          HttpStatus.NOT_FOUND,
        );
      }

      // 3. Si la reacción existe, proceder a eliminarla.
      await this.prisma.post_reaccion.delete({
        where: reactionIdentifier,
      });

      const formattedPost = await this.postFormatter.fetchAndFormat(
        post.ID_POST,
      );

      // 4. Devolver una respuesta de éxito con el mensaje corregido.
      return this.responseService.success(
        'Reacción eliminada exitosamente.',
        formattedPost,
      );
    } catch (error) {
      console.error('Error al eliminar la reacción:', error);
      return this.responseService.error(
        'No se pudo eliminar la reacción.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Añade un nuevo comentario a una publicación.
   * @param userId - ID del usuario que comenta.
   * @param slug - Slug de la publicación que se está comentando.
   * @param dto - Contiene el texto del comentario.
   */
  async addComentario(userId: number, slug: string, dto: CreateComentarioDto) {
    try {
      // 1. Verificar que la publicación exista.
      const post = await this.prisma.post.findUnique({
        where: { SLUG_POST: slug },
      });

      if (!post) {
        return this.responseService.error(
          'Publicación no encontrada.',
          HttpStatus.NOT_FOUND,
        );
      }

      // 2. Crear el nuevo comentario en la base de datos.
      await this.prisma.comentarios_post.create({
        data: {
          COMENTARIO: dto.comentario,
          ID_POST: post.ID_POST,
          IDLOGIN: userId,
          FECHA_COMENTARIO: new Date(),
        },
      });

      // 3. Obtener y devolver la vista actualizada y formateada del post.

      return this.responseService.success('Comentario añadido exitosamente.');
    } catch (error) {
      console.error('Error al añadir el comentario:', error);
      return this.responseService.error(
        'No se pudo añadir el comentario.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Actualiza un comentario existente.
   * @param userId - ID del usuario que realiza la acción.
   * @param comentarioId - ID del comentario a actualizar.
   * @param dto - Datos para la actualización.
   */
  async updateComentario(
    userId: number,
    comentarioId: any,
    dto: UpdateComentarioDto,
  ) {
    try {
      // 1. Buscar el comentario y verificar que pertenece al usuario.
      const comentario = await this.prisma.comentarios_post.findFirst({
        where: {
          ID_COMENTARIO: comentarioId,
          IDLOGIN: userId,
        },
      });

      if (!comentario) {
        return this.responseService.error(
          'Comentario no encontrado o no tienes permiso para editarlo.',
          HttpStatus.NOT_FOUND,
        );
      }

      // 2. Actualizar el comentario.
      await this.prisma.comentarios_post.update({
        where: { ID_COMENTARIO: comentarioId },
        data: {
          COMENTARIO: dto.comentario,
          FECHA_EDICION: new Date(),
        },
      });

      // 3. Devolver la vista actualizada del post.
      return this.responseService.success(
        'Comentario actualizado exitosamente.',
      );
    } catch (error) {
      console.error('Error al actualizar el comentario:', error);
      return this.responseService.error(
        'No se pudo actualizar el comentario.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Elimina un comentario existente.
   * @param userId - ID del usuario que realiza la acción.
   * @param comentarioId - ID del comentario a eliminar.
   */
  async deleteComentario(userId: number, comentarioId: any) {
    try {
      // 1. Buscar el comentario y verificar que pertenece al usuario.
      const comentario = await this.prisma.comentarios_post.findFirst({
        where: {
          ID_COMENTARIO: comentarioId,
          IDLOGIN: userId,
        },
      });

      if (!comentario) {
        return this.responseService.error(
          'Comentario no encontrado o no tienes permiso para eliminarlo.',
          HttpStatus.NOT_FOUND,
        );
      }

      // Guardar el ID del post antes de eliminar el comentario
      const postId = comentario.ID_POST;

      // 2. Eliminar el comentario.
      await this.prisma.comentarios_post.delete({
        where: { ID_COMENTARIO: comentarioId },
      });

      // 3. Devolver la vista actualizada del post.
      return this.responseService.success('Comentario eliminado exitosamente.');
    } catch (error) {
      console.error('Error al eliminar el comentario:', error);
      return this.responseService.error(
        'No se pudo eliminar el comentario.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Añade una nueva respuesta a un comentario.
   * @param userId - ID del usuario que responde.
   * @param comentarioId - ID del comentario al que se está respondiendo.
   * @param dto - Contiene el texto de la respuesta.
   */
  async addRespuesta(
    userId: number,
    comentarioId: any,
    dto: CreateRespuestaDto,
  ) {
    try {
      const comentario = await this.prisma.comentarios_post.findUnique({
        where: { ID_COMENTARIO: comentarioId },
      });

      if (!comentario) {
        return this.responseService.error(
          'Comentario no encontrado.',
          HttpStatus.NOT_FOUND,
        );
      }

      await this.prisma.respuestas_post.create({
        data: {
          RESPUESTA: dto.respuesta,
          ID_COMENTARIO: comentarioId,
          IDLOGIN: userId,
          FECHA_RESPUESTA: new Date(),
        },
      });

      return this.responseService.success('Respuesta añadida exitosamente.');
    } catch (error) {
      console.error('Error al añadir la respuesta:', error);
      return this.responseService.error(
        'No se pudo añadir la respuesta.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Actualiza una respuesta existente.
   * @param userId - ID del usuario que realiza la acción.
   * @param respuestaId - ID de la respuesta a actualizar.
   * @param dto - Datos para la actualización.
   */
  async updateRespuesta(
    userId: number,
    respuestaId: any,
    dto: UpdateRespuestaDto,
  ) {
    try {
      const respuesta = await this.prisma.respuestas_post.findFirst({
        where: {
          ID_RESPUESTA: respuestaId,
          IDLOGIN: userId,
        },
      });

      if (!respuesta) {
        return this.responseService.error(
          'Respuesta no encontrada o no tienes permiso para editarla.',
          HttpStatus.NOT_FOUND,
        );
      }

      await this.prisma.respuestas_post.update({
        where: { ID_RESPUESTA: respuestaId },
        data: {
          RESPUESTA: dto.respuesta,
          FECHA_EDICION: new Date(),
        },
      });

      return this.responseService.success(
        'Respuesta actualizada exitosamente.',
      );
    } catch (error) {
      console.error('Error al actualizar la respuesta:', error);
      return this.responseService.error(
        'No se pudo actualizar la respuesta.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Elimina una respuesta existente.
   * @param userId - ID del usuario que realiza la acción.
   * @param respuestaId - ID de la respuesta a eliminar.
   */
  async deleteRespuesta(userId: number, respuestaId: any) {
    try {
      const respuesta = await this.prisma.respuestas_post.findFirst({
        where: {
          ID_RESPUESTA: respuestaId,
          IDLOGIN: userId,
        },
      });

      if (!respuesta) {
        return this.responseService.error(
          'Respuesta no encontrada o no tienes permiso para eliminarla.',
          HttpStatus.NOT_FOUND,
        );
      }

      await this.prisma.respuestas_post.delete({
        where: { ID_RESPUESTA: respuestaId },
      });

      return this.responseService.success('Respuesta eliminada exitosamente.');
    } catch (error) {
      console.error('Error al eliminar la respuesta:', error);
      return this.responseService.error(
        'No se pudo eliminar la respuesta.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async likes_comentario(userId: number, idComentario: any) {
    try {
      // 1. Validar que el usuario exista (ya lo haces al inicio)
      const user = await this.prisma.login.findUnique({
        where: {
          IDLOGIN: userId,
          IDESTADO: 1,
          IDVERIFICACION: 7,
        },
      });

      if (!user) {
        return this.responseService.error(
          'Usuario no encontrado.',
          HttpStatus.NOT_FOUND,
        );
      }

      // 2. Validar que el comentario exista y obtener el ID del post padre
      const comentario = await this.prisma.comentarios_post.findUnique({
        where: { ID_COMENTARIO: idComentario },
      });

      if (!comentario) {
        return this.responseService.error(
          'El comentario no existe.',
          HttpStatus.NOT_FOUND,
        );
      }

      // 3. Buscar si ya existe un "me gusta" de este usuario para este comentario
      const likeIdentifier = {
        IDLOGIN_ID_COMENTARIO: {
          IDLOGIN: user.IDLOGIN,
          ID_COMENTARIO: idComentario,
        },
      };

      const existingLike = await this.prisma.likes_comentario.findUnique({
        where: { IDLOGIN_ID_COMENTARIO: likeIdentifier.IDLOGIN_ID_COMENTARIO },
      });

      let message: string;

      // 4. Lógica de Toggle: Si el like existe, se borra. Si no, se crea.
      if (existingLike) {
        // --- Caso A: El like existe -> Eliminar (Unlike) ---
        await this.prisma.likes_comentario.delete({
          where: {
            IDLOGIN_ID_COMENTARIO: likeIdentifier.IDLOGIN_ID_COMENTARIO,
          },
        });
        message = 'Like eliminado exitosamente.';
      } else {
        // --- Caso B: El like no existe -> Crear (Like) ---
        await this.prisma.likes_comentario.create({
          data: {
            IDLOGIN: user.IDLOGIN,
            ID_COMENTARIO: idComentario,
            FECHA: new Date(), // Asumiendo que tienes este campo
          },
        });
        message = 'Like añadido exitosamente.';
      }

      // 5. Devolver la vista actualizada y formateada del post

      return this.responseService.success(message);
    } catch (error) {
      console.error('Error al procesar el like:', error);
      return this.responseService.error(
        'No se pudo procesar el like.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async likes_respuestas(userId: number, idRespuesta: any) {
    try {
      // 1. Validar que el usuario exista (ya lo haces al inicio)
      const user = await this.prisma.login.findUnique({
        where: {
          IDLOGIN: userId,
          IDESTADO: 1,
          IDVERIFICACION: 7,
        },
      });

      if (!user) {
        return this.responseService.error(
          'Usuario no encontrado.',
          HttpStatus.NOT_FOUND,
        );
      }

      // 2. Validar que el comentario exista y obtener el ID del post padre
      const comentario = await this.prisma.respuestas_post.findUnique({
        where: { ID_RESPUESTA: idRespuesta },
      });

      if (!comentario) {
        return this.responseService.error(
          'La respuesta del comentario no existe.',
          HttpStatus.NOT_FOUND,
        );
      }

      // 3. Buscar si ya existe un "me gusta" de este usuario para este comentario
      const likeIdentifier = {
        IDLOGIN_ID_RESPUESTA: {
          IDLOGIN: user.IDLOGIN,
          ID_RESPUESTA: idRespuesta,
        },
      };

      const existingLike = await this.prisma.likes_respuesta.findUnique({
        where: { IDLOGIN_ID_RESPUESTA: likeIdentifier.IDLOGIN_ID_RESPUESTA },
      });

      let message: string;

      // 4. Lógica de Toggle: Si el like existe, se borra. Si no, se crea.
      if (existingLike) {
        // --- Caso A: El like existe -> Eliminar (Unlike) ---
        await this.prisma.likes_respuesta.delete({
          where: { IDLOGIN_ID_RESPUESTA: likeIdentifier.IDLOGIN_ID_RESPUESTA },
        });
        message = 'Like eliminado exitosamente.';
      } else {
        // --- Caso B: El like no existe -> Crear (Like) ---
        await this.prisma.likes_respuesta.create({
          data: {
            IDLOGIN: user.IDLOGIN,
            ID_RESPUESTA: idRespuesta,
            FECHA: new Date(), // Asumiendo que tienes este campo
          },
        });
        message = 'Like añadido exitosamente.';
      }

      // 5. Devolver la vista actualizada y formateada del post
      return this.responseService.success(message);
    } catch (error) {
      console.error('Error al procesar el like:', error);
      return this.responseService.error(
        'No se pudo procesar el like.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}