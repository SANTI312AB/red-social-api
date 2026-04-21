import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

// Tipos para los Enums (opcional, pero buena práctica)
export type EstadoSeguidor = 'PENDING' | 'ACCEPTED' | 'REJECTED';
export type Ordenamiento = 'asc' | 'desc';

export class SeguidoresQueryDto {
  @ApiPropertyOptional({
    description: 'Mostrar la lista de seguidores del usuario.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  seguidores?: boolean;

  @ApiPropertyOptional({
    description: 'Mostrar la lista de usuarios que el usuario sigue.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  seguidos?: boolean = true;

  @ApiPropertyOptional({
    description: 'Filtrar por estado (PENDING, ACCEPTED, REJECTED).',
    enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
  })
  @IsOptional()
  @IsEnum(['PENDING', 'ACCEPTED', 'REJECTED'], {
    message: 'El estado debe ser PENDING, ACCEPTED o REJECTED',
  })
  estado?: EstadoSeguidor;

  @ApiPropertyOptional({
    description: "Ordenar por fecha (asc/desc). Por defecto 'desc'.",
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'El orden debe ser asc o desc' })
  // 🔥 Transformación automática: Si envían 'DESC' o 'Desc', lo convierte a 'desc'
  @Transform(({ value }) => value?.toLowerCase())
  orden?: Ordenamiento;

  @ApiPropertyOptional({
    description: 'Filtrar la lista por nombre de usuario (búsqueda).',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description: 'Número de página para la paginación. Por defecto es 1.',
    default: 1,
    minimum: 1
  })
  @IsOptional()
  @IsInt({ message: 'La página debe ser un número entero.' })
  @Min(1, { message: 'La página mínima es 1.' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de items por página. Por defecto es 20.',
    default: 20,
    minimum: 1
  })
  @IsOptional()
  @IsInt({ message: 'El límite debe ser un número entero.' })
  @Min(1, { message: 'El límite mínimo es 1.' })
  limit?: number = 20;
}