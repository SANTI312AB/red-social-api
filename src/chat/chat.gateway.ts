import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HashIdService } from 'src/utilis/hash-id.service';

@WebSocketGateway({ cors: { origin: '*' } }) // 👈 Habilita CORS para que no te bloquee
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger = new Logger('ChatGateway');

  constructor(private readonly chatService: ChatService,
     private readonly jwtService: JwtService, // 👈 Lo inyectamos
      private readonly hashIdService: HashIdService
  ) {}

  async handleConnection(client: Socket) {
    try {
      // 🐛 BUG CORREGIDO: Faltaba el al final del split para obtener el token real, no el arreglo.
      const token = 
        client.handshake.auth?.token || 
        client.handshake.headers?.authorization?.split(' '); 

      if (!token) {
        throw new Error('Token no proporcionado');
      }

      const payload = this.jwtService.verify(token);

      // Asumimos que decode devuelve un arreglo (ej.), sacamos el primer valor.
      // Si tu servicio ya devuelve un número directo, quítale el
      const numericId = this.hashIdService.decode(payload.sub); 

      client.data.user = {
        ...payload,
        id: numericId 
      };

      // 🥇 NUEVO: Unimos al usuario a su "Sala Personal" para notificarle la lista de chats
      client.join(`usuario_${numericId}`);

      this.logger.log(`🟢 Usuario ${payload.username} autenticado (Sala personal: usuario_${numericId})`);
      
    } catch (error) {
      this.logger.error(`🔴 Conexión rechazada: ${client.id} - Token inválido`);
      client.disconnect(); 
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔴 Cliente Socket desconectado: ${client.id}`);
  }

  // 👇 ESTA FUNCIÓN ES EL "SINTONIZADOR" DEL CHAT
  @SubscribeMessage('abrir_chat')
  async handleAbrirChat(
    @MessageBody() payload: { idDestino: string; page?: number; limit?: number },
    @ConnectedSocket() client: Socket,
  ) {
    // 1. Obtenemos MI ID (decodificado en handleConnection)
    const miId = client.data.user?.id; 

    // 2. Decodificamos el ID del destinatario que viene de Flutter
    const decodedDestinoId = this.hashIdService.decode(payload.idDestino);

    if (!decodedDestinoId) {
      client.emit('error_chat', { message: 'ID de destino inválido.' });
      return;
    }

    // 3. Verificamos permisos (Seguimiento y Bloqueo)
    const puedeHablar = await this.chatService.verificarSiLoSigue(miId, decodedDestinoId);
    
    if (!puedeHablar) {
      client.emit('error_chat', { 
         message: 'No puedes acceder a este chat. Revisa si sigues al usuario o si te han bloqueado.' 
      });
      return;
    }

    // 4. LA PARTE CRÍTICA: Unirse a la sala para recibir mensajes en tiempo real
    const sala = this.chatService.generarIdSala(miId, decodedDestinoId);
    client.join(sala); // <--- Sin esto, no funciona el evento 'nuevo_mensaje'
    
    this.logger.log(`📱 Usuario ${miId} sintonizó la sala: ${sala}`);

    // 5. Enviamos el historial de mensajes para que la pantalla no salga vacía
    const historial = await this.chatService.obtenerHistorial(
      miId,
      decodedDestinoId,
      payload.page || 1,
      payload.limit || 20
    );
    
    client.emit('historial_mensajes', historial);
  }

  // 👇 Evento 1: Entrar a la conversación
   @SubscribeMessage('obtener_lista_chats')
  async handleObtenerListaChats(
    @MessageBody() payload: { page?: number; limit?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const miId = client.data.user?.id;

    if (!miId) return;

    try {
      const listaChats = await this.chatService.obtenerListaChats(
        miId,
        payload?.page || 1,
        payload?.limit || 10
      );
      
      client.emit('lista_chats_recibida', listaChats);
    } catch (error) {
      this.logger.error(`Error al obtener lista de chats: ${error.message}`);
      client.emit('error_chat', { message: 'No se pudo cargar la lista de chats' });
    }
  }

  // 👇 Evento 2: Enviar un nuevo mensaje
  @SubscribeMessage('enviar_mensaje')
  async handleEnviarMensaje(
    @MessageBody() payload: { idDestino: string; texto: string },
    @ConnectedSocket() client: Socket,
  ) {
    const miId = client.data.user?.id; // Obtenemos el ID del usuario desde el socket

    const decodedDestinoId = this.hashIdService.decode(payload.idDestino);

    if (decodedDestinoId === null) {
      client.emit('error_chat', { 
         message: 'ID de destino inválido.' 
      });
      return;
    }

    // Volvemos a verificar si lo sigue por seguridad
    const loSigue = await this.chatService.verificarSiLoSigue(miId, decodedDestinoId);
    if (!loSigue) {
      client.emit('error_chat', { 
         message: 'No puedes enviar mensajes a este usuario, debes seguirlo primero.' 
      });
      return;
    }

    try {
      // 1. Lo guardamos en la base de datos de forma persistente
      const mensajeGuardado = await this.chatService.guardarMensaje(
        miId,
        decodedDestinoId,
        payload.texto,
      );

      // 2. Notificamos a AMBOS (remitente y destino) que hay un nuevo mensaje EN EL CHAT ABIERTO
      const sala = this.chatService.generarIdSala(miId, decodedDestinoId);
      this.server.to(sala).emit('nuevo_mensaje', mensajeGuardado);

      // 📢 3. NUEVO: Actualizamos la "Lista de Chats" en el menú principal de ambos usuarios
      this.server.to(`usuario_${decodedDestinoId}`).emit('actualizar_lista_chats', mensajeGuardado);
      this.server.to(`usuario_${miId}`).emit('actualizar_lista_chats', mensajeGuardado);

    } catch (error) {
      this.logger.error(`Error al procesar mensaje: ${error.message}`);
      client.emit('error_chat', { message: 'Hubo un problema al enviar tu mensaje.' });
    }
  }
}