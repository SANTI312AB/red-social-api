import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsInt, 
  Min, 
  IsBoolean 
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class GlobalSearchQueryDto {

  @ApiProperty({description: 'Término de búsqueda para la búsqueda global.', required:true })
  @IsString()
  @IsNotEmpty({ message: 'El término de búsqueda (query) es obligatorio.' })
  query: string;

  @ApiProperty({ description: 'Número de página para la paginación.',  default: 1 , required: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: 'Límite de resultados para la paginación.', default: 10, required: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({ description: 'Buscar en posts.', type: Boolean, required: false })
  @IsOptional()
  @IsBoolean()
  searchPosts?: boolean;

  @ApiProperty({ description: 'Buscar en usuarios.', type: Boolean, required: false })
  @IsOptional()
  @IsBoolean()
  searchUsers?: boolean;
}