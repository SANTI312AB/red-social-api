import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class CreateHotspotDto {
  @ApiProperty({
    description: 'Coordenada X del hotspot (valor flotante, ej. 0.5 para el centro).',
    example: 0.5,
  })
  @IsNumber()
  @IsNotEmpty()
  cordenada_x: number;

  @ApiProperty({
    description: 'Coordenada Y del hotspot (valor flotante, ej. 0.5 para el centro).',
    example: 0.5,
  })
  @IsNumber()
  @IsNotEmpty()
  cordenada_y: number;

  @ApiProperty({
    description: 'Texto descriptivo que aparece en el hotspot.',
    example: 'Ver producto',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  descripcion?: string;

  @ApiProperty({
    description: 'Nombre de usuario  que enlaza el hotspot.',
    example: 'almacen123',
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  username: string;
}