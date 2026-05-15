import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { PrismaModule } from 'src/prisma/prisma.module';
import * as fs from 'fs';
import * as path from 'path';
import { JwtModule } from '@nestjs/jwt';

const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || 'keys/public.pem';
const publicKey = fs.readFileSync(path.join(process.cwd(), publicKeyPath), 'utf8');

@Module({
  imports: [PrismaModule,
   JwtModule.register({
      publicKey: publicKey,
      verifyOptions: {
        algorithms: ['RS256'], // 👈 Importante: Le decimos que use el algoritmo asimétrico
      },
    })
  ],
  providers: [ChatService, ChatGateway]
})
export class ChatModule {}
