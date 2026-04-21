import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { formatInTimeZone } from 'date-fns-tz';

const DEFAULT_TZ = 'America/Guayaquil';

@Injectable()
export class TimezoneInterceptor implements NestInterceptor {
 intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  return next.handle().pipe(map((data) => this.transformDatesRecursively(data)));
 }

 private transformDatesRecursively(data: any): any {
  if (data instanceof Date) {
      return this.formatSmartDate(data);
 } else if (Array.isArray(data)) {
    return data.map((item) => this.transformDatesRecursively(item));
  } else if (data && typeof data === 'object' && data !== null) {
    return Object.fromEntries(
     Object.entries(data).map(([k, v]) => [k, this.transformDatesRecursively(v)]),
  );
   }
   return data;
 }

 /**
   * Decide qué formato usar basándose en si la hora es medianoche UTC.
   */
 private formatSmartDate(date: Date): string {
 // Heurística: Si la hora es 00:00:00 UTC, asumimos que es un campo de solo fecha.
 if (
 date.getUTCHours() === 0 &&
 date.getUTCMinutes() === 0 &&
 date.getUTCSeconds() === 0 &&
 date.getUTCMilliseconds() === 0
 ) {
   return this.formatDateOnly(date);
 }
 // De lo contrario, es un campo de fecha y hora.
  return this.formatDateTime(date);
 }

/**
   * Formatea un objeto Date para mostrar solo la fecha en formato ISO (YYYY-MM-DD).
   */
 private formatDateOnly(date:Date): string {
    // .toISOString() devuelve 'YYYY-MM-DDTHH:mm:ss.sssZ'
    // Hacemos .split('T')[0] para obtener solo la parte de la fecha.
 return date.toISOString().split('T')[0];
 }

 /**
   * Formatea un objeto Date para mostrar fecha y hora en formato ISO
   * en la zona horaria de Ecuador (ej. ...-05:00).
   */
 private formatDateTime(date: Date): string {
    // 2. Usar formatInTimeZone
    // 'date' es el objeto Date (que está en UTC)
    // 'DEFAULT_TZ' es nuestra zona horaria ('America/Guayaquil')
    // "yyyy-MM-dd'T'HH:mm:ss.SSSXXX" es el formato ISO 8601 con el offset.
  return formatInTimeZone(date, DEFAULT_TZ, "yyyy-MM-dd'T'HH:mm"); }
}