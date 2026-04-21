import { HttpStatus, Injectable } from '@nestjs/common';
import { ResponseService } from 'src/Interfaces/response.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { DispositivoDto } from './dto/dispositivo.dto';

@Injectable()
export class DispositivosService {

  constructor(
    private readonly prisma: PrismaService,
    private responseService: ResponseService
) {}

  async registrarToken(userId: number, dto:DispositivoDto) {
    try {
      // 1. Buscamos si el token (dispositivo) ya existe en la base de datos
      let dispositivo = await this.prisma.dispositivos.findFirst({
        where: { TOKEN: dto.token }
      });

      // 2. Si no existe, lo creamos
      if (!dispositivo) {
        dispositivo = await this.prisma.dispositivos.create({
          data: {
            TOKEN: dto.token,
            CODIGO: dto.codigo, // ej: 'android', 'ios', 'web'
            FECHA_REGISTRO: new Date(),
            FECHA_ACTUALIZO: new Date(),
          }
        });
      } else {
        // Si existe, actualizamos su fecha (para saber que sigue activo)
        dispositivo = await this.prisma.dispositivos.update({
          where: { ID_DISPOSITIVO: dispositivo.ID_DISPOSITIVO },
          data: { FECHA_ACTUALIZO: new Date(), CODIGO: dto.codigo }
        });
      }

      // 3. Conectamos el dispositivo con el usuario en la tabla intermedia
      // Usamos upsert para evitar errores si la relación ya existía
      await this.prisma.login_dispositivos.upsert({
        where: {
          IDLOGIN_ID_DISPOSITIVO: {
            IDLOGIN: userId,
            ID_DISPOSITIVO: dispositivo.ID_DISPOSITIVO
          }
        },
        update: {}, // Si ya existe, no hacemos nada
        create: {
          IDLOGIN: userId,
          ID_DISPOSITIVO: dispositivo.ID_DISPOSITIVO
        }
      });

      return this.responseService.success('Dispositivo registrado.');

    } catch (error) {
      return this.responseService.error('Error al registrar token',HttpStatus.INTERNAL_SERVER_ERROR, error);
    }
  }
}