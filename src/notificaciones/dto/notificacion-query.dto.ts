import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { HashIdService } from 'src/utilis/hash-id.service';
import { Transform, Type } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

const estados = ['ENVIADA', 'LEIDA'];
const categorias = ['Reacciones', 'Comentarios', 'Venta', 'Compra', 'Delivery'];
export type Ordenamiento = 'asc' | 'desc';
export class notificacionQueryDto {
  @ApiPropertyOptional({
    description: ' Ordenar por fecha los productos.',
    enum: ['asc', 'desc'],
    type: String,
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'El orden debe ser asc o desc' })
  @Transform(({ value }) => value?.toLowerCase())
  orden?: Ordenamiento;

  @ApiPropertyOptional({
    description: 'Categorias de las notificaciones.',
    type: String,
    enum: categorias,
  })
  @IsIn(categorias, {
    message: `Estos son las categorias: ${categorias.join(', ')}`,
  })
  @IsOptional()
  categoria: string;

  @ApiPropertyOptional({
    description: 'Estado de la notificacion.',
    type: String,
    enum: estados,
  })
  @IsIn(estados, {
    message: `Estos son los estados: ${estados.join(', ')}`,
  })
  @IsOptional()
  estado: string;

  @ApiPropertyOptional({
    description: 'El ID encriptado de la notificacion específica.',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    const stringValue = String(value).trim();
    const id = HashIdService.staticDecode(stringValue);

    if (id === undefined || id === null || isNaN(id)) {
      throw new BadRequestException(
        `El ID de la notifcacion '${value}' no es válido.`,
      );
    }
    return id;
  })
  notificacionId?: any;

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
