import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
export type Ordenamiento = 'asc' | 'desc';

export class UserProductsQueryDto {
     @ApiPropertyOptional({
       description: ' Orden de los productos.',
       enum: ['asc', 'desc'],
       type: String,
     })
     @IsOptional()
     @IsEnum(['asc', 'desc'], { message: 'El orden debe ser asc o desc' })
     @Transform(({ value }) => value?.toLowerCase())
     orderBy?: Ordenamiento;
   
     @ApiPropertyOptional({ enum: ['fecha', 'precio'], default: 'fecha' })
     @IsOptional()
     @IsString()
     sortBy?: 'fecha' | 'precio' = 'fecha';
   
     @ApiPropertyOptional({
       description:
         'Número de página actual (para Scroll Infinito). Empieza en 1.',
       example: 1,
       default: 1,
     })
     @IsOptional()
     @IsInt({ message: 'La página debe ser un número entero.' })
     @Min(1, { message: 'La página mínima es 1.' })
     page?: number = 1;
   
     @ApiPropertyOptional({
       description: 'Cantidad de productos a cargar por petición. Default 20.',
       example: 20,
       default: 20,
     })
     @IsOptional()
     @IsInt({ message: 'El límite debe ser un número entero.' })
     @Min(1, { message: 'El límite mínimo es 1.' })
     limit?: number = 20; // Antes pageLimit
   
}