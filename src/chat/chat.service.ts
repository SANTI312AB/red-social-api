import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { HashIdService } from 'src/utilis/hash-id.service';

@Injectable()
export class ChatService {
  private logger = new Logger(ChatService.name);
  constructor(
    private prisma: PrismaService,
    private hashIdService: HashIdService,
  ) {}

  generarIdSala(idRemitente: number, idDestino:any): string {
    const [menor, mayor] = [idRemitente, idDestino].sort((a, b) => a - b);
    return `chat_${menor}_${mayor}`;
  }

  
  async verificarSiLoSigue(
    idUsuarioA: number,
    idUsuarioB: number,
  ): Promise<boolean> {
    // 1. Traemos cualquier relación que exista entre ambos (de ida o de vuelta)
    const relaciones = await this.prisma.seguidores.findMany({
      where: {
        OR: [
          { ID_SEGUIDOR: idUsuarioA, ID_SEGUIDO: idUsuarioB },
          { ID_SEGUIDOR: idUsuarioB, ID_SEGUIDO: idUsuarioA },
        ],
      },
    });

    // 2. REGLA DE ORO (El bloqueo mata todo):
    // Si en alguna de las relaciones el bloqueo es verdadero, se cancela el chat inmediatamente.
    const hayBloqueo = relaciones.some((rel) => rel.BLOQUEADO === true);
    if (hayBloqueo) {
      return false; // Chat bloqueado
    }

    // 3. PERMISO PARA HABLAR:
    // Si no hay bloqueos, solo necesitamos que al menos UNO siga al otro (ESTADO: 'ACCEPTED')
    // Esto permite que el que sigue envíe el mensaje, y que el destinatario pueda responder.
    const haySeguimiento = relaciones.some((rel) => rel.ESTADO === 'ACCEPTED');

    return haySeguimiento;
  }

  
  /*async verificarSiLoSigue(idUsuarioA: number, idUsuarioB: number): Promise<boolean> {
    const cantidadRelaciones = await this.prisma.seguidores.count({
      where: {
        ESTADO: 'ACCEPTED',
        BLOQUEADO: false,
        OR: [
          // Condición 1: A sigue a B
          {
            ID_SEGUIDOR: idUsuarioA,
            ID_SEGUIDO: idUsuarioB,
          },
          // Condición 2: B sigue a A
          {
            ID_SEGUIDOR: idUsuarioB,
            ID_SEGUIDO: idUsuarioA,
          }
        ]
      },
    });

    // Si la cantidad es exactamente 2, significa que el seguimiento es mutuo
    return cantidadRelaciones === 2;
  }*/

  async guardarMensaje(idRemitente: number, idDestino: any, texto: string) {
    const sala = this.generarIdSala(idRemitente, idDestino);

    return this.prisma.mensaje_chat.create({
      data: {
        IDLOGIN_REMITENTE: idRemitente,
        IDLOGIN_DESTINO: idDestino,
        SALA: sala,
        TEXTO: texto,
        LEIDO: false,
      },
      include: {
        // Incluimos el nombre del remitente para que el frontend lo pueda mostrar fácil
        remitente: { select: { USUARIO_LOGIN: true } },
      },
    });
  }

  // 4. Recuperar el historial de chat
   async obtenerHistorial(
    idRemitente: number, 
    idDestino: any, 
    page: number = 1,
    limit: number = 10 // 10 es un mejor estándar visual para chats
  ) {
    const sala = this.generarIdSala(idRemitente, idDestino);
    
    // 1. Promise.all ejecuta ambas consultas al mismo tiempo para mayor velocidad.
    // Buscamos el total de mensajes para saber cuántas páginas existen.
    const [totalMensajes, mensajesCrudos] = await Promise.all([
      this.prisma.mensaje_chat.count({ where: { SALA: sala } }),
      
      this.prisma.mensaje_chat.findMany({
        where: { SALA: sala },
        // IMPORTANTE: Ordenamos descendente para traer los MÁS RECIENTES primero
        orderBy: { CREADO_EN: 'desc' }, 
        skip: (page - 1) * limit,
        take: limit,
        include: {
          remitente: { select: { USUARIO_LOGIN: true } },
        },
      })
    ]);

    // 2. Como los trajimos al revés (del más nuevo al más viejo), 
    // le damos la vuelta al arreglo para que en pantalla el más viejo quede arriba y el nuevo abajo.
    const mensajesCronologicos = mensajesCrudos.reverse();

    // 3. Mapeamos los datos limpios para el frontend
    const pages = mensajesCronologicos.map((mensaje) => {
      const esMio = mensaje.IDLOGIN_REMITENTE === idRemitente;
      return {
        id: this.hashIdService.encode(mensaje.IDMENSAJE),
        texto: mensaje.TEXTO,
        creadoEn: mensaje.CREADO_EN,
        userName: mensaje.remitente.USUARIO_LOGIN,
        leido: mensaje.LEIDO,
        enviadoPorMi: esMio,
      };
    });

    // 4. Calculamos metadatos útiles para que el frontend sepa si debe mostrar un "Cargando más..."
    const totalPages = Math.ceil(totalMensajes / limit);

    return {
      pages,
      meta: {
        totalMensajes,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages, // Devuelve true si aún quedan mensajes viejos por cargar
      }
    };
  }


  // 5. Obtener la Bandeja de Entrada (Lista de Chats)
  async obtenerListaChats(miId: number, page: number = 1, limit: number = 10) {
    // Buscamos mensajes donde el usuario participa
    const conversacionesCrudas = await this.prisma.mensaje_chat.findMany({
      where: {
        OR: [
          { IDLOGIN_REMITENTE: miId },
          { IDLOGIN_DESTINO: miId },
        ],
      },
      // Prisma agrupa por sala y toma el primer resultado que encuentra
      distinct: ['SALA'], 
      orderBy: { CREADO_EN: 'desc' }, // Trae los chats con actividad más reciente
      skip: (page - 1) * limit,
      take: limit + 1, // Pedimos 1 extra para validar si hay más páginas
      include: {
        remitente: { select: { USUARIO_LOGIN: true } },
        destino: { select: { USUARIO_LOGIN: true } },
      },
    });

    const hasNextPage = conversacionesCrudas.length > limit;
    if (hasNextPage) conversacionesCrudas.pop();

    const data = conversacionesCrudas.map((conv) => {
      const fuiYoElUltimo = conv.IDLOGIN_REMITENTE === miId;
      
      // Identificamos quién es el "otro" en el chat
      const idOtroNumerico = fuiYoElUltimo ? conv.IDLOGIN_DESTINO : conv.IDLOGIN_REMITENTE;
      const usernameOtro = fuiYoElUltimo ? conv.destino.USUARIO_LOGIN : conv.remitente.USUARIO_LOGIN;

      return {
        sala: conv.SALA,
        ultimoMensaje: conv.TEXTO,
        creadoEn: conv.CREADO_EN,
        leido: conv.LEIDO,
        fuiYoElUltimo: fuiYoElUltimo,
        contacto: {
          idHash: this.hashIdService.encode(idOtroNumerico),
          username: usernameOtro,
        }
      };
    });

    return {
      data,
      meta: {
        currentPage: page,
        hasNextPage,
      }
    };
  }
}
