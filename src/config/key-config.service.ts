import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class KeyConfigService {
  private readonly privateKey: Buffer;
  private readonly publicKey: Buffer;

  constructor() {
    // Leemos las rutas desde las variables de entorno
    const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH;
    const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH;

    if (!privateKeyPath || !publicKeyPath) {
      throw new Error('Las rutas de las claves JWT (privada y pública) no están definidas en el archivo .env');
    }

    // Leemos el contenido de los archivos de claves.
    // Usamos process.cwd() para obtener la ruta raíz del proyecto.
    this.privateKey = readFileSync(join(process.cwd(), privateKeyPath));
    this.publicKey = readFileSync(join(process.cwd(), publicKeyPath));
  }

  getPrivateKey(): Buffer {
    return this.privateKey;
  }

  getPublicKey(): Buffer {
    return this.publicKey;
  }
  
}