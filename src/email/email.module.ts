// src/email/email.module.ts
import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';
import { ConfigDbModule } from 'src/config-db/config-db.module';

@Global()
@Module({
  imports: [ConfigDbModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
