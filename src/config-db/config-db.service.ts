import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface SmtpConfig { host: string; user: string; pass: string; from: string; }
export interface S3ConnectionConfig { endpoint: string; accessKey: string; secretKey: string; region: string; }
export interface GoogleConnectionConfig { client_id: string; client_secret: string; callback_url: string; }
export interface HashConfig { secretKey: string; }
export interface AppleConnectionConfig { client_id: string; team_id: string; key_id: string; private_key: string; callback_url: string; }
export interface FrontUrlConfig { url: string; }

// Interfaz interna para manejar la caché con caducidad
interface CacheItem<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class ConfigDbService {
  private readonly logger = new Logger(ConfigDbService.name);

  // 👇 TIEMPO DE VIDA DE LA CACHÉ: 5 minutos en milisegundos (5 * 60 * 1000)
  private readonly CACHE_TTL = 300000; 

  // Variables de caché actualizadas para soportar expiración
  private smtpCache: CacheItem<SmtpConfig> | null = null;
  private s3Cache: CacheItem<S3ConnectionConfig> | null = null;
  private googleCache: CacheItem<GoogleConnectionConfig> | null = null;
  private hashCache: CacheItem<HashConfig> | null = null;
  private appleCache: CacheItem<AppleConnectionConfig> | null = null;
  private frontUrlCache: CacheItem<FrontUrlConfig> | null = null;


  constructor(private readonly prisma: PrismaService) {}

  clearCache() {
    this.smtpCache = null;
    this.s3Cache = null;
    this.googleCache = null;
    this.hashCache = null;
    this.appleCache = null;
    this.frontUrlCache = null;
    this.logger.log('🧹 Caché de configuraciones limpiada manualmente.');
  }

  // =======================================================================

  async getSmtpConfig(): Promise<SmtpConfig> {
    // 👇 Validación: ¿Existe la caché Y aún no ha caducado?
    if (this.smtpCache && this.smtpCache.expiresAt > Date.now()) {
      return this.smtpCache.data;
    }

    this.logger.log('Cargando configuración SMTP desde la base de datos (Caché vacía o expirada)...');
    const settings = await this.prisma.generales_app.findMany({
      where: { TIPO_SERVICIO: 'email', NOMBRE: 'gmail' },
    });

    const config = settings.reduce((acc, setting) => {
      if (setting.ATRIBUTO_GENERAL) acc[setting.ATRIBUTO_GENERAL] = setting.VALOR_GENERAL;
      return acc;
    }, {} as Record<string, string | null>);

    if (!config.Login || !config.SecretKey || !config.Username) {
      throw new Error('No se encontraron las credenciales SMTP en la base de datos.');
    }

    const smtpConfig: SmtpConfig = {
      host: 'smtp.gmail.com',
      user: config.Login,
      pass: config.SecretKey,
      from: `"${config.Username}" <${config.Login}>`,
    };

    // 👇 Guardamos los datos y la hora exacta en la que van a caducar
    this.smtpCache = {
      data: smtpConfig,
      expiresAt: Date.now() + this.CACHE_TTL,
    };

    return smtpConfig;
  }

  async getS3Config(): Promise<S3ConnectionConfig> {
    if (this.s3Cache && this.s3Cache.expiresAt > Date.now()) {
      return this.s3Cache.data;
    }

    this.logger.log('Cargando configuración S3 desde la base de datos...');
    const settings = await this.prisma.generales_app.findMany({
      where: { TIPO_SERVICIO: 'almacienamieto_archivos', NOMBRE: 'S3' },
    });

    const config = settings.reduce((acc, setting) => {
      if (setting.ATRIBUTO_GENERAL) acc[setting.ATRIBUTO_GENERAL] = setting.VALOR_GENERAL;
      return acc;
    }, {} as Record<string, string | null>);

    if (!config.baseUrl || !config.Username || !config.Password) {
      throw new Error('No se encontraron las credenciales S3 en la base de datos.');
    }

    const s3Config: S3ConnectionConfig = {
      endpoint: config.baseUrl,
      accessKey: config.Username,
      secretKey: config.Password,
      region: 'us-east-1',
    };

    this.s3Cache = { data: s3Config, expiresAt: Date.now() + this.CACHE_TTL };
    return s3Config;
  }

