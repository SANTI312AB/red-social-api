import { Module } from '@nestjs/common';

import { PassportModule } from '@nestjs/passport';

// --- Configuración Clásica ---
import { KeyConfigService } from '../config/key-config.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { KeyConfigModule } from 'src/config/key--config.module';
import { UsuarioController } from './usuario.controller';
import { JwtStrategy } from './strategies/strategies';
import { UtilsModule } from 'src/utilis/utils.module';

// --- Dependencias para Google Strategy ---
import { GoogleStrategy } from './strategies/google.strategy';
import { ConfigDbModule } from 'src/config-db/config-db.module';
import { ConfigDbService } from 'src/config-db/config-db.service';
import { GoogleAuthService } from './google.auth.service';
import { GoogleAuthController } from './google.auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { AppleAuthService } from './apple.auth.service';
import { AppleAuthController } from './apple.auth.controller';

@Module({
  imports: [
    PrismaModule,
    KeyConfigModule,
    UtilsModule,
    ConfigDbModule,
    
    // Sigue siendo 'jwt' por defecto para no dañar el login clásico
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // Configuración asíncrona de JwtModule (SIN CAMBIOS)
    JwtModule.registerAsync({
      imports: [KeyConfigModule],
      useFactory: (keyConfigService: KeyConfigService) => ({
        privateKey: keyConfigService.getPrivateKey(),
        publicKey: keyConfigService.getPublicKey(),
        signOptions: {
          algorithm: 'RS256',
        },
      }),
      inject: [KeyConfigService],
    }),
  ],
  controllers: [AuthController, UsuarioController,GoogleAuthController,AppleAuthController],
  providers: [
    AuthService,
    JwtStrategy, // 👈 Tu estrategia clásica (se mantiene)

    // --------------------------------------------------
    // AÑADIDO: Servicio de Google
    // --------------------------------------------------
    // Añadimos GoogleAuthService como provider para que pueda ser inyectado.
    // Sus propias dependencias (PrismaService, HashPasswordService)
    // deben ser provistas por los módulos importados (PrismaModule, UtilsModule).
    GoogleAuthService,
    AppleAuthService,

    // --------------------------------------------------
    // FÁBRICA PARA GOOGLE STRATEGY (Actualizada)
    // --------------------------------------------------
    {
      provide: GoogleStrategy,
      useFactory: async (
        configService: ConfigDbService,
        googleAuthService: GoogleAuthService, // 👈 ACTUALIZADO: Inyectamos el servicio
      ) => {
        // 1. Obtenemos la config de forma asíncrona
        const googleConfig = await configService.getgoogle_config();

        // 2. Creamos la estrategia pasándole la config Y el servicio
        return new GoogleStrategy(googleConfig, googleAuthService); // 👈 ACTUALIZADO
      },
      // 3. Inyectamos las dependencias necesarias para la fábrica
      inject: [ConfigDbService, GoogleAuthService], // 👈 ACTUALIZADO
    },
    // --------------------------------------------------
  ],
})
export class AuthModule {}