import { Module, Global } from '@nestjs/common';
import { LoggingService } from './log.service';
import { HttpLoggingInterceptor } from './log.interceptor';
import { AllExceptionsFilter } from './all_exeption';
import { CronLogService } from './cron-log.service';

@Global() // Opcional: Hace que el servicio esté disponible globalmente si lo necesitas
@Module({
  providers: [LoggingService, HttpLoggingInterceptor,AllExceptionsFilter,CronLogService],
  exports: [LoggingService, HttpLoggingInterceptor,AllExceptionsFilter,CronLogService],
})
export class LoggingModule {}