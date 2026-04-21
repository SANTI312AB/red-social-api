import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class HashPasswordService {
   async comparePasswords(
    plainPassword: string,
    storedHash: string,
  ): Promise<boolean> {
    const cleanPassword = plainPassword.trim();
    const cleanHash = storedHash.trim();

    let finalHash = cleanHash;

    // 🛑 LÓGICA HÍBRIDA:
    // Solo si es un hash viejo de PHP ($2y), lo convertimos a $2a para que Node lo entienda.
    // Si ya es un hash nuevo de Node ($2b), ESTE IF SE IGNORA y pasa directo.
    

    const data= await bcrypt.compare(cleanPassword,cleanHash)

    console.log('Comparando:', { input: cleanPassword, hashUsado: finalHash });
    console.log('Result:', { result:data  });

    return data ;
  }

   /**
   * Hashea una contraseña asegurando integridad y formato estándar ($2b$).
   * Realiza validaciones de longitud post-hash para evitar corrupción de datos.
   */
  async hashPassword(plainPassword: string): Promise<string> {
    if (!plainPassword) {
        throw new Error('La contraseña no puede estar vacía.');
    }

    // 1. Limpieza: Elimina espacios accidentales al inicio/final
    const cleanPassword = plainPassword.trim();

    // 2. Configuración explícita: 10 rondas es el estándar de seguridad/rendimiento actual
    const saltRounds = 10; 
    const salt = await bcrypt.genSalt(saltRounds);
    
    // 3. Generación del Hash
    const hash = await bcrypt.hash(cleanPassword, salt);

    // 4. 🛑 VALIDACIÓN CRÍTICA DE LONGITUD
    // Un hash bcrypt válido SIEMPRE tiene 60 caracteres.
    // Si mide 59 o 61, algo anda mal en la librería o el entorno y NO debemos guardarlo.
    if (hash.length !== 60) {
        console.error(`ERROR CRÍTICO: bcrypt generó un hash de ${hash.length} caracteres: ${hash}`);
        throw new Error('Error interno de seguridad: Fallo en generación de hash.');
    }

    return hash;
  }
  
}