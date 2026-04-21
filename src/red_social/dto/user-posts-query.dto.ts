import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { HashIdService } from 'src/utilis/hash-id.service';
import { BadRequestException } from '@nestjs/common';

export class UserPostsQueryDto {
  @ApiPropertyOptional({
    description: 'ID encriptado de una publicación específica. Si se omite, se listan todas.',
    type: String
  })
  @IsOptional()
  @Transform(({ value }) => {
      if (!value) return undefined;
  
      // Aseguramos que value sea string (por si acaso viene algo raro)
      const stringValue = String(value);
  
      const id = HashIdService.staticDecode(stringValue);
  
      if (id === undefined) {
        // Este mensaje saldrá si el hash está mal O si el servicio falló
        // Gracias a los logs del paso 2, sabrás cuál de los dos es.
        throw new BadRequestException(`El ID '${value}' no es válido.`);
      }
  
      return id;
    })
  postId?: any;

  @ApiPropertyOptional({
    description: 'Si es true, incluye solo las publicaciones que el usuario ha comentado.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  mis_comentados?: boolean;

  @ApiPropertyOptional({
    description: 'Si es true, incluye solo las publicaciones que el usuario ha reaccionado.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  mis_reaccionados?: boolean;

  @ApiPropertyOptional({
    description: 'Si es true, incluye solo las publicaciones que el usuario ha guardado.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  posts_guardados?: boolean;

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