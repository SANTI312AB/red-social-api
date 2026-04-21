import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ConfigDbService, S3ConnectionConfig } from '../config-db/config-db.service';
import { extname } from 'path';
import slugify from 'slugify';

@Injectable()
export class S3Service implements OnModuleInit {
  private s3Client: S3Client;
  private s3Config: S3ConnectionConfig;

  // ESTE ES TU ÚNICO BUCKET REAL (LA RAÍZ /shopby-social)
  private readonly MASTER_BUCKET = 'shopby-social';

  constructor(private readonly configDbService: ConfigDbService) {}

  async onModuleInit() {
    this.s3Config = await this.configDbService.getS3Config();
    this.s3Client = new S3Client({
      endpoint: this.s3Config.endpoint,
      region: this.s3Config.region,
      credentials: {
        accessKeyId: this.s3Config.accessKey,
        secretAccessKey: this.s3Config.secretKey,
      },
      forcePathStyle: true, 
    });
  }

  /**
   * Ahora 'bucketName' actúa como el nombre de la SUB-CARPETA.
   * Estructura final: shopby-social / bucketName / filename
   */
  async uploadFile(file: Express.Multer.File, folderName: string, filename: string): Promise<string> {
    const fileExtension = extname(file.originalname);
    const slugifiedName = slugify(filename, { lower: true, strict: true });
    const uniqueSuffix = Date.now().toString(16);
    const finalFilename = `${slugifiedName}-${uniqueSuffix}${fileExtension}`;

    // AQUÍ SE CREA LA MAGIA DE LA ESTRUCTURA
    // AWS interpreta la barra "/" como una carpeta.
    const fullPathKey = `${folderName}/${finalFilename}`;

    const uploadCommand = new PutObjectCommand({
      Bucket: this.MASTER_BUCKET, // 1. Entra al bucket 'shopby-social'
      Key: fullPathKey,           // 2. Crea la carpeta y el archivo
      Body: file.buffer,
      ContentType: file.mimetype,
      //ACL: 'public-read',
    });

    try {
      await this.s3Client.send(uploadCommand);
      // Retornamos solo el nombre del archivo para no romper tu base de datos
      return finalFilename;
    } catch (error) {
      console.error(`Error subiendo a ${this.MASTER_BUCKET}/${folderName}:`, error);
      throw new InternalServerErrorException('Error al subir archivo S3');
    }
  }

  async deleteFile(folderName: string, filename: string): Promise<void> {
    // Reconstruimos la ruta: carpeta/archivo
    const fullPathKey = `${folderName}/${filename}`;

    const deleteCommand = new DeleteObjectCommand({
      Bucket: this.MASTER_BUCKET,
      Key: fullPathKey,
    });

    try {
      await this.s3Client.send(deleteCommand);
    } catch (error) {
      console.error(`Error borrando ${fullPathKey}:`, error);
    }
  }

   public getPublicUrl(folderName: string, filename: string): string {
    // Verificamos si la returnUrl ya incluye el nombre del bucket para no duplicarlo
    if (this.s3Config.endpoint.includes(this.MASTER_BUCKET)) {
       return `${this.s3Config.endpoint}/${folderName}/${filename}`;
    }

    // Si la URL es genérica (ej: localhost:9000), agregamos el bucket manualmente
    return `${this.s3Config.endpoint}/${this.MASTER_BUCKET}/${folderName}/${filename}`;
  }
}