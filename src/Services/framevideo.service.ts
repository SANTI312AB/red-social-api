const ffmpeg = require('fluent-ffmpeg');
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';


@Injectable()
export class FrameVideoService {
  private readonly logger = new Logger(FrameVideoService.name);

   constructor() {
    // 1. Detectamos en qué sistema operativo estamos corriendo
    const isWindows = process.platform === 'win32';

    // 2. Forzamos la ruta exacta según el sistema, ignorando el .env para evitar conflictos
    const ffmpegExe = isWindows ? './frame_video/ffmpeg.exe' : './frame_video/ffmpeg';
    const ffprobeExe = isWindows ? './frame_video/ffprobe.exe' : './frame_video/ffprobe';

    const absoluteFfmpegPath = path.resolve(process.cwd(), ffmpegExe);
    const absoluteFfprobePath = path.resolve(process.cwd(), ffprobeExe);

    // 3. Asignamos las rutas a la librería
    ffmpeg.setFfmpegPath(absoluteFfmpegPath);
    ffmpeg.setFfprobePath(absoluteFfprobePath);
    
    this.logger.log(`FFmpeg configurado dinámicamente para SO: ${process.platform} en la ruta: ${absoluteFfmpegPath}`);
  }
  
  /**
   * Extrae un frame de un video y devuelve la ruta temporal de la imagen creada
   * @param timestamp Puede ser un segundo exacto ('00:00:02.000') o un porcentaje ('10%', '50%').
   */
  async extraerCaratula(
    videoPath: string, 
    outputFolder: string, 
    filename: string, 
    timestamp: string = '25%' // 👈 Valor por defecto dinámico (25% del video)
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(outputFolder, `${filename}.jpg`);

      ffmpeg(videoPath)
        .on('end', () => {
          resolve(outputPath);
        })
        .on('error', (err) => {
          this.logger.error(`Error al extraer el frame: ${err.message}`);
          reject(err);
        })
        .screenshots({
          timestamps: [timestamp], // 👈 Usamos el parámetro dinámico
          folder: outputFolder,
          filename: `${filename}.jpg`,
          size: '800x?', 
        });
    });
  }

  async validarVideo(filePath: string): Promise<boolean> {
    // 1. Guardia: Si es imagen, la aprobamos instantáneamente
    const extensionesImagen = /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i;
    
    if (extensionesImagen.test(filePath)) {
      this.logger.log(`✅ Archivo es una imagen, omitiendo ffprobe: ${path.basename(filePath)}`);
      return true; 
    }

    // 2. Si no es imagen, asumimos que es video o audio y ejecutamos ffprobe
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          this.logger.error(`❌ Error al leer metadata del archivo: ${err.message}`);
          reject(err);
        } else {
          // Extraemos la duración en segundos
          const duration = metadata.format?.duration;

          // Si es un archivo raro que pasó el guardia pero no tiene duración
          if (duration === undefined || duration === null) {
            this.logger.warn(`⚠️ No se pudo determinar la duración del archivo. Rechazando por seguridad.`);
            return resolve(false); 
          }

          const limiteSegundos = 600; // 10 minutos

          if (duration <= limiteSegundos) {
            this.logger.log(`✅ Video válido. Duración: ${Math.round(duration)}s`);
            resolve(true);
          } else {
            this.logger.warn(`🚫 Video rechazado. Excede los 10 minutos. Duración: ${Math.round(duration)}s`);
            resolve(false);
          }
        }
      });
    });
  }
}