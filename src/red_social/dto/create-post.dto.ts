import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  Length,
  Matches,
} from 'class-validator';

const transformTags = (value: any): string[] => {
  if (Array.isArray(value)) {
    // Si ya es un array, solo normaliza cada string
    return value
      .map(tag => String(tag).toLowerCase().trim())
      .filter(tag => tag.length > 0);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    // Si es un string (ej. "Tag1, Tag2, Tag3"), lo divide
    return value
      .split(',')
      .map(tag => tag.toLowerCase().trim())
      .filter(tag => tag.length > 0);
  }
  return []; // Devuelve un array vacío si no hay tags
};

export class CreatePostDto {
  @ApiProperty({
    description: 'El contenido de texto de la publicación.',
    example: 'Miren mis nuevas zapatillas!',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: 'La descripción no puede estar vacía.' })
  @MaxLength(500, {
    message: 'La descripción no puede tener más de 500 caracteres.',
  })
  descripcion: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description:
      'Archivos multimedia para el post (imágenes o videos). Opcional.',
    required: false,
  })
  @IsOptional()
  multimedia?: any[];

  // --- CAMPO DE ETIQUETAS ACTUALIZADO ---
  @ApiProperty({
    type: [String], // 4. Ahora es un array de strings
    description: 'Array de nombres de etiquetas (ej. "#Life" o "#Ecommerce","#Music").',
    example: ["#Cooking", "#FollowMe", "#Inspiration"],
    required: false,
  })
  @Transform(({ value }) => transformTags(value)) // 5. Usar el nuevo transformador
  @IsArray()
  @IsNotEmpty({message: 'Agregue una etiqueta al post.'})
  @ArrayMaxSize(5, { message: 'Puedes añadir un máximo de 5 etiquetas.' })
  @IsString({ each: true })
  @Length(2, 20, { each: true, message: 'Cada etiqueta debe tener entre 2 a 20 caracteres.'})
  // --- CAMBIO CLAVE AQUÍ ---
  // 6. Validación más estricta para los nombres de las etiquetas
  @Matches(/^#[a-zA-Z0-9+-.]+$/, { 
    each: true,
    message: 'Cada etiqueta debe empezar con # y solo puede contener letras, números y los caracteres +-.',
  })
  etiquetas?: string[];
}
