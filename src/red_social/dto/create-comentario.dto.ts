import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateComentarioDto {
  @ApiProperty({
    description: 'El contenido del comentario.',
    example: '¡Qué buena publicación!',
    maxLength: 500,
  })
  @IsString({ message: 'El comentario debe ser un texto.' })
  @IsNotEmpty({ message: 'El comentario no puede estar vacío.' })
  @MaxLength(500, {
    message: 'El comentario no puede tener más de 500 caracteres.',
  })
  comentario: string;
}
