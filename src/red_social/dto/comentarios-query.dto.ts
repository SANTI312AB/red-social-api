import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ComentariosQueryDto {
  @ApiPropertyOptional({
    description: 'Ordenar los comentarios por los más antiguos primero.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  mas_antiguos?: boolean;

  @ApiPropertyOptional({
    description: 'Ordenar los comentarios por los más "me gusta" primero.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  mas_gustados?: boolean;

  @ApiPropertyOptional({
    description: 'Número de página actual. Empieza en 1.',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt({ message: 'La página debe ser un número entero.' })
  @Min(1, { message: 'La página mínima es 1.' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de posts por página. Default 20.',
    example: 20,
    default: 10,
  })
  @IsOptional()
  @IsInt({ message: 'El límite debe ser un número entero.' })
  @Min(1, { message: 'El límite mínimo es 1.' })
  limit?: number = 20; // Renombrado de pageLimit a limit para coincidir con el servici
}
