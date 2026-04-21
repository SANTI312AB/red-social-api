import { Module } from '@nestjs/common';
import { CollectionEventService } from './collection-event.service';
import { CollectionEventController } from './collection-event.controller';
// Asumiendo que PrismaService y ResponseService son globales
// Si no lo son, impórtalos aquí.

@Module({
  controllers: [CollectionEventController],
  providers: [CollectionEventService],
})
export class CollectionEventModule {}
