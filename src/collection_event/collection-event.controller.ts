import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CollectionEventService } from './collection-event.service';
import { BatchCreateEventDto, CreateEventDto } from './dto/create-event.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('EventCollection') // Corresponde a tu tag de OpenAPI
@Controller('collect')
export class CollectionEventController {
  constructor(
    private readonly collectionEventService: CollectionEventService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK) // Por defecto un POST devuelve 201, pero tu API de Symfony devolvía 200.
  @ApiOperation({ summary: 'Recolecta un nuevo evento de telemetría.' })
  @ApiResponse({ status: 200, description: 'Evento guardado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Payload inválido o error de validación.' })
  async collect(@Body() dto: CreateEventDto) {
    return this.collectionEventService.saveCollectionEvent(dto);
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recolecta hasta 50 eventos de telemetría en lote.' })
  @ApiResponse({ status: 200, description: 'Lote procesado. Incluye resultados por evento.' })
  @ApiResponse({ status: 400, description: 'Payload inválido o error de validación.' })
  async collectBatch(@Body() dto: BatchCreateEventDto) {
    return this.collectionEventService.saveBatchCollectionEvents(dto.events);
  }
}
