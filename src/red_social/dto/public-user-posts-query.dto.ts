import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class PublicUserPostsQueryDto {
  @ApiPropertyOptional({
    description: 'Slug de una publicación específica para obtener sus detalles.',
    example: 'mi-primer-post',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Filtrar posts comentados por el usuario.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  mis_comentados?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar posts reaccionados por el usuario.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  mis_reaccionados?: boolean;


  @ApiPropertyOptional({
    description: 'Número de página actual. Empieza en 1.',
    example: 1,
    default: 1
  })
  @IsOptional()
  @IsInt({ message: 'La página debe ser un número entero.' })
  @Min(1, { message: 'La página mínima es 1.' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de posts por página. Default 20.',
    example: 20,
    default: 10
  })
  @IsOptional()
  @IsInt({ message: 'El límite debe ser un número entero.' })
  @Min(1, { message: 'El límite mínimo es 1.' })
  limit?: number = 20; // Renombrado de pageLimit a limit para coincidir con el servici
}