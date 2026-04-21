import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);

  onModuleInit() {
    if (admin.apps.length === 0) {
      // Leemos la ruta desde el archivo .env
      const credentialsPath = process.env.FIREBASE_CREDENTIALS_PATH;

      if (!credentialsPath) {
        this.logger.error('❌ FATAL: Falta la variable FIREBASE_CREDENTIALS_PATH en el archivo .env');
        // Lanzamos el error para detener el arranque si falta esta pieza crítica
        throw new Error('No se pudo inicializar Firebase: Credenciales no encontradas.'); 
      }

      admin.initializeApp({
        // Firebase es lo suficientemente inteligente para ir a buscar el archivo por ti
        credential: admin.credential.cert(credentialsPath),
      });
      
      this.logger.log('🔥 Firebase Admin SDK inicializado correctamente desde .env');
    }
  }

  getMessaging(): admin.messaging.Messaging {
    return admin.messaging();
  }
}