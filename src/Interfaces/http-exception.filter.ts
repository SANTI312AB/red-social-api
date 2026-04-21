import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ValidationError } from 'class-validator'; // Importar el tipo

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    let message = exception.message;
    let errorData: any = null;

    // Caso 1: Error de validación de DTO (class-validator)
    // Gracias al cambio en main.ts, exceptionResponse.message ahora es un array de ValidationError
    if (
      exception instanceof BadRequestException &&
      Array.isArray(exceptionResponse.message) &&
      exceptionResponse.message.length > 0 &&
      typeof exceptionResponse.message[0] === 'object' // Verificamos que sean objetos
    ) {
      message = 'Algunos campos no son válidos, por favor verifique los datos e intente nuevamente.';
      errorData = this.formatValidationErrors(exceptionResponse.message);
    }
    // Caso 2: Error donde NestJS devuelve strings (fallback por si acaso)
    else if (
        exception instanceof BadRequestException &&
        Array.isArray(exceptionResponse.message)
    ) {
        // Si llega aquí, son strings simples (ej: forbidNonWhitelisted)
        message = 'Error en los datos enviados.';
        errorData = { general: exceptionResponse.message };
    }
    // Caso 3: Errores personalizados o de lógica
    else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      message = exceptionResponse.message || message;
      errorData = exceptionResponse.data || exceptionResponse.errors || null;
    }
    // Caso 4: Strings simples
    else {
      message = exceptionResponse;
    }

    response.status(status).json({
      status: false,
      message,
      data: errorData,
    });
  }

  /**
   * Transforma el array de ValidationError a un objeto { campo: [errores] }
   * Soporta DTOs anidados recursivamente.
   */
  private formatValidationErrors(validationErrors: ValidationError[]): Record<string, string[]> {
    const formattedErrors: Record<string, string[]> = {};

    validationErrors.forEach((error) => {
      this.mapError(error, formattedErrors);
    });

    return formattedErrors;
  }

  // Función auxiliar recursiva para extraer errores
  private mapError(error: ValidationError, acc: Record<string, string[]>) {
    // 1. Si tiene constraints directos, los agregamos
    if (error.constraints) {
      acc[error.property] = Object.values(error.constraints);
    }

    // 2. Si tiene hijos (DTOs anidados), bajamos de nivel
    if (error.children && error.children.length > 0) {
      error.children.forEach((childError) => {
        this.mapError(childError, acc);
        // Nota: Si quisieras nombres como "usuario.direccion.calle", 
        // tendrías que pasar el prefijo en la recursión.
        // Por ahora, esto devuelve "calle": ["error"]
      });
    }
  }
}