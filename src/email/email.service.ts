import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigDbService } from 'src/config-db/config-db.service';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

@Injectable()
export class EmailService {
  constructor(private readonly configDbService: ConfigDbService) { }

  private async createClient() {
    const smtpConfig = await this.configDbService.getSmtpConfig();
    const { SMTPClient } = await import('emailjs');
    return new SMTPClient({
      user: smtpConfig.user,
      password: smtpConfig.pass,
      host: smtpConfig.host,
      ssl: true,
    });
  }

  async sendVerificationOtp(
    userEmail: string,
    otp: string,
    subject: string,
    message: string,
    user: string,
  ) {
    try {
      const smtpConfig = await this.configDbService.getSmtpConfig();
      const client = await this.createClient();

      const rootPath = process.cwd();

      // 1. Buscamos el template principal (verification.hbs)
      let templatePath = path.join(rootPath, 'dist', 'email', 'templates', 'verification.hbs');

      if (!fs.existsSync(templatePath)) {
        templatePath = path.join(rootPath, 'src', 'email', 'templates', 'verification.hbs');
      }

      if (!fs.existsSync(templatePath)) {
        templatePath = path.join(rootPath, 'dist', 'src', 'email', 'templates', 'verification.hbs');
      }

      console.log('🔍 Buscando template en:', templatePath);

      if (!fs.existsSync(templatePath)) {
        throw new Error(`CRÍTICO: No se encuentra el template ni en src ni en dist. Ruta buscada: ${templatePath}`);
      }

      // ==========================================
      // 🌟 REGISTRO DE PARCIALES (HEADER Y FOOTER)
      // ==========================================
      // Obtenemos la carpeta donde está el template para localizar /partials
      const templatesDir = path.dirname(templatePath);
      
      const headerPath = path.join(templatesDir, 'partials', 'header.hbs');
      const footerPath = path.join(templatesDir, 'partials', 'footer.hbs');

      if (fs.existsSync(headerPath)) {
        Handlebars.registerPartial('header', fs.readFileSync(headerPath, 'utf8'));
      } else {
        console.warn(`⚠️ No se encontró el partial header en: ${headerPath}`);
      }

      if (fs.existsSync(footerPath)) {
        Handlebars.registerPartial('footer', fs.readFileSync(footerPath, 'utf8'));
      } else {
        console.warn(`⚠️ No se encontró el partial footer en: ${footerPath}`);
      }
      // ==========================================

      // 2. Compilamos el HTML final
      const source = fs.readFileSync(templatePath, 'utf8');
      const html = Handlebars.compile(source)({ user, message, otp });

      const messageObj = {
        text: message,
        from: smtpConfig.from,
        to: userEmail,
        subject: subject,
        attachment: [
          { data: html, alternative: true }
        ]
      };

      // 3. Envío asíncrono envuelto en Promesa
      return await new Promise((resolve, reject) => {
        client.send(messageObj, (err: any, msg: any) => {
          if (err) {
            console.error('❌ Error SMTP:', err);
            reject(err);
          } else {
            console.log('✅ Correo de verificación enviado a:', userEmail);
            resolve(msg);
          }
        });
      });

    } catch (error) {
      console.error('❌ Fallo crítico al enviar correo de verificación:', error);
      // Opcional: lanzar el error para que el controlador lo maneje
      // throw error;
    }
  }

  

  // Asegúrate de tener Handlebars importado arriba en tu archivo
// import * as Handlebars from 'handlebars';

async sendPostNotification(userEmail: string, slug_post: string, message: string, detalle: string, user: string, subject: string) {

    try {
      const smtpConfig = await this.configDbService.getSmtpConfig();
      const client = await this.createClient();
      const rootPath = process.cwd();

      // 1. Buscamos el template principal
      let templatePath = path.join(rootPath, 'dist', 'email', 'templates', 'post.hbs');
      if (!fs.existsSync(templatePath)) {
        templatePath = path.join(rootPath, 'src', 'email', 'templates', 'post.hbs');
      }
      if (!fs.existsSync(templatePath)) {
        templatePath = path.join(rootPath, 'dist', 'src', 'email', 'templates', 'post.hbs');
      }
      
      console.log('🔍 Buscando template en:', templatePath);
      
      if (!fs.existsSync(templatePath)) {
        throw new Error(`CRÍTICO: No se encuentra el template ni en src ni en dist. Ruta buscada: ${templatePath}`);
      }

      // --- NUEVO: REGISTRO DE PARCIALES ---
      // 2. Extraemos el directorio donde sí encontró el template (ej. dist/email/templates)
      const templatesDir = path.dirname(templatePath);
      
      // Armamos las rutas de los parciales
      const headerPath = path.join(templatesDir, 'partials', 'header.hbs');
      const footerPath = path.join(templatesDir, 'partials', 'footer.hbs');

      // 3. Leemos y registramos los parciales en Handlebars
      if (fs.existsSync(headerPath)) {
        Handlebars.registerPartial('header', fs.readFileSync(headerPath, 'utf8'));
      } else {
        console.warn(`⚠️ No se encontró el partial header en: ${headerPath}`);
      }

      if (fs.existsSync(footerPath)) {
        Handlebars.registerPartial('footer', fs.readFileSync(footerPath, 'utf8'));
      } else {
        console.warn(`⚠️ No se encontró el partial footer en: ${footerPath}`);
      }
      // ------------------------------------

      // 4. Compilamos el HTML final (Ahora sí entenderá {{> header}} y {{> footer}})
      const source = fs.readFileSync(templatePath, 'utf8');
      const html = Handlebars.compile(source)({ user, message, slug_post, detalle });
      
      const messageObj = {
        text: message,
        from: smtpConfig.from,
        to: userEmail,
        subject: subject,
        attachment: [
          { data: html, alternative: true }
        ]
      };

      return await new Promise((resolve, reject) => {
        client.send(messageObj, (err: any, msg: any) => {
          if (err) {
            console.error('❌ Error SMTP:', err);
            reject(err); 
          } else {
            console.log('✅ Correo enviado a:', userEmail);
            resolve(msg); 
          }
        });
      });

    } catch (error) {
      console.error('❌ Fallo crítico al enviar correo:', error);
    }
}

  async enviarEmailSeguidor(userEmail: string, user: string, message: string, detalle: string, subject: string) {
    try {
      const smtpConfig = await this.configDbService.getSmtpConfig();
      const client = await this.createClient();
      const rootPath = process.cwd();
      let templatePath = path.join(rootPath, 'dist', 'email', 'templates', 'seguidor.hbs');
      
      if (!fs.existsSync(templatePath)) {
        templatePath = path.join(rootPath, 'src', 'email', 'templates', 'seguidor.hbs');
      }
      if (!fs.existsSync(templatePath)) {
        templatePath = path.join(rootPath, 'dist', 'src', 'email', 'templates', 'seguidor.hbs');
      }
      
      console.log('🔍 Buscando template en:', templatePath); // Log para depurar
      
      if (!fs.existsSync(templatePath)) {
        throw new Error(`CRÍTICO: No se encuentra el template ni en src ni en dist. Ruta buscada: ${templatePath}`);
      }

      // ==========================================
      // 🌟 REGISTRO DE PARCIALES (HEADER Y FOOTER)
      // ==========================================
      const templatesDir = path.dirname(templatePath);
      
      const headerPath = path.join(templatesDir, 'partials', 'header.hbs');
      const footerPath = path.join(templatesDir, 'partials', 'footer.hbs');

      if (fs.existsSync(headerPath)) {
        Handlebars.registerPartial('header', fs.readFileSync(headerPath, 'utf8'));
      } else {
        console.warn(`⚠️ No se encontró el partial header en: ${headerPath}`);
      }

      if (fs.existsSync(footerPath)) {
        Handlebars.registerPartial('footer', fs.readFileSync(footerPath, 'utf8'));
      } else {
        console.warn(`⚠️ No se encontró el partial footer en: ${footerPath}`);
      }
      // ==========================================

      const source = fs.readFileSync(templatePath, 'utf8');
      // Compilamos inyectando las variables que necesita el template
      const html = Handlebars.compile(source)({ user, message, detalle });
      
      const messageObj = {
        text: message,
        from: smtpConfig.from,
        to: userEmail,
        subject: subject,
        attachment: [
          { data: html, alternative: true }
        ]
      };

      return await new Promise((resolve, reject) => {
        client.send(messageObj, (err: any, msg: any) => {
          if (err) {
            console.error('❌ Error SMTP:', err);
            reject(err); // Esto permite que el catch de abajo capture el error
          }
          else {
            console.log('✅ Correo enviado a:', userEmail);
            resolve(msg); // Esto permite continuar el flujo
          }
        });
      });

    } catch (error) {
      console.error('❌ Fallo crítico al enviar correo:', error);
    }
  }

}