import { Injectable, Logger } from "@nestjs/common";
import { use } from "passport";
import { PrismaService } from "src/prisma/prisma.service";
import { FirebaseService } from "./firebase.service";

@Injectable()
export class NotificacionesService{
    private readonly logger = new Logger(NotificacionesService.name);

    constructor(
        private prisma: PrismaService,
        private firebase: FirebaseService
    ){}

    async notificacion(userId:number, titulo:string, detalle:string, codigo:string, categoria:string, remite?:string){
        
        const user= await this.prisma.login.findFirst({
            where:{
                IDLOGIN:userId,
                IDESTADO:1,
                IDVERIFICACION:7
            }
        });

        if(!user){
          this.logger.error('Usuario no encontrado.');
          return;
        }

        try {

          await this.prisma.$transaction(async (tx) => {
              await tx.notificaciones.create({
                 data: {
                    IDLOGIN:user.IDLOGIN,
                    IDESTADO:33,
                    FECHA_REGISTRO:new Date(),
                    TITULO:titulo,
                    DETALLE: detalle,
                    CODIGO: codigo,
                    CATEGORIA:categoria,
                    REMITE:remite
                 },
              });
           });
            
        } catch (error) {
            this.logger.error('Error al registrar la notificacion.',error);
        }
    }

  async notificaciones_push(userId: number, titulo: string, cuerpo: string, dataPayload?: any) {
    // 1. Buscamos todos los dispositivos vinculados a este usuario
    const dispositivosUsuario = await this.prisma.login_dispositivos.findMany({
      where: { IDLOGIN: userId },
      include: { 
        dispositivos: true // Traemos la info de la tabla 'dispositivos'
      } 
    });

    if (dispositivosUsuario.length === 0) {
      this.logger.debug(`El usuario ${userId} no tiene dispositivos registrados. Saltando notificación...`);
      return { success: false, message: 'No hay dispositivos registrados.' };
    }

    // 2. Extraemos solo los strings de los tokens en un arreglo limpio
    const tokens = dispositivosUsuario.map(ld => ld.dispositivos.TOKEN);

    // 3. Armamos el "Paquete" para Firebase
    const mensaje = {
      notification: {
        title: titulo,
        body: cuerpo,
      },
      data: dataPayload || {}, // Aquí puedes mandar IDs ocultos, ej: { idVenta: "123" }
      tokens: tokens, // Firebase Multicast permite enviar a muchos tokens a la vez
    };

    try {
      // 4. Disparamos la notificación a Google
      const respuesta = await this.firebase.getMessaging().sendEachForMulticast(mensaje);
      
      this.logger.log(`📲 Push a Usuario ${userId}: ${respuesta.successCount} exitosas, ${respuesta.failureCount} fallidas.`);

      // 👇 5. PRO-TIP: LIMPIEZA AUTOMÁTICA DE TOKENS MUERTOS
      if (respuesta.failureCount > 0) {
        const tokensParaBorrar: string[] = [];
        
        // Revisamos qué tokens fallaron y por qué
        respuesta.responses.forEach((resp, index) => {
          if (!resp.success) {
            const error = resp.error?.code;
            // Si el token es inválido o el usuario desinstaló la app
            if (error === 'messaging/invalid-registration-token' || error === 'messaging/registration-token-not-registered') {
              tokensParaBorrar.push(tokens[index]);
            }
          }
        });

        // Borramos los tokens inservibles de nuestra base de datos
        if (tokensParaBorrar.length > 0) {
          await this.prisma.dispositivos.deleteMany({
            where: { TOKEN: { in: tokensParaBorrar } }
          });
          this.logger.log(`🗑️ Limpieza: Se eliminaron ${tokensParaBorrar.length} tokens inactivos o desinstalados.`);
        }
      }

      return { success: true, enviados: respuesta.successCount };

    } catch (error) {
      this.logger.error(`🔥 Error crítico enviando push a usuario ${userId}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

}