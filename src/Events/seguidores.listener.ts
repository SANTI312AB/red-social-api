import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { EmailService } from "src/email/email.service";
import { PrismaService } from "src/prisma/prisma.service";
import type { seguidores } from '@prisma/client';
import { NotificacionesService } from "src/Services/notificaciones.service";


@Injectable()
export class seguidoresListener {
    private readonly logger = new Logger(seguidoresListener.name);
    constructor(
         private prisma:PrismaService,
         private emailService: EmailService,
         private guardarNotificacion: NotificacionesService
    ) {}

    @OnEvent('seguidor.nuevo', { async: true })
    async handleNuevoSeguidor(seguidor: seguidores) {
        this.logger.log(`📧 Iniciando proceso de notificación para nuevo seguidor (ID: ${seguidor.ID_SEGUIRDORES})`);
        
        try {
            const seguidorDetalles = await this.prisma.seguidores.findUnique({
                where: { ID_SEGUIRDORES: seguidor.ID_SEGUIRDORES },
                include: {
                    login_seguidores_ID_SEGUIDORTologin: true, // Quien empezó a seguir (ACTOR)
                    login_seguidores_ID_SEGUIDOTologin: {      // Quien recibe el follow (DESTINATARIO)
                        include: {
                            usuarios: true
                        }
                    }
                }
            });

            if (!seguidorDetalles) {
                this.logger.warn(`No se encontró el seguidor en BD (ID: ${seguidor.ID_SEGUIRDORES})`);
                return;
            }

            // Asignación clara de roles
            const destinatario = seguidorDetalles.login_seguidores_ID_SEGUIDOTologin;
            const actor = seguidorDetalles.login_seguidores_ID_SEGUIDORTologin;

            // 🛑 VALIDACIÓN AUTO-SEGUIMIENTO (Por seguridad)
            if (destinatario.IDLOGIN === actor.IDLOGIN) {
                this.logger.debug('Un usuario intentó seguirse a sí mismo. Cancelando notificación.');
                return;
            }

            const emailDestino = destinatario.EMAIL_LOGIN;
            const nombreDestinatario = destinatario.USUARIO_LOGIN || 'Usuario';
            const nombreActor = actor.USUARIO_LOGIN || 'Alguien';
            
            // Preferencias y estado de la cuenta
            const isPublic = destinatario.usuarios?.PUBLIC_PROFILE === true;
            const notificacion_email = destinatario.usuarios?.NOTIFICACION_EMAIL === true;
            const notificacion_push = destinatario.usuarios?.NOTIFICACION_PUSH === true;

            // 💡 1. DEFINIMOS EL MENSAJE SEGÚN LA PRIVACIDAD DE LA CUENTA
            const tituloMsg = `¡${nombreActor} ha comenzado a seguirte!`;
            let cuerpoMsg = '';

            if (isPublic) {
                cuerpoMsg = `¡${nombreActor} ahora puede ver tus publicaciones y actualizaciones!`;
            } else {
                cuerpoMsg = `Tu perfil es privado. Revisa tu lista de seguidores para aceptar o rechazar la solicitud de ${nombreActor}.`;
            }

            // 👇 A. NOTIFICACIÓN IN-APP (Campanita) - Siempre se guarda
            await this.guardarNotificacion.notificacion(
                destinatario.IDLOGIN,
                tituloMsg,
                cuerpoMsg,
                nombreActor, // Pasamos el nombre del usuario como referencia (slug/url)
                'Seguidores',
                nombreActor
            );

            // 👇 B. NOTIFICACIÓN POR EMAIL (Solo si acepta y tiene email)
            if (emailDestino && notificacion_email) {
                try {
                    await this.emailService.enviarEmailSeguidor(
                        emailDestino,
                        nombreDestinatario,
                        tituloMsg, // Asunto
                        cuerpoMsg, // Detalle
                        tituloMsg  // Título interno HTML
                    );
                    this.logger.log(`✅ Notificación por email enviada a ${emailDestino} (Perfil Público: ${isPublic})`);
                } catch (emailError) {
                    this.logger.error(`❌ Falló envío de correo: ${emailError.message}`);
                }
            } else if (!emailDestino) {
                this.logger.debug(`Saltando email: El usuario destino (ID ${destinatario.IDLOGIN}) no tiene email registrado.`);
            }

            // 👇 C. NOTIFICACIÓN PUSH FIREBASE (Solo si acepta)
            if (notificacion_push) {
                try {
                    await this.guardarNotificacion.notificaciones_push(
                        destinatario.IDLOGIN,
                        tituloMsg,
                        cuerpoMsg,
                        { tipo: 'NuevoSeguidor', usuario: nombreActor, esPublico: isPublic ? 'true' : 'false' } // Payload para Flutter
                    );
                    this.logger.log(`📲 Push procesada para el usuario ${destinatario.IDLOGIN}`);
                } catch (pushError) {
                    this.logger.error(`❌ Falló envío de push: ${pushError.message}`);
                }
            }

            this.logger.log(`✅ Proceso de notificación completado para seguidor ID: ${seguidor.ID_SEGUIRDORES}`);

        } catch (error) {
            this.logger.error(`🔥 Error crítico al procesar nuevo seguidor: ${error.message}`, error.stack);
        }
    }

    @OnEvent('seguidor.aceptado', { async: true })
    async handleSeguidorAceptado(seguidor: seguidores) {
        this.logger.log(`📧 Procesando notificación: Solicitud de seguimiento ACEPTADA`);

        try {
            // 1. Buscamos por la PK (ID_SEGUIRDORES)
            const seguidorDetalles = await this.prisma.seguidores.findUnique({
                where: { ID_SEGUIRDORES: seguidor.ID_SEGUIRDORES },
                include: {
                    // El que envió la solicitud (El que va a recibir la notificación) -> DESTINATARIO
                    login_seguidores_ID_SEGUIDORTologin: {
                        include: { usuarios: true }
                    }, 
                    // El que aceptó la solicitud (El dueño del perfil privado) -> ACTOR
                    login_seguidores_ID_SEGUIDOTologin: true
                }
            });

            if (!seguidorDetalles) {
                this.logger.warn(`Registro no encontrado ID: ${seguidor.ID_SEGUIRDORES}`);
                return;
            }

            // 2. Asignación clara de ROLES
            const destinatario = seguidorDetalles.login_seguidores_ID_SEGUIDORTologin;
            const actor = seguidorDetalles.login_seguidores_ID_SEGUIDOTologin;

            // Datos para el envío
            const emailDestinatario = destinatario.EMAIL_LOGIN;
            const nombreDestinatario = destinatario.USUARIO_LOGIN || 'Usuario';
            const nombreActor = actor.USUARIO_LOGIN || 'El usuario';

            const notificacion_email = destinatario.usuarios?.NOTIFICACION_EMAIL === true;
            const notificacion_push = destinatario.usuarios?.NOTIFICACION_PUSH === true;
            
            // 3. MENSAJES ESTÁNDAR
            const tituloMsg = `¡${nombreActor} aceptó tu solicitud!`;
            const cuerpoMsg = `Ahora ya puedes ver las fotos, videos y actualizaciones de ${nombreActor}.`;

            // 👇 A. NOTIFICACIÓN IN-APP (Campanita) - Siempre se guarda
            await this.guardarNotificacion.notificacion(
                destinatario.IDLOGIN,
                tituloMsg,
                cuerpoMsg,
                nombreActor, // Slug o nombre del usuario para que el front sepa a dónde ir
                'Seguidores',
                nombreActor
            );

            // 👇 B. NOTIFICACIÓN POR EMAIL (Solo si tiene email y acepta)
            if (emailDestinatario && notificacion_email) {
                try {
                    await this.emailService.enviarEmailSeguidor(
                        emailDestinatario,
                        nombreDestinatario,
                        tituloMsg, // Asunto
                        cuerpoMsg, // Mensaje cuerpo
                        tituloMsg  // Título interno
                    );
                    this.logger.log(`✅ Notificación por email enviada a ${emailDestinatario}.`);
                } catch (emailError) {
                    this.logger.error(`❌ Falló envío de correo: ${emailError.message}`);
                }
            } else if (!emailDestinatario) {
                this.logger.debug(`Saltando email: El usuario destino (ID ${destinatario.IDLOGIN}) no tiene email registrado.`);
            }

            // 👇 C. NOTIFICACIÓN PUSH FIREBASE (Solo si acepta)
            if (notificacion_push) {
                try {
                    await this.guardarNotificacion.notificaciones_push(
                        destinatario.IDLOGIN,
                        tituloMsg,
                        cuerpoMsg,
                        { tipo: 'SolicitudAceptada', usuario: nombreActor } // Payload para la app Flutter
                    );
                    this.logger.log(`📲 Push procesada para el usuario ${destinatario.IDLOGIN}`);
                } catch (pushError) {
                    this.logger.error(`❌ Falló envío de push: ${pushError.message}`);
                }
            }

        } catch (error) {
            this.logger.error(`🔥 Error crítico en handleSeguidorAceptado: ${error.message}`, error.stack);
        }
    }

}