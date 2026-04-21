import { CronLogService } from './cron-log.service';

export function LogProceso(nombrePersonalizado?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const logService: CronLogService = (this as any).cronLogService;

      if (!logService) {
        // Fallback si no está inyectado
        return originalMethod.apply(this, args);
      }

      const nombreProceso = nombrePersonalizado || `${target.constructor.name}.${propertyKey}`;
      
      // 1. Inicio
      const logId = await logService.startLog(nombreProceso);

      try {
        // 2. Ejecutar método original y capturar el resultado
        const result = await originalMethod.apply(this, args);

        // 🟢 CAMBIO CLAVE:
        // Si la función retorna un string, lo usamos como mensaje en la BD.
        // Si retorna otra cosa o nada, usamos el mensaje por defecto.
        const mensajeFinal = typeof result === 'string' 
            ? result 
            : 'Ejecución finalizada correctamente';

        // 3. Fin (Éxito) con el mensaje dinámico
        await logService.endLog(logId, true, mensajeFinal);
        
        return result;

      } catch (error) {
        // 4. Fin (Error)
        const errorMsg = error instanceof Error ? error.stack || error.message : JSON.stringify(error);
        await logService.endLog(logId, false, errorMsg);
        throw error;
      }
    };

    return descriptor;
  };
}