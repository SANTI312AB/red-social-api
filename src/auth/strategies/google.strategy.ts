import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { GoogleConnectionConfig } from 'src/config-db/config-db.service';
import { GoogleAuthService, GoogleUserDto } from '../google.auth.service';
import { InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';

export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private readonly googleConfig: GoogleConnectionConfig,
    private readonly googleAuthService: GoogleAuthService,
  ) {
    super({
      clientID: googleConfig.client_id,
      clientSecret: googleConfig.client_secret,
      callbackURL: googleConfig.callback_url,
      scope: ['email', 'profile'],
    });
  }

  // <-- Firma CORRECTA: accessToken, refreshToken, profile, done
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    // Loguea el profile para ver exactamente qué trae Google (útil en dev)
    this.logger.debug(`Google profile: ${JSON.stringify(profile, null, 2)}`);

    // Extracciones defensivas con fallbacks
    const id = profile?.id ?? profile?._json?.sub ?? null;
    const firstName =
      profile?.name?.givenName ??
      profile?._json?.given_name ??
      (profile?.displayName ? profile.displayName.split(' ')[0] : null);
    const lastName =
      profile?.name?.familyName ??
      profile?._json?.family_name ??
      (profile?.displayName ? profile.displayName.split(' ').slice(1).join(' ') : null);
    const email = profile?.emails?.[0]?.value ?? profile?._json?.email ?? null;

    if (!email) {
      // Rechaza si no hay email — normalmente Google envía el email si pediste scope 'email'
      return done(new UnauthorizedException('Email no disponible en el perfil de Google'), false);
    }

    const googleUser: GoogleUserDto = {
      firstName,
      lastName,
      email,
      google_id: id,
    };

    try {
      const savedUser = await this.googleAuthService.save_google_user(googleUser);
      return done(null, savedUser);
    } catch (error) {
      this.logger.error(
        `Error en GoogleStrategy.validate al guardar usuario: ${error.message}`,
        error.stack,
      );
      return done(
        new InternalServerErrorException({
          status: false,
          message: 'Error al procesar el inicio de sesión con Google.',
          data: error.message,
        }),
        false,
      );
    }
  }
}
