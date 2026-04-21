import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsJSON,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventDto {
  @ApiProperty({ description: "Nombre del evento.", example: "page_view" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  eventName: string;

  @ApiProperty({ description: "Marca de tiempo del evento en formato ISO.", example: "2025-10-27T15:30:00Z" })
  @IsDateString()
  @IsNotEmpty()
  timestamp: string;

  @ApiProperty({ description: "Identificador del usuario.", example: "user-abc-123" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  user: string;

  @ApiProperty({ description: "Identificador de la sesión.", example: "session-xyz-789" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sessionId: string;

  @ApiProperty({ 
    description: "Datos JSON asociados con el evento.",
    example: { page_title: "Página de Inicio", duration_ms: "5000" }
  })
  @IsObject()
  @IsNotEmpty()
  eventData: Record<string, any>; // Se valida como objeto, el servicio hará la validación profunda

  @ApiPropertyOptional({ description: "Versión del SDK.", example: "1.0.0" })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  sdkVersion?: string;

  @ApiPropertyOptional({ description: "ID del cliente.", example: "client-app-v1" })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  clientId?: string;

  @ApiPropertyOptional({ description: "Versión del esquema de datos.", example: "1.2.0" })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  schemaVersion?: string;
}

export class BatchCreateEventDto {
  @ApiProperty({ type: [CreateEventDto], maxItems: 50, description: 'Array de eventos a guardar (máximo 50).' })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateEventDto)
  events: CreateEventDto[];
}
