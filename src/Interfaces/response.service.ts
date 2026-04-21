import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/**
 * Interface para una respuesta de API exitosa.
 */
export interface IApiResponse<T> {
  status: boolean;
  message: string;
  data?: T;
}

/**
 * Interface para una respuesta de API de error.
 */
export interface IApiErrorResponse {
  status: boolean;
  message: string;
  data?: any;
}

@Injectable()
export class ResponseService {
  /**
   * Emula a `succes_message`
   * Genera una respuesta exitosa estandarizada.
   * @param message - El mensaje de éxito.
   * @param data - Los datos a devolver.
   * @param objectKey - Si se proporciona, los datos se anidarán dentro de esta clave.
   */
  success<T>(message: string, data?: T, objectKey?: string): IApiResponse<T> {
    let responseData: any = data;

    if (objectKey && data !== undefined) {
      responseData = { [objectKey]: data };
    }

    return {
      status: true,
      message,
      data: responseData,
    };
  }

  /**
   * Emula a `error_message` y los errores de formulario.
   * Lanza una HttpException con un formato estandarizado.
   * NestJS capturará esta excepción y el HttpExceptionFilter la formateará.
   * @param message - El mensaje de error principal.
   * @param status - El código de estado HTTP.
   * @param data - Datos o detalles adicionales del error.
   */
  error(
    message: string,
    status: HttpStatus,
    data?: any,
  ): never {
    const errorResponse: IApiErrorResponse = {
      status: false,
      message,
      data: data || null,
    };
    throw new HttpException(errorResponse, status);
  }
} 