import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggingService } from './log.service';
import util from 'util';

function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch (_) {
    return util.inspect(obj, { depth: null });
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly loggingService: LoggingService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    // Detecta HttpException vs otros
    const isHttpEx = exception instanceof HttpException;
    const status = isHttpEx ? (exception as HttpException).getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const responseBody =
      isHttpEx ? (exception as HttpException).getResponse() : (exception as any)?.message || String(exception);

    // Si es SyntaxError por body parser, puede venir como un Error con status 400
    const isBodyParserSyntaxError =
      exception instanceof SyntaxError &&
      (exception as any).status === 400 &&
      typeof (exception as any).body === 'string';

    const logPayload = {
      path: req.path,
      method: req.method,
      ip: req.ip || req.headers['x-forwarded-for'],
      userId: (req.user as any)?.IDLOGIN,
      status,
      error: responseBody,
      isBodyParserSyntaxError,
    };

    this.loggingService.createLog({
      status,
      function: req.path,
      ip:  req.ips.join(', '),
      userId: (req.user as any)?.IDLOGIN,
      response: safeStringify(logPayload),
      method: req.method,
    });

    // Responder apropiadamente (puedes adaptar la forma de respuesta)
    const message = isBodyParserSyntaxError
      ? 'Malformed JSON in request body'
      : responseBody;

    res.status(status).json({
      status: false,
      message,
      data: null,
    });
  }
}
