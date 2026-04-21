import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CronLogService {
  private readonly logger = new Logger(CronLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 1. Iniciar Log
  async startLog(nombreProceso: string): Promise<number> {
    try {
      const log = await this.prisma.command_log.create({
        data: {
          NOMBRE_PROCESO: nombreProceso,
          ESTADO: 'EJECUTANDO',
          FECHA_INICIO: new Date(),
        },
      });
      return log.ID_LOG;
    } catch (error) {
      this.logger.error(`Error al crear log de inicio para ${nombreProceso}`, error);
      return 0; // Retornamos 0 para no romper el proceso principal si falla el log
    }
  }

  // 2. Finalizar Log (Éxito o Error)
  async endLog(idLog: number, exito: boolean, mensaje: string = '') {
    if (idLog === 0) return; // Si no se creó el log inicial, no hacemos nada

    try {
      const fin = new Date();
      
      // Obtenemos el inicio para calcular duración
      const logInicial = await this.prisma.command_log.findUnique({
         where: { ID_LOG: idLog },
         select: { FECHA_INICIO: true }
      });
      
      const inicio = logInicial?.FECHA_INICIO ? new Date(logInicial.FECHA_INICIO) : fin;
      const duracion = Math.round((fin.getTime() - inicio.getTime()) / 1000);

      await this.prisma.command_log.update({
        where: { ID_LOG: idLog },
        data: {
          FECHA_FIN: fin,
          ESTADO: exito ? 'EXITO' : 'FALLIDO',
          MENSAJE: mensaje ? mensaje.substring(0, 5000) : null, // Cortamos si es muy largo
          DURACION_SEG: duracion
        },
      });
    } catch (error) {
      this.logger.error(`Error al cerrar log ID ${idLog}`, error);
    }
  }
}