import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, login, usuarios, estados } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/s3/s3.service';
import { UserProfile } from './user-profile.interface';

// Definimos el tipo aquí para que sea más fácil de mantener.
export type UserWithRelations = login & {
  usuarios: usuarios;
  estados_login_IDVERIFICACIONToestados?: estados;
  post?: any[];
  seguidores_seguidores_ID_SEGUIDORTologin?: any[];
  seguidores_seguidores_ID_SEGUIDOTologin?: any[];
};

// Objeto de inclusión reutilizable. Esta es la clave para la consistencia.
export const userProfileIncludes = {
  usuarios: true,
  post: true,
  seguidores_seguidores_ID_SEGUIDORTologin: {
    where:{
      ESTADO:'ACCEPTED'
    }
  },
  seguidores_seguidores_ID_SEGUIDOTologin:{
    where:{
      ESTADO:'ACCEPTED'
    }
  },
  estados_login_IDVERIFICACIONToestados: true
};


@Injectable()
export class UserFormatterService {
  constructor(
    private readonly prisma: PrismaService, // Inyectamos Prisma para hacer consultas
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Busca un usuario por su ID y lo transforma en un perfil formateado.
   * Encapsula tanto la lógica de consulta como la de formateo.
   * @param userId El ID del usuario a buscar.
   * @returns El perfil de usuario formateado.
   * @throws NotFoundException si el usuario o su perfil no existen.
   */
  async privateProfile(userId: number): Promise<UserProfile> {
    const user = await this.prisma.login.findUnique({
      where: { IDLOGIN: userId },
      include: userProfileIncludes, // Usamos nuestro objeto de inclusión reutilizable
    });

    if (!user || !user.usuarios) {
      throw new NotFoundException('Usuario no encontrado o perfil incompleto.');
    }

    // Llamamos a la función de formateo interna.
    return this.formatProfile((user as unknown) as UserWithRelations);
  }


   async publicProfile(username: string, authUserId?: number): Promise<Partial<UserProfile>> {
   const user = await this.prisma.login.findUnique({
     where: { USUARIO_LOGIN: username },
     include: userProfileIncludes,
  });

   if (!user || !user.usuarios) {
    throw new NotFoundException('Usuario no encontrado o perfil incompleto.');
  }

    let siguiendo = false;
    // --- LÓGICA DE SEGUIMIENTO ---
    // Comprobar si el usuario autenticado (authUserId) está siguiendo al perfil que se está viendo (user.IDLOGIN).
    if (authUserId && authUserId !== user.IDLOGIN) {
        const followRecord = await this.prisma.seguidores.findFirst({
            where: {
                ID_SEGUIDOR: authUserId, // El que sigue
                ID_SEGUIDO: user.IDLOGIN, // Al que están viendo
                ESTADO: 'ACCEPTED', // (Opcional, si tienes estados de seguimiento)
            }
        });

        
        siguiendo = !!followRecord; // true si existe el registro, false si no
    }

   // Llamamos a la función de formateo interna, pasando el estado de 'siguiendo'.
   return this.public_formate_user((user as unknown) as UserWithRelations, siguiendo);
 }


  /**
   * Transforma un objeto de usuario ya obtenido en un perfil público.
   * @param login El objeto completo del usuario con sus relaciones.
   * @returns Un objeto con el formato definido por la interfaz UserProfile.
   */
  public formatProfile(login: UserWithRelations): UserProfile {
    const usuario = login.usuarios;

    let apellido = usuario.APELLIDO_USUARIO;

    const avatarUrl = usuario.AVATAR_USUARIO
      ? this.s3Service.getPublicUrl('avatars', usuario.AVATAR_USUARIO)
      : '';


    const postsCount = login.post?.length || 0;
    const seguidoresCount = login.seguidores_seguidores_ID_SEGUIDORTologin?.length || 0;
    const seguidosCount = login.seguidores_seguidores_ID_SEGUIDOTologin?.length || 0;

    
    
    const userProfile: UserProfile = {
      email: login.EMAIL_LOGIN,
      username: login.USUARIO_LOGIN,
      nombre: usuario.NOMBRE_USUARIO,
      apellido: apellido,
      celular: usuario.CELULAR_USUARIO,
      tipo_documento: usuario.TIPO_DOCUMENTO_USUARIO,
      dni: usuario.DNI_USUARIO,
      genero: usuario.GENERO_USUARIO,
      fecha_registro: login.FECHA_REGISTRO_LOGIN,
      fecha_nacimiento: usuario.FECHA_NACIMIENTO_USUARIO,
      avatar: avatarUrl,
      verificacion_email: login.estados_login_IDVERIFICACIONToestados?.NOMBRE_ESTADO || 'NO VERIFICADO',
      requiere_biometrico: usuario.USUARIO_REQUIERE_BIOMETRICO ?? false,
      verificacion_biometrico: (usuario as any).estados?.NOBRE_ESTADO || 'NO VERIFICADO',
      has_verified: usuario.USUARIO_HAS_VERIFIED ?? false,
      intentos_biometrico: usuario.LIMITE_BIOMETRICO,
      minimum_purchase_amount: usuario.MINIMUM_PURCHASE_BIOMETRIC,
      posts: postsCount,
      seguidores: seguidosCount,
      seguidos: seguidoresCount,
      public_profile: login.usuarios.PUBLIC_PROFILE || false,
      notificaciones_push:login.usuarios.NOTIFICACION_PUSH || false,
      notificaciones_email: login.usuarios.NOTIFICACION_EMAIL || false
    };

    return userProfile;
  }
  
   /**
   * Transforma un objeto de usuario ya obtenido en un perfil público.
   * @param login El objeto completo del usuario con sus relaciones.
   * @returns Un objeto con el formato definido por la interfaz UserProfile (parcial).
   */
  public public_formate_user(login: UserWithRelations,siguiendo: boolean): Partial<UserProfile> {
    const usuario = login.usuarios;

    let apellido = usuario.APELLIDO_USUARIO;

    const avatarUrl = usuario.AVATAR_USUARIO
      ? this.s3Service.getPublicUrl('avatars', usuario.AVATAR_USUARIO)
      : '';

    const postsCount = login.post?.length || 0;
    const seguidoresCount = login.seguidores_seguidores_ID_SEGUIDORTologin?.length || 0;
    const seguidosCount = login.seguidores_seguidores_ID_SEGUIDOTologin?.length || 0;


    const publicUserProfile: Partial<UserProfile> = {
      username: login.USUARIO_LOGIN,
      nombre: usuario.NOMBRE_USUARIO,
      apellido: apellido,
      genero: usuario.GENERO_USUARIO,
      fecha_registro: login.FECHA_REGISTRO_LOGIN,
      avatar: avatarUrl,
      verificacion_email: login.estados_login_IDVERIFICACIONToestados?.NOMBRE_ESTADO || 'NO VERIFICADO',
      verificacion_biometrico: (usuario as any).estados?.NOBRE_ESTADO || 'NO VERIFICADO',
      
      posts: postsCount,
      seguidores: seguidosCount,
      seguidos: seguidoresCount,
      siguiendo: siguiendo,
      public_profile: login.usuarios.PUBLIC_PROFILE || false,
    };

    return publicUserProfile;
  }

}