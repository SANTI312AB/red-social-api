import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({
    description: 'El término de búsqueda para el nombre de usuario.',
    example: 'santi',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'El término de búsqueda no puede estar vacío.' })
  @MinLength(1)
  search: string;
}
