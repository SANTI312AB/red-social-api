import { HttpStatus, Injectable } from '@nestjs/common';
import { ResponseService } from 'src/Interfaces/response.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/s3/s3.service';
import { HashIdService } from 'src/utilis/hash-id.service';
import { notificacionDto } from './dto/notificaciones.dto';

@Injectable()
export class misNotificacionesService {
  constructor(
    private prisma: PrismaService,
    private responsiveResponsive: ResponseService,
    private hashIdService: HashIdService,
    private s3Service: S3Service,
  ) {}

   async notificaciones(
    userId: number,
    estado: string = 'ENVIADA',
    categoria?: string,
    orden: 'asc' | 'desc' = 'desc',
    notificacionId?: number,
    page: number = 1,
    limit: number = 20
  ) {
    // 1. Configuración de Paginación
    const pageNumber = Math.max(1, Number(page));
    const limitNumber = Math.max(1, Number(limit));
    const skip = (pageNumber - 1) * limitNumber;

    // 2. Validar Usuario
    const user = await this.prisma.login.findFirst({
      where: {
        IDLOGIN: userId,
        IDESTADO: 1,
        IDVERIFICACION: 7,
      },
    });

    if (!user) {
      return this.responsiveResponsive.error(
        'Usuario no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    // ==========================================
    // CASO A: Buscar UNA notificación específica
    // ==========================================
    if (notificacionId) {
      const notificacion = await this.prisma.notificaciones.findFirst({
        where: {
          IDLOGIN: user.IDLOGIN,
          ID_NOTIFICACION: notificacionId, // Usamos el ID directo
        },
        // ⚠️ CORRECCIÓN: Quitamos take y skip de aquí. Buscamos un registro único, no listamos.
      });

      if (!notificacion) {
        return this.responsiveResponsive.error(
          'Notificación no encontrada',
          HttpStatus.NOT_FOUND,
        );
      }

      const dato = await this.uniqueformatearNotificacion(notificacion);
      return this.responsiveResponsive.success('Notificación encontrada', dato);
    }

    // ==========================================
    // CASO B: Listar TODAS las notificaciones (CON PAGINACIÓN)
    // ==========================================
    const estadoDb = await this.prisma.estados.findFirst({
      where: { NOMBRE_ESTADO: estado, TIPO_ESTADO: 'NOTIFICACIONES' },
    });

    // Separamos el 'where' en una variable para usarlo en la búsqueda y en el conteo total
    const whereCondition = {
      IDLOGIN: user.IDLOGIN,
      IDESTADO: estadoDb?.IDESTADO,
      CATEGORIA: categoria,
    };

    // Usamos Promise.all para buscar la data y contar los totales al mismo tiempo (Más rápido)
    const [notificaciones, totalItems] = await Promise.all([
      this.prisma.notificaciones.findMany({
        where: whereCondition,
        orderBy: {
          FECHA_REGISTRO: orden,
        },
        take: limitNumber, // 👈 Límite por página (ej. 20)
        skip: skip,        // 👈 Cuántos saltar
      }),
      this.prisma.notificaciones.count({
        where: whereCondition, // 👈 Cuenta el total real ignorando la paginación
      })
    ]);

    // Formatear la lista
    const lista = await Promise.all(
      notificaciones.map((item) => this.formatearNotificacion(item)),
    );

    // Calcular metadatos del paginador
    const totalPages = Math.ceil(totalItems / limitNumber);

    // Devolvemos la data y los metadatos de paginación agrupados
    return this.responsiveResponsive.success(
      'Notificaciones obtenidas.',
      {
        pages: lista,
        meta: {
          totalItems,
          itemsPerPage: limitNumber,
          totalPages,
          currentPage: pageNumber
        }
      }
    );
  }

  // Función auxiliar para mantener el formato consistente y limpio
  private async formatearNotificacion(item: any) {
    let avatarUrl: string | null = null;
    let nombreRemite = item.REMITE || 'Sistema';

    // Solo buscamos en la BD si hay un remitente (y no es nulo/vacío)
    if (item.REMITE) {
      const usuarioRemite = await this.prisma.login.findFirst({
        where: {
          USUARIO_LOGIN: item.REMITE,
        },
        include: {
          usuarios: true,
        },
      });

      // Si encontramos al usuario y tiene avatar, generamos la URL
      if (usuarioRemite?.usuarios?.AVATAR_USUARIO) {
        avatarUrl = this.s3Service.getPublicUrl(
          'avatars',
          usuarioRemite.usuarios.AVATAR_USUARIO,
        );
      }
    }

    return {
      id: this.hashIdService.encode(item.ID_NOTIFICACION),
      fecha: item.FECHA_REGISTRO,
      titulo: item.TITULO,
      codigo: item.CODIGO,
      categoria: item.CATEGORIA,
      remite: {
        user: nombreRemite,
        avatar: avatarUrl,
      },
    };
  }

  private async uniqueformatearNotificacion(item: any) {
    let avatarUrl: string | null = null;
    let nombreRemite = item.REMITE || 'Sistema';

    // Solo buscamos en la BD si hay un remitente (y no es nulo/vacío)
    if (item.REMITE) {
      const usuarioRemite = await this.prisma.login.findFirst({
        where: {
          USUARIO_LOGIN: item.REMITE,
        },
        include: {
          usuarios: true,
        },
      });

      // Si encontramos al usuario y tiene avatar, generamos la URL
      if (usuarioRemite?.usuarios?.AVATAR_USUARIO) {
        avatarUrl = this.s3Service.getPublicUrl(
          'avatars',
          usuarioRemite.usuarios.AVATAR_USUARIO,
        );
      }
    }

    return {
      id: this.hashIdService.encode(item.ID_NOTIFICACION),
      fecha: item.FECHA_REGISTRO,
      titulo: item.TITULO,
      detalle: item.DETALLE,
      codigo: item.CODIGO,
      categoria: item.CATEGORIA,
      remite: {
        user: nombreRemite,
        avatar: avatarUrl,
      },
    };
  }

  async notificacionupdate(userId: number, notificacionId: number, dto: notificacionDto) {
    const user= await this.prisma.login.findFirst({
      where:{
        IDLOGIN:userId,
        IDESTADO:1,
        IDVERIFICACION:7
      }
    });

    if(!user){
      return this.responsiveResponsive.error('Usuario no encontrado', HttpStatus.NOT_FOUND);
    }

    const estadoDb = await this.prisma.estados.findFirst({
      where: { NOMBRE_ESTADO: dto.estado, TIPO_ESTADO: 'NOTIFICACIONES' },
    });

    if(!estadoDb){
      return this.responsiveResponsive.error('Estado no encontrado.', HttpStatus.NOT_FOUND);
    }

    const fecha_notificacion= await this.prisma.notificaciones.findFirst({
      where:{
        ID_NOTIFICACION: notificacionId,
        IDESTADO:user.IDLOGIN
      }
    });

    if (fecha_notificacion?.FECHA_EDITO) {
      return this.responsiveResponsive.error(
        'La notificación ya fue actualizada.',
        HttpStatus.CONFLICT,
      );
    }

    try {
         const notificacion=  await this.prisma.notificaciones.update({
          where:{ID_NOTIFICACION: notificacionId,
            IDLOGIN:user.IDLOGIN
          },
          data:{
              IDESTADO: estadoDb?.IDESTADO,
              FECHA_EDITO:new Date()
          }
         });

         const dato = await this.uniqueformatearNotificacion(notificacion);
         return this.responsiveResponsive.success('Notificacion actualizada',dato);
    } catch (error) {
       return this.responsiveResponsive.error('Error al actualizar la notificacion', error);
    }
  }
}
