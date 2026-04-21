import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRespuestaDto {
  @ApiProperty({
    description: 'El contenido de la respuesta al comentario.',
    example: '¡Gracias por tu comentario!',
    maxLength: 500,
  })
  @IsString({ message: 'La respuesta debe ser un texto.' })
  @IsNotEmpty({ message: 'La respuesta no puede estat vacia.' })
  @MaxLength(500, {
    message: 'La respuesta no puede tener más de 500 caracteres.',
  })
  respuesta: string;
}
