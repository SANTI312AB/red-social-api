import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface LogData {
  status: number;
  function: string;
  ip: string;
  userId?: number;
  response: string;
  method: string;
}

@Injectable()
export class LoggingService {
  constructor(private readonly prisma: PrismaService) {}

  async createLog(log: LogData): Promise<void> {
    try {
      await this.prisma.logs_api.create({
        data: {
          ESTATUS_LOG: String(log.status),
          FUNCTION_LOG: log.function,
          FECHA_LOG: new Date(),
          IP_ADDRESS: log.ip,
          IDLOGIN: log.userId,
          RESPONSE_LOG: log.response,
          METHOD_LOG: log.method,
        },
      });
    } catch (error) {
      // Evita que un error de logging detenga la aplicación
      console.error('Error al guardar el log en la base de datos:', error);
    }
  }
}