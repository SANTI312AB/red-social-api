import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';


export class PublicPostsQueryDto {
  // --- 1. FILTROS BOOLEANOS ---
  @ApiPropertyOptional({ description: 'Filtrar por los más comentados.' })
  @IsOptional()
  @IsBoolean()
  mas_comentados?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar por los más reaccionados.' })
  @IsOptional()
  @IsBoolean()
  mas_reaccionados?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar por usuarios que sigo.' })
  @IsOptional()
  @IsBoolean()
  seguidos?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar por posts recomendados.' })
  @IsOptional()
  @IsBoolean()
  recomendados?: boolean;

  @ApiPropertyOptional({description:'Obtener posts por tag.'})
  @IsOptional()
  @IsString()
  tag?:string

  @ApiPropertyOptional({description:'Obtener posts por tipo de reacción.'})
  @IsOptional()
  @IsString()
  reaccion?:string

  // --- 2. PAGINACIÓN ESTÁNDAR (Scroll Infinito por páginas) ---
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
  limit?: number = 20; // Renombrado de pageLimit a limit para coincidir con el servicio
}