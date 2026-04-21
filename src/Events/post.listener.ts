import { Injectable, Logger } from "@nestjs/common";
import { EmailService } from "src/email/email.service";
import { PrismaService } from "src/prisma/prisma.service";
import type { post_reaccion, comentarios_post, respuestas_post } from '@prisma/client';
import { OnEvent } from "@nestjs/event-emitter";
import { NotificacionesService } from "src/Services/notificaciones.service";

@Injectable()
export class postListener {
    private readonly logger = new Logger(postListener.name);

    constructor(
        private prisma: PrismaService,
        private emailService: EmailService,
        private guardarNotificacion: NotificacionesService
    ) {}

    // ⚡ IMPORTANTE: { async: true } envía esto a segundo plano
    // Así el usuario no espera a que se envíe el correo para ver su like.
    @OnEvent('like', { async: true })
    async handLikePost(payload: post_reaccion) {
        
        this.logger.log(`📧 Procesando notificación para Like ID: ${payload.ID_POST_REACCION}`);

        try {
            // 1. Buscamos datos completos (Relaciones)
            const reaccionCompleta = await this.prisma.post_reaccion.findUnique({
                where: { ID_POST_REACCION: payload.ID_POST_REACCION },
                include: {
                    login: true, // Quien dio like
                    tipo_reaccion: true,
                    post: {
                        include: {
                            login: {
                                include: { usuarios: true }
                            } // Dueño del post
                        }
                    }
                }
            });

            if (!reaccionCompleta) {
                this.logger.warn(`Reacción no encontrada en BD (ID: ${payload.ID_POST_REACCION})`);
                return;
            }

            const autorPost = reaccionCompleta.post.login;
            const quienDioLike = reaccionCompleta.login;

            // 🛑 2. VALIDACIÓN AUTO-LIKE:
            // Si el que dio like es el mismo dueño del post, no enviamos nada.
            if (autorPost.IDLOGIN === quienDioLike.IDLOGIN) {
                this.logger.debug('El usuario reaccionó a su propio post. No se envía notificación.');
                return;
            }

            // 3. Preparación de datos   
            const emailDestino = autorPost.EMAIL_LOGIN;
            const nombreAutor = autorPost.USUARIO_LOGIN || 'Usuario';
            const nombreReaccionador = quienDioLike.USUARIO_LOGIN || 'Alguien';
            const tipoAccion = reaccionCompleta.tipo_reaccion.NOMBRE || 'reaccionó';
            const slugPost = reaccionCompleta.post.SLUG_POST;
            const notificacion_email = autorPost.usuarios?.NOTIFICACION_EMAIL === true;
            const notificacion_push = autorPost.usuarios?.NOTIFICACION_PUSH === true;

            const tituloMsg = `${nombreReaccionador} ha reaccionado a tu post.`;
            const cuerpoMsg = `${nombreReaccionador} ha reaccionado con "${tipoAccion}" a tu post.`;

            // A. Guardado en la base de datos (Campanita in-app) siempre se hace
            await this.guardarNotificacion.notificacion(
                autorPost.IDLOGIN,
                tituloMsg,
                cuerpoMsg, 
                slugPost,
                'Reacciones',
                nombreReaccionador
            );

            // B. Envío de Email
            if (emailDestino && notificacion_email) {
                try {
                    await this.emailService.sendPostNotification(
                        emailDestino,
                        slugPost,
                        tituloMsg, // Asunto
                        cuerpoMsg, // Mensaje corto
                        nombreAutor,
                        cuerpoMsg // Detalle
                    );
                    
                    this.logger.log(`✅ Notificación enviada por email a ${emailDestino}`);
                } catch (emailError) {
                    this.logger.error(`❌ Falló envío de correo: ${emailError.message}`);
                }
            } else if (!emailDestino) {
                this.logger.debug(`Saltando email: El autor (ID ${autorPost.IDLOGIN}) no tiene email configurado.`);
            }

            // C. Envío de Push a dispositivos
            if (notificacion_push) {
                try {
                    // Delegamos a tu servicio que maneja Firebase
                    await this.guardarNotificacion.notificaciones_push(
                        autorPost.IDLOGIN,
                        tituloMsg,
                        cuerpoMsg,
                        { tipo: 'Reacciones', slug: slugPost } // Payload para Flutter
                    );

                    this.logger.log(`📲 Push procesada para el usuario ${autorPost.IDLOGIN}`);
                } catch (pushError) {
                    this.logger.error(`❌ Falló envío de push: ${pushError.message}`);
                }
            }

        } catch (error) {
            this.logger.error(`🔥 Error crítico en postListener: ${error.message}`, error.stack);
        }
    }

    @OnEvent('post.comment', { async: true })
    async handleCommentPost(payload: comentarios_post) {
        // Lógica para manejar comentarios en posts
        this.logger.log(`📧 Procesando notificación para Comentario ID: ${payload.ID_COMENTARIO}`);

        try {
            const comentario = await this.prisma.comentarios_post.findUnique({
                where: { ID_COMENTARIO: payload.ID_COMENTARIO },
                include: {
                    login: true, // Quien comentó
                    post: {
                        include: {
                            login: {
                                include: {
                                    usuarios: true
                                }
                            } // Dueño del post
                        }
                    }
                }
            });

            if (!comentario) {
                this.logger.warn(`Comentario no encontrado en BD (ID: ${payload.ID_COMENTARIO})`);
                return;
            }

            const autorPost = comentario.post.login;
            const quienComento = comentario.login;
            
            // 🛑 VALIDACIÓN AUTO-COMENTARIO:
            if (autorPost.IDLOGIN === quienComento.IDLOGIN) {
                this.logger.debug('El usuario comentó en su propio post. No se envía notificación.');
                return;
            }

            const emailDestino = autorPost.EMAIL_LOGIN;
            const nombreAutor = autorPost.USUARIO_LOGIN || 'Usuario';
            const nombreComentador = quienComento.USUARIO_LOGIN || 'Alguien';
            const slugPost = comentario.post.SLUG_POST;
            
            // Verificamos las preferencias de notificación
            const notificacion_email = autorPost.usuarios?.NOTIFICACION_EMAIL === true;
            const notificacion_push = autorPost.usuarios?.NOTIFICACION_PUSH === true;

            // Mensajes estándar para usar en todos los canales
            const tituloMsg = `${nombreComentador} comentó en tu post.`;
            const cuerpoMsg = comentario.COMENTARIO; // El texto real del comentario

            // 👇 A. NOTIFICACIÓN IN-APP (Campanita) - Siempre se guarda en BD
            await this.guardarNotificacion.notificacion(
                autorPost.IDLOGIN,
                tituloMsg,
                cuerpoMsg,
                slugPost,
                'Comentarios', 
                nombreComentador 
            );

            // 👇 B. NOTIFICACIÓN POR EMAIL (Solo si acepta y tiene email)
            if (emailDestino && notificacion_email) {
                try {
                    await this.emailService.sendPostNotification(
                        emailDestino,          // destino
                        slugPost,              // slug del post
                        tituloMsg,             // asunto
                        cuerpoMsg,             // detalle
                        nombreAutor,           // nombre
                        tituloMsg              //asunto interno del HTML (puede ser igual al asunto o algo más descriptivo)
                    );
                    this.logger.log(`✅ Notificación por email enviada a ${emailDestino}`);
                } catch (emailError) {
                    this.logger.error(`❌ Falló envío de correo: ${emailError.message}`);
                }
            } else if (!emailDestino) {
                this.logger.debug(`Saltando email: El autor del post (ID ${autorPost.IDLOGIN}) no tiene email registrado.`);
            }

            // 👇 C. NOTIFICACIÓN PUSH FIREBASE (Solo si acepta)
            if (notificacion_push) {
                try {
                    // Delegamos a tu servicio que maneja Firebase
                    await this.guardarNotificacion.notificaciones_push(
                        autorPost.IDLOGIN,
                        tituloMsg,
                        cuerpoMsg,
                        { tipo: 'Comentarios', slug: slugPost } // Payload para Flutter
                    );

                    this.logger.log(`📲 Push procesada para el usuario ${autorPost.IDLOGIN}`);
                } catch (pushError) {
                    this.logger.error(`❌ Falló envío de push: ${pushError.message}`);
                }
            }

        } catch (error) {
            this.logger.error(`🔥 Error crítico en postListener (ID: ${payload.ID_COMENTARIO}): ${error.message}`, error.stack);
        }
    }

    @OnEvent('post.respuesta_comment', { async: true })
    async handleRespuesta_CommentPost(payload: respuestas_post) {
        this.logger.log(`📧 Procesando notificación para Respuesta a Comentario (ID: ${payload.ID_RESPUESTA})`);
        
        // 1. TRY GLOBAL: Protege toda la operación, incluida la BD
        try {
            // 2. OPTIMIZACIÓN: Usamos findUnique (es más rápido para buscar por ID)
            const respuesta = await this.prisma.respuestas_post.findUnique({
                where: { ID_RESPUESTA: payload.ID_RESPUESTA },
                include: {
                    login: true, // Quien respondió (El ACTOR)
                    comentarios_post: {
                        include: {
                            login: {
                                include: { usuarios: true }
                            }, // Dueño del comentario original (El DESTINATARIO)
                            post: true   // Para obtener el slug
                        }
                    }
                }
            });

            if (!respuesta) {
                this.logger.warn(`Respuesta no encontrada en BD (ID: ${payload.ID_RESPUESTA})`);
                return;
            }

            // Definición clara de roles para no confundirse
            const destinatario = respuesta.comentarios_post.login; // El dueño del comentario original
            const actor = respuesta.login; // Quien escribió la respuesta

            // 🛑 3. VALIDACIÓN AUTO-RESPUESTA
            if (destinatario.IDLOGIN === actor.IDLOGIN) {
                this.logger.debug('Usuario respondió a su propio comentario. Cancelando notificación.');
                return;
            }

            const emailDestino = destinatario.EMAIL_LOGIN;
            const nombreDestinatario = destinatario.USUARIO_LOGIN || 'Usuario'; 
            const nombreActor = actor.USUARIO_LOGIN || 'Alguien'; 
            const slugPost = respuesta.comentarios_post.post.SLUG_POST;
            
            const notificacion_email = destinatario.usuarios?.NOTIFICACION_EMAIL === true;
            const notificacion_push = destinatario.usuarios?.NOTIFICACION_PUSH === true;
            
            // Recortamos la respuesta si es muy larga para el preview de la notificación
            const respuestaCorta = respuesta.RESPUESTA.length > 50 
                ? respuesta.RESPUESTA.substring(0, 50) + '...' 
                : respuesta.RESPUESTA;

            // Mensajes estándar
            const tituloMsg = `¡${nombreActor} respondió a tu comentario!`;
            const cuerpoMsg = respuestaCorta; // Usamos el texto recortado

            // 👇 A. NOTIFICACIÓN IN-APP (Campanita) - Siempre se guarda
            await this.guardarNotificacion.notificacion(
                destinatario.IDLOGIN,
                tituloMsg,
                cuerpoMsg,
                slugPost,
                'Comentarios', 
                nombreActor
            );

            // 👇 B. NOTIFICACIÓN POR EMAIL
            if (emailDestino && notificacion_email) {
                try {
                    await this.emailService.sendPostNotification(
                        emailDestino,
                        slugPost,
                        tituloMsg,               // Asunto del correo (Subject)
                        cuerpoMsg,               // Mensaje pequeño o preview
                        nombreDestinatario,      // Nombre para el saludo ("Hola [Nombre]")
                        `Nueva respuesta en tu comentario` // Título interno del HTML
                    );
                    this.logger.log(`✅ Notificación por email enviada a ${emailDestino}`);
                } catch (emailError) {
                    this.logger.error(`❌ Falló envío de correo: ${emailError.message}`);
                }
            } else if (!emailDestino) {
                this.logger.debug(`Saltando email: El usuario destino (ID ${destinatario.IDLOGIN}) no tiene email registrado.`);
            }

            // 👇 C. NOTIFICACIÓN PUSH FIREBASE
            if (notificacion_push) {
                try {
                    await this.guardarNotificacion.notificaciones_push(
                        destinatario.IDLOGIN,
                        tituloMsg,
                        cuerpoMsg,
                        { tipo: 'RespuestaComentario', slug: slugPost } // Payload para Flutter
                    );
                    this.logger.log(`📲 Push procesada para el usuario ${destinatario.IDLOGIN}`);
                } catch (pushError) {
                    this.logger.error(`❌ Falló envío de push: ${pushError.message}`);
                }
            }

        } catch (error) {
            // Captura errores de Prisma u otros críticos
            this.logger.error(`🔥 Error crítico procesando respuesta_comment: ${error.message}`, error.stack);
        }
    }

}   