  async getgoogle_config(): Promise<GoogleConnectionConfig> {
    if (this.googleCache && this.googleCache.expiresAt > Date.now()) {
      return this.googleCache.data;
    }

    this.logger.log('Cargando configuración de Google desde la base de datos...');
    const settings = await this.prisma.generales_app.findMany({
      where: { TIPO_SERVICIO: 'login', NOMBRE: 'google' },
    });

    const config = settings.reduce((acc, setting) => {
      if (setting.ATRIBUTO_GENERAL) acc[setting.ATRIBUTO_GENERAL] = setting.VALOR_GENERAL;
      return acc;
    }, {} as Record<string, string | null>);

    if (!config.Login || !config.SecretKey || !config.Url) {
      throw new Error('No se encontraron las credenciales de Google en la base de datos.');
    }

    const googleConfig: GoogleConnectionConfig = {
      client_id: config.Login,
      client_secret: config.SecretKey,
      callback_url: config.Url
    };

    this.googleCache = { data: googleConfig, expiresAt: Date.now() + this.CACHE_TTL };
    return googleConfig;
  }



  async getHashConfig(): Promise<HashConfig> {
    if (this.hashCache && this.hashCache.expiresAt > Date.now()) {
      return this.hashCache.data;
    }

    this.logger.log('Cargando configuración del Hash desde la base de datos...');
    const settings = await this.prisma.generales_app.findMany({
      where: { TIPO_SERVICIO: 'hash', NOMBRE: 'hash' },
    });

    const config = settings.reduce((acc, setting) => {
      if (setting.ATRIBUTO_GENERAL) acc[setting.ATRIBUTO_GENERAL] = setting.VALOR_GENERAL;
      return acc;
    }, {} as Record<string, string | null>);

    if (!config.SecretKey) {
      throw new Error('No se encontraron las credenciales del Hash en la base de datos.');
    }

    const hashConfig: HashConfig = { secretKey: config.SecretKey };
    
    this.hashCache = { data: hashConfig, expiresAt: Date.now() + this.CACHE_TTL };
    return hashConfig;
  }

  

  async getAppleConfig(): Promise<AppleConnectionConfig> {
    if (this.appleCache && this.appleCache.expiresAt > Date.now()) {
      return this.appleCache.data;
    }

    this.logger.log('Cargando configuración de Apple desde la base de datos...');
    const settings = await this.prisma.generales_app.findMany({
      where: { TIPO_SERVICIO: 'login', NOMBRE: 'apple' },
    });

    const config = settings.reduce((acc, setting) => {
      if (setting.ATRIBUTO_GENERAL) acc[setting.ATRIBUTO_GENERAL] = setting.VALOR_GENERAL;
      return acc;
    }, {} as Record<string, string | null>);

    if (!config.Login || !config.Team  || !config.SecretKey || !config.Url) {
      throw new Error('No se encontraron las credenciales de Apple en la base de datos.');
    }

    const appleConfig: AppleConnectionConfig = {
      client_id: config.Login,
      team_id: config.Team,
      key_id: config.SecretKey,
      private_key: process.env.P8_FILE || '', // Se recomienda almacenar la clave privada en una variable de entorno por seguridad
      callback_url: config.Url
    };

    this.appleCache = { data: appleConfig, expiresAt: Date.now() + this.CACHE_TTL };
    return appleConfig;
  }


  async getFrontUrlConfig(): Promise<FrontUrlConfig> {
    if (this.frontUrlCache && this.frontUrlCache.expiresAt > Date.now()) {
      return this.frontUrlCache.data;
    }
    this.logger.log('Cargando configuración de Front URL desde la base de datos...');
    const settings = await this.prisma.generales_app.findMany({
      where: { TIPO_SERVICIO: 'redirect', NOMBRE: 'front' },
    });
  
    const config = settings.reduce((acc, setting) => {
      if (setting.ATRIBUTO_GENERAL) acc[setting.ATRIBUTO_GENERAL] = setting.VALOR_GENERAL;
      return acc;
    }, {} as Record<string, string | null>);
  
    if (!config.Url) {
      throw new Error('No se encontró la URL del Front en la base de datos.');
    }

    const frontUrlConfig: FrontUrlConfig = {
      url: config.Url,
    };

    this.frontUrlCache = { data: frontUrlConfig, expiresAt: Date.now() + this.CACHE_TTL };
    return frontUrlConfig;

  }
}