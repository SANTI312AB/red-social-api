import { Injectable, OnModuleInit } from '@nestjs/common'; // 👈 1. Importar OnModuleInit
import Hashids from 'hashids';
import { ConfigDbService } from 'src/config-db/config-db.service';

@Injectable()
export class HashIdService implements OnModuleInit { // 👈 2. Implementar la interfaz
  private hashids: Hashids;
  private static instance: HashIdService;

  // El constructor debe quedar limpio, solo para inyección de dependencias
  constructor(private hash: ConfigDbService) {}

  /**
   * 3. Este método se ejecuta automáticamente cuando NestJS inicia el módulo.
   * Aquí SÍ podemos usar async/await.
   */
  async onModuleInit() {
    try {
      console.log('⏳ HashIdService: Cargando configuración desde BD...');
      
      const config = await this.hash.getHashConfig();

      if (!config || !config.secretKey) {
        throw new Error('FATAL: No se pudo obtener la secretKey de la base de datos.');
      }

      // Configuración de Hashids
      this.hashids = new Hashids(config.secretKey, 10);

      // Asignamos la instancia estática una vez que todo está listo
      HashIdService.instance = this;

      console.log('🚀 HashIdService: Instancia estática LISTA y cargada desde BD.');
      
    } catch (error) {
      console.error('❌ Error fatal iniciando HashIdService:', error);
      // Opcional: Si esto falla, podrías querer detener la app
      // process.exit(1); 
    }
  }

  // --- TUS FUNCIONES ANTERIORES ---

  encode(id: number): string {
    // Pequeña seguridad por si intentan usarlo antes de iniciar
    if (!this.hashids) {
        throw new Error('HashIdService no está listo. Hashids es undefined.');
    }
    return this.hashids.encode(id);
  }

  decode(hash: string): number | null {
    if (!this.hashids) return null;

    const decoded = this.hashids.decode(hash);
    
    if (!decoded || decoded.length === 0) {
      return null;
    }
    
    return decoded[0] as number;
  }

  // --- FUNCIÓN ESTÁTICA ---

  static staticDecode(hash: string): number | undefined {
    // Si el servicio no terminó de iniciar en onModuleInit, instance será undefined
    if (!HashIdService.instance) {
      console.error('❌ HashIdService.instance es undefined (Aún cargando o error de inicio).');
      return undefined;
    }

    const result = HashIdService.instance.decode(hash);

    if (result === null) {
        return undefined;
    }

    return result;
  }
}