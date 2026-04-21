import { Prisma, PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

export function postlikeExtension(client: PrismaClient, eventEmitter: EventEmitter2) {
    const logger = new Logger('PostLikeExtension');

    return Prisma.defineExtension({
        name: 'post-like',
        query: {
            post_reaccion: {
                async $allOperations({ operation, args, query }) {
                    
                    if (!['create', 'upsert'].includes(operation)) {
                        return query(args);
                    }

                    try {
                        const result = await query(args);

                        // 👇 LA SOLUCIÓN: Usamos 'as any' para calmar a TypeScript
                        const data = result as any;

                        // Ahora leemos de 'data' en lugar de 'result'
                        if (data && data.ID_POST_REACCION) {
                            
                            const idPost = data.ID_POST;
                            const idUsuario = data.IDLOGIN; 

                            logger.log(`👍 Like creado (Op: ${operation}) en Post ${idPost} por Usuario ${idUsuario}. Disparando evento...`);
                            
                            setTimeout(() => {
                                // Emitimos 'data' que tiene la estructura que espera tu Listener
                                eventEmitter.emit('like', data); 
                            }, 300);
                        }
                        
                        // Retornamos el 'result' original para no alterar el flujo de Prisma
                        return result;
                        
                    } catch (error) {
                        logger.error(`❌ Error al crear like en post: ${error.message}`);
                        throw error;
                    }
                }
            }
        }
    });
}

export function postcommentExtension(client: PrismaClient, eventEmitter: EventEmitter2) {
    const logger = new Logger('PostCommentExtension');

    return Prisma.defineExtension({
        name: 'post-comment',
        query: {
            comentarios_post: {
                // 👇 1. Cambiamos a $allOperations para ser todoterreno
                async $allOperations({ operation, args, query }) {
                    
                    // Solo nos interesan las operaciones que insertan comentarios
                    if (!['create', 'upsert'].includes(operation)) {
                        return query(args);
                    }

                    try {
                        // 2. Ejecutamos la inserción en la base de datos PRIMERO
                        const result = await query(args);

                        // 3. Convertimos a 'any' para evitar que TypeScript se asuste
                        const data = result as any;

                        // 4. Validamos que el comentario se haya creado correctamente
                        if (data && data.ID_POST) {
                            
                            // 👇 5. Leemos de 'data' (la respuesta real de la BD), NUNCA de 'args.data'
                            const idPost = data.ID_POST;
                            const idUsuario = data.IDLOGIN; 

                            logger.log(`💬 Comentario creado (Op: ${operation}) en Post ${idPost} por Usuario ${idUsuario}. Desacoplando evento...`);
                            
                            // 👇 6. LA CURA DEL DEADLOCK: 300ms de gracia para MariaDB
                            setTimeout(() => {
                                eventEmitter.emit('post.comment', data);
                            }, 300);
                        }

                        return result;
                        
                    } catch (error) {
                        logger.error(`❌ Error al crear comentario en post: ${error.message}`);
                        throw error;
                    }
                }
            }
        }
    });
}

export function handleRespuesta_CommentPostExtencion(client: PrismaClient, eventEmitter: EventEmitter2) {
    const logger = new Logger('PostRespuestaCommentExtension');
    
    return Prisma.defineExtension({
        name: 'post-respuesta-comment',
        query: {
            respuestas_post: {
                // 👇 1. Cambiamos a $allOperations
                async $allOperations({ operation, args, query }) {
                    
                    // Solo nos interesan las creaciones y actualizaciones tipo upsert
                    if (!['create', 'upsert'].includes(operation)) {
                        return query(args);
                    }

                    try {
                        // 2. Ejecutamos la inserción en la base de datos PRIMERO
                        const result = await query(args);

                        // 3. Convertimos a 'any' para evitar los bloqueos de TypeScript
                        const data = result as any;

                        // 4. Validamos que la respuesta se haya guardado y tenga su ID
                        if (data && data.ID_COMENTARIO) {
                            
                            // 👇 5. Leemos de 'data' (la base de datos), NUNCA de 'args.data'
                            const idComentario = data.ID_COMENTARIO;
                            const idUsuario = data.IDLOGIN;

                            logger.log(`↩️ Respuesta creada (Op: ${operation}) en Comentario ${idComentario} por Usuario ${idUsuario}. Desacoplando evento...`);
                            
                            // 👇 6. LA CURA DEL DEADLOCK: 300ms de gracia
                            setTimeout(() => {
                                eventEmitter.emit('post.respuesta_comment', data);
                            }, 300);
                        }

                        return result;
                        
                    } catch (error) {
                        logger.error(`❌ Error al crear respuesta a comentario en post: ${error.message}`);
                        throw error;
                    }
                }
            }
        }
    });
}