import { Prisma, PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

export function seguidorExtension(client: PrismaClient, eventEmitter: EventEmitter2) {
    const logger = new Logger('SeguidorExtension');
    
    return Prisma.defineExtension({
        name: 'nuevo-seguidor',
        query: {
            seguidores: {
                // 👇 1. Interceptamos todo (create, upsert, etc.)
                async $allOperations({ operation, args, query }) {
                    
                    // Solo nos interesa cuando se crea un nuevo seguidor
                    if (!['create', 'upsert'].includes(operation)) {
                        return query(args);
                    }

                    try {
                        // 2. Ejecutamos la inserción en BD PRIMERO
                        const result = await query(args); 
                        
                        // 3. Calmamos a TypeScript
                        const data = result as any;         
                        
                        // 4. Validamos que tengamos la Primary Key confirmada por la BD
                        if (data && data.ID_SEGUIRDORES) {
                            // Logueamos la PK para poder rastrear
                            logger.log(`➕ Relación creada (Op: ${operation}, PK: ${data.ID_SEGUIRDORES}): Usuario ${data.ID_SEGUIDOR} sigue a ${data.ID_SEGUIDO}. Desacoplando evento...`);
                            
                            // 👇 5. LA CURA DEL DEADLOCK: 300ms para asegurar el COMMIT en MariaDB
                            setTimeout(() => {
                                eventEmitter.emit('seguidor.nuevo', data);   
                            }, 300);
                        }
                                                            
                        return result;
                    } catch (error) {
                        logger.error(`❌ Error al crear seguidor: ${error.message}`);
                        throw error;
                    }
                }
            }
        }
    });
}

export function seguidorAceptadoExtension(client: PrismaClient, eventEmitter: EventEmitter2) {
    const logger = new Logger('SeguidorAceptadoExtension');
    
    return Prisma.defineExtension({
        name: 'aceptar-seguidor',
        query: {
            seguidores: {
                // 👇 1. Cambiamos a $allOperations
                async $allOperations({ operation, args, query }) {
                    
                    // Solo interceptamos si es update o upsert
                    if (!['update', 'upsert'].includes(operation)) {
                        return query(args);
                    }

                    // 👇 2. Curamos a TypeScript
                    const argsAny = args as any;

                    // 👇 3. Sorteamos la trampa de Prisma ({ set: 'ACCEPTED' })
                    const rawEstado = argsAny.data?.ESTADO;
                    const nuevoEstado = typeof rawEstado === 'object' ? rawEstado?.set : rawEstado;

                    // Si no están cambiando el estado a ACCEPTED, pasamos rápido.
                    if (nuevoEstado !== 'ACCEPTED') {
                        return query(args);
                    }

                    try {
                        let seguidorAntes: any = null;

                        // 4. OBTENER ESTADO ANTERIOR (Asegurando que hay un where válido)
                        if (argsAny.where) {
                            seguidorAntes = await client.seguidores.findUnique({
                                where: argsAny.where,
                                select: { ESTADO: true, ID_SEGUIRDORES: true }
                            });
                        }

                        // VALIDACIÓN ANTI-DUPLICADOS
                        // Si ya estaba aceptado, no hacemos nada especial, solo actualizamos.
                        if (seguidorAntes?.ESTADO === 'ACCEPTED') {
                            logger.debug(`El seguidor ${seguidorAntes.ID_SEGUIRDORES} ya estaba aceptado. No se emite evento.`);
                            return query(args);
                        }

                        // 5. EJECUTAR ACTUALIZACIÓN PRIMERO
                        const result = await query(args);
                        const data = result as any;

                        // 6. EMITIR EVENTO (Con retraso para evitar Deadlocks)
                        if (data && data.ESTADO === 'ACCEPTED') {
                            logger.log(`✅ Solicitud de seguidor ACEPTADA (Op: ${operation}, ID: ${data.ID_SEGUIRDORES}). Desacoplando evento...`);
                            
                            setTimeout(() => {
                                eventEmitter.emit('seguidor.aceptado', data);
                            }, 300);
                        }

                        return result;

                    } catch (error) {
                        logger.error(`❌ Error en middleware seguidorAceptado: ${error.message}`);
                        // Si falla nuestra lógica extra, ejecutamos la query original para no romper el flujo
                        return query(args);
                    }
                }
            }
        }
    });
}