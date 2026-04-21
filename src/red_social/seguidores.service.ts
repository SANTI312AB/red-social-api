import { HttpStatus, Injectable } from "@nestjs/common";
import { ResponseService } from "src/Interfaces/response.service";
import { PrismaService } from "src/prisma/prisma.service";
import { EstadoSeguidorDto } from "./dto/estado-seguidor.dto";
import { S3Service } from "src/s3/s3.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class SeguidoresService {
    constructor(
        private prisma: PrismaService,
        private responseService: ResponseService,
        private s3Service: S3Service,
    ){}

    async seguirUsuario(username: string, userId: number) {
       const usuarioASeguir = await this.prisma.login.findUnique((
        { where: { 
            USUARIO_LOGIN: username
        },
        include: {
          usuarios: true
        }
       }));

       if(!usuarioASeguir){
        return this.responseService.error("El usuario que intentas seguir no existe",HttpStatus.NOT_FOUND);
       }

      if(usuarioASeguir.IDLOGIN === userId){
        return this.responseService.error("No puedes seguirte a ti mismo",HttpStatus.BAD_REQUEST);
      }

        const yaSigue = await this.prisma.seguidores.findFirst({
          where: {
            AND: [
              { ID_SEGUIDOR: userId },
              { ID_SEGUIDO: usuarioASeguir.IDLOGIN }
            ]
          }
        });

        if(yaSigue){
          return this.responseService.error("Ya sigues a este usuario",HttpStatus.BAD_REQUEST);
        }

        try {
            const public_profile = usuarioASeguir.usuarios?.PUBLIC_PROFILE;
            let estado: string;
            if(public_profile && public_profile == true){
              estado = 'ACCEPTED';
            }else{
              estado = 'PENDING';
            }
            await this.prisma.seguidores.create({
          data: {
            ID_SEGUIDOR: userId,
            ID_SEGUIDO: usuarioASeguir.IDLOGIN,
            ESTADO: estado,
            FECHA_CREACION: new Date(),
            BLOQUEADO: false,
          }
        });

        return this.responseService.success("Has seguido al usuario correctamente");
        } catch (error) {
            return this.responseService.error("Error al seguir al usuario", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async dejarDeSeguirUsuario(username: string, userId: number) {
        const usuarioASeguir = await this.prisma.login.findUnique({
            where: {
                USUARIO_LOGIN: username
            }
        });

        if(!usuarioASeguir){
            return this.responseService.error("El usuario que intentas dejar de seguir no existe",HttpStatus.NOT_FOUND);
        }

        const yaSigue = await this.prisma.seguidores.findFirst({
            where: {
                AND: [
                    { ID_SEGUIDOR: userId },
                    { ID_SEGUIDO: usuarioASeguir.IDLOGIN }
                ]
            }
        });

        if(!yaSigue){
            return this.responseService.error("No sigues a este usuario",HttpStatus.BAD_REQUEST);
        }

        try {
            await this.prisma.seguidores.deleteMany({
            where: {
                ID_SEGUIDOR: userId,
                ID_SEGUIDO: usuarioASeguir.IDLOGIN
             }
          });

          return this.responseService.success("Has dejado de seguir al usuario correctamente");
        } catch (error) {
            return this.responseService.error("Error al dejar de seguir al usuario", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }


    async actualizarEstadoSeguidor(username: string, userId: number, dto: EstadoSeguidorDto) {
    const usuarioSolicitante = await this.prisma.login.findUnique({
        where: {
            USUARIO_LOGIN: username
        }
    });

    if (!usuarioSolicitante) {
        return this.responseService.error("El usuario solicitante no existe", HttpStatus.NOT_FOUND);
    }

    const solicitud = await this.prisma.seguidores.findFirst({
        where: {
            ID_SEGUIDO: userId, // El usuario autenticado es el que es seguido
            ID_SEGUIDOR: usuarioSolicitante.IDLOGIN // El que envía la solicitud es el seguidor
        }
    });

    if (!solicitud) {
        return this.responseService.error("No se encontró una solicitud de seguimiento de este usuario.", HttpStatus.NOT_FOUND);
    }

    // --- VALIDACIÓN CORREGIDA ---
    // La validación solo se aplica si se intenta cambiar el 'estado' (e.g., aceptar/rechazar)
    // y la solicitud ya no está pendiente. No previene cambiar el estado de 'bloqueado'.
    if (dto.estado &&  solicitud.ESTADO !== 'PENDING') {
        return this.responseService.error(
            `El estado de esta solicitud ya es '${solicitud.ESTADO.toLowerCase()}' y no se puede modificar.`,
            HttpStatus.BAD_REQUEST
        );
    }

    try {
        await this.prisma.seguidores.updateMany({
            where: {
                ID_SEGUIDO: userId,
                ID_SEGUIDOR: usuarioSolicitante.IDLOGIN
            },
            data: {
                ESTADO: dto.estado ?? solicitud.ESTADO,
                FECHA_ACTUALIZACION: new Date(),
                BLOQUEADO: dto.bloquear ?? solicitud.BLOQUEADO,
            }
        });

        return this.responseService.success("Estado del seguidor actualizado correctamente");
    } catch (error) {
        console.error("Error al actualizar el estado del seguidor:", error);
        return this.responseService.error("Error al actualizar el estado del seguidor", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

   async obtenerSeguidores(
    userId: number,
    seguidores?: boolean,
    seguidos?: boolean,
    estado?: string,
    orden?: 'asc' | 'desc',
    search_user?: string,
    page: number = 1,
    limit: number = 20
  ) {
    // 1. Configuración de Paginación
    const pageNumber = Math.max(1, Number(page));
    const limitNumber = Math.max(1, Number(limit));
    const skip = (pageNumber - 1) * limitNumber;

    const ordenFinal = orden || 'desc';
    const orderBy: Prisma.seguidoresOrderByWithRelationInput = {
      FECHA_CREACION: ordenFinal,
    };

    // Crear la cláusula de búsqueda de username si se proporciona
    const usernameFilter = search_user
      ? { USUARIO_LOGIN: { contains: search_user.toLowerCase() } }
      : {};

    // Variables que guardarán la data final y el total
    let listaFinal: any[] = [];
    let totalItems = 0;

    // 2. LÓGICA DE DECISIÓN
    const buscarSeguidos = seguidos && !seguidores;

    if (buscarSeguidos) {
      // --- CASO A: BUSCAR A LOS QUE EL USUARIO SIGUE (SEGUIDOS) ---
      const whereCondition = {
        ID_SEGUIDOR: userId,
        ...(estado && { ESTADO: estado }),
        login_seguidores_ID_SEGUIDOTologin: usernameFilter,
      };

      // Ejecución paralela de Conteo y Búsqueda
      const [total, dataSeguidos] = await Promise.all([
        this.prisma.seguidores.count({ where: whereCondition }),
        this.prisma.seguidores.findMany({
          where: whereCondition,
          include: {
            login_seguidores_ID_SEGUIDOTologin: { include: { usuarios: true } },
          },
          orderBy,
          skip: skip,
          take: limitNumber,
        })
      ]);

      totalItems = total;

      listaFinal = dataSeguidos.map((s) => {
        const followedUser = s.login_seguidores_ID_SEGUIDOTologin;
        return {
          username: followedUser.USUARIO_LOGIN,
          avatar: followedUser.usuarios?.AVATAR_USUARIO
            ? this.s3Service.getPublicUrl('avatars', followedUser.usuarios.AVATAR_USUARIO)
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
      const [total, dataSeguidores] = await Promise.all([
        this.prisma.seguidores.count({ where: whereCondition }),
        this.prisma.seguidores.findMany({
          where: whereCondition,
          include: {
            login_seguidores_ID_SEGUIDORTologin: { include: { usuarios: true } },
          },
          orderBy,
          skip: skip,
          take: limitNumber,
        })
      ]);

      totalItems = total;

      listaFinal = dataSeguidores.map((s) => {
        const followerUser = s.login_seguidores_ID_SEGUIDORTologin;
        return {
          username: followerUser.USUARIO_LOGIN,
          avatar: followerUser.usuarios?.AVATAR_USUARIO
            ? this.s3Service.getPublicUrl('avatars', followerUser.usuarios.AVATAR_USUARIO)
            : null,
          fecha_creacion: s.FECHA_CREACION,
          fecha_edicion: s.FECHA_ACTUALIZACION,
          estado: s.ESTADO,
          bloqueado: (s as any).BLOQUEADO,
          tipo: 'seguidor',
        };
      });
    }

    // 3. Retornamos la respuesta estructurada con la Metadata de paginación
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

}