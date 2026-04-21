import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { LoggingService } from './log.service';
import { Request, Response } from 'express';
import util from 'util';

function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch (_) {
    // util.inspect produce una representación segura si hay ciclos o propiedades no serializables
    return util.inspect(obj, { depth: null });
  }
}

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly loggingService: LoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const ip = (request.headers['x-forwarded-for'] as string) || request.ip || 'unknown';
    const { method } = request;
    const userId = (request.user as any)?.IDLOGIN;
    const routePath = request.path;
    const methodsToLog = ['POST', 'PATCH', 'PUT', 'DELETE'];

    const shouldLog = methodsToLog.includes(method);

    return next.handle().pipe(
      tap((data) => {
        if (!shouldLog) return;
        this.loggingService.createLog({
          status: response.statusCode,
          function: routePath,
          ip,
          userId,
          response: safeStringify(data),
          method,
        });
      }),
      catchError((err) => {
        // Normaliza info de error
        const status = err?.status || err?.statusCode || 500;
        const payload = {
          message: err?.message || (typeof err === 'string' ? err : 'Internal server error'),
          name: err?.name,
          // opcional: err.stack (evitar en prod si es sensible)
          stack: err?.stack,
        };

        if (shouldLog) {
          this.loggingService.createLog({
            status,
            function: routePath,
            ip,
            userId,
            response: safeStringify(payload),
            method,
          });
        }

        // volver a propagar el error para que Nest lo maneje
        return throwError(() => err);
      }),
      // finalize si quieres ejecutar algo al terminar (opcional)
      finalize(() => {
        // aquí puedes enviar métricas de tiempo, o similar
      }),
    );
  }
}
