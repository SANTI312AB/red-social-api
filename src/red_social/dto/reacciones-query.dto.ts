import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

// 1. Definimos un Enum para restringir los valores de ordenamiento
export enum OrderDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class ReaccionesQueryDto {
  
  @ApiPropertyOptional({ 
    description: 'Dirección del ordenamiento (asc o desc). Por defecto es desc.',
    enum: OrderDirection, 
    default: OrderDirection.DESC 
  })
  @IsOptional()
  @IsEnum(OrderDirection, { message: 'orderBy solo puede ser "asc" o "desc".' })
  orderBy?: 'asc' | 'desc' = 'desc';

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