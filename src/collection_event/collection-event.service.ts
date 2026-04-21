import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { ResponseService } from 'src/Interfaces/response.service';

@Injectable()
export class CollectionEventService {
  constructor(
    private prisma: PrismaService,
    private responseService: ResponseService,
  ) {}

  /**
   * Valida y guarda un nuevo evento de telemetría.
   * @param dto Los datos del evento validados.
   * @returns Una respuesta de éxito o error.
   */
  async saveCollectionEvent(dto: CreateEventDto) {
    
    // TODO: Replicar la lógica de 'FuncionesEspecialesRepository'
    // Aquí deberías cargar tu configuración dinámicamente desde la base de datos.
    const eventConfigRows = await this.prisma.funciones_especiales.findMany({
      where: {
        IDFUNCION: { in: [6, 7, 8] }
      },
      select: {
        // Asumo que tienes campos como 'NOMBRE_FUNCION' y 'VALOR_FUNCION'
        NOMBRE_FUNCION: true,
        DESCRIPCION: true
      }
    });

    // 2. Transforma el array de resultados en un objeto de configuración (ej. { maxkeys_events: "10" })
    const configRaw = eventConfigRows.reduce((acc, row) => {
      if (row.NOMBRE_FUNCION) {
        acc[row.NOMBRE_FUNCION] = row.DESCRIPCION;
      }
      return acc;
    }, {});

    // 3. Ahora sí puedes construir tu objeto 'config' con valores por defecto
    const config = {
      // Usamos parseInt y parseFloat para convertir los valores de string a número
      maxKeys: parseInt(configRaw['maxkeys_events'], 10) || 10,
      maxDepth: parseInt(configRaw['maxdepth_events'], 10) || 3,
      // Comparamos explícitamente con 'true'
      onlyStrings: (configRaw['only_strings_events'] === 'true') || false,
    };
    const eventData = dto.eventData;

    // 1) Validar número de keys
    if (Object.keys(eventData).length > config.maxKeys) {
      return this.responseService.error(
        `Too many keys in eventData (max = ${config.maxKeys})`,
        HttpStatus.BAD_REQUEST,
        { eventData },
      );
    }

    // 2) Validar profundidad del JSON
    const depth = this.arrayDepth(eventData);
    if (depth > config.maxDepth) {
      return this.responseService.error(
        `eventData too deep (max depth = ${config.maxDepth}), found depth ${depth}`,
        HttpStatus.BAD_REQUEST,
        { eventData },
      );
    }

    // 3) Validar que los valores sean strings y no contengan caracteres no válidos
    if (config.onlyStrings) {
      for (const key in eventData) {
        const value = eventData[key];
        if (typeof value !== 'string') {
          return this.responseService.error(
            `Value for '${key}' must be string`,
            HttpStatus.BAD_REQUEST,
            { key, value },
          );
        }
        // Validar caracteres no permitidos
        if (/[{}()]/.test(value)) {
           return this.responseService.error(
            `Invalid characters in value for '${key}'`,
            HttpStatus.BAD_REQUEST,
            { key, value },
          );
        }
      }
    }

    // --- Guardar evento ---
    try {
      await this.prisma.event.create({
        data: {
          EVENTNAME: dto.eventName,
          TIMESTAP: new Date(dto.timestamp), // Convertir string ISO a objeto Date
          USER: dto.user,
          SESSION_ID: dto.sessionId,
          EVENTDATA: eventData, // Prisma maneja la serialización a JSON
          SDK_VERSION: dto.sdkVersion,
          CLIENT_ID: dto.clientId,
          SCHEMA_VERSION: dto.schemaVersion,
        },
      });

      return this.responseService.success('Event saved successfully');

    } catch (error) {
      console.error("Error al guardar el evento:", error);
      return this.responseService.error(
        'No se pudo guardar el evento en la base de datos.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Procesa un lote de hasta 50 eventos. Valida cada uno individualmente
   * (usando la config cargada una sola vez) y hace createMany con los válidos.
   */
  async saveBatchCollectionEvents(events: CreateEventDto[]) {
    // Cargar config una sola vez para todo el lote
    const eventConfigRows = await this.prisma.funciones_especiales.findMany({
      where: { IDFUNCION: { in: [6, 7, 8] } },
      select: { NOMBRE_FUNCION: true, DESCRIPCION: true },
    });

    const configRaw = eventConfigRows.reduce((acc, row) => {
      if (row.NOMBRE_FUNCION) acc[row.NOMBRE_FUNCION] = row.DESCRIPCION ?? '';
      return acc;
    }, {} as Record<string, string>);

    const config = {
      maxKeys: parseInt(configRaw['maxkeys_events'], 10) || 10,
      maxDepth: parseInt(configRaw['maxdepth_events'], 10) || 3,
      onlyStrings: (configRaw['only_strings_events'] === 'true') || false,
    };

    const results: { index: number; status: 'ok' | 'error'; reason?: string }[] = [];
    const toInsert: { index: number; dto: CreateEventDto }[] = [];

    for (let i = 0; i < events.length; i++) {
      const dto = events[i];
      const error = this.validateEventDataConfig(dto.eventData, config);
      if (error) {
        results.push({ index: i, status: 'error', reason: error });
      } else {
        results.push({ index: i, status: 'ok' });
        toInsert.push({ index: i, dto });
      }
    }

    if (toInsert.length > 0) {
      try {
        await this.prisma.event.createMany({
          data: toInsert.map(({ dto }) => ({
            EVENTNAME: dto.eventName,
            TIMESTAP: new Date(dto.timestamp),
            USER: dto.user,
            SESSION_ID: dto.sessionId,
            EVENTDATA: dto.eventData,
            SDK_VERSION: dto.sdkVersion,
            CLIENT_ID: dto.clientId,
            SCHEMA_VERSION: dto.schemaVersion,
          })),
        });
      } catch (error) {
        console.error('Error al guardar el lote de eventos:', error);
        // Marcar los que iban a insertarse como fallidos
        for (const { index } of toInsert) {
          results[index] = { index, status: 'error', reason: 'DB error' };
        }
        const failed = results.filter(r => r.status === 'error').length;
        return this.responseService.success('Batch procesado con errores de DB', {
          total: events.length,
          saved: 0,
          failed,
          results,
        });
      }
    }

    const saved = results.filter(r => r.status === 'ok').length;
    const failed = results.filter(r => r.status === 'error').length;

    return this.responseService.success('Batch procesado', {
      total: events.length,
      saved,
      failed,
      results,
    });
  }

  /** Valida eventData contra la config. Retorna string de error o null si es válido. */
  private validateEventDataConfig(
    eventData: Record<string, any>,
    config: { maxKeys: number; maxDepth: number; onlyStrings: boolean },
  ): string | null {
    if (Object.keys(eventData).length > config.maxKeys) {
      return `Too many keys in eventData (max = ${config.maxKeys})`;
    }
    if (this.arrayDepth(eventData) > config.maxDepth) {
      return `eventData too deep (max depth = ${config.maxDepth})`;
    }
    if (config.onlyStrings) {
      for (const key in eventData) {
        const value = eventData[key];
        if (typeof value !== 'string') return `Value for '${key}' must be string`;
        if (/[{}()]/.test(value)) return `Invalid characters in value for '${key}'`;
      }
    }
    return null;
  }

  /**
   * Calcula la profundidad máxima de un objeto JSON.
   * (Función portada desde tu controlador de Symfony)
   * @param data El objeto a analizar.
   * @returns La profundidad máxima.
   */
  private arrayDepth(data: any): number {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        // Consideramos que los no-objetos o arrays tienen profundidad 0 o 1
        // dependiendo de cómo quieras contarlo. Para replicar tu lógica de PHP:
        return 1;
    }
    
    let maxDepth = 1;
    for (const key in data) {
        if (typeof data[key] === 'object' && data[key] !== null) {
            const depth = this.arrayDepth(data[key]) + 1;
            if (depth > maxDepth) {
                maxDepth = depth;
            }
        }
    }
    return maxDepth;
  }
}
