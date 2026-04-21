import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchTags {
  @ApiPropertyOptional({
    description: 'El término de búsqueda (ej. "#Musica", "#Anime"). Si se omite, se listarán los tags más usados por defecto.',
    example: '#Ecommerce',
    // Eliminamos el "required: true" porque choca con ApiPropertyOptional
  })
  @IsOptional() // 👈 Ahora es opcional para permitir que el frontend no envíe nada
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Fuerza a listar los tags más utilizados, ignorando la búsqueda.',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  top_tags?: boolean;
}