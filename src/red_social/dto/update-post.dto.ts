import { PartialType, ApiProperty, OmitType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { plainToInstance, Transform, Type } from 'class-transformer';
import { CreatePostDto } from './create-post.dto';
import { HashIdService } from 'src/utilis/hash-id.service';
import { BadRequestException } from '@nestjs/common';

class UpdatemultimediaPostItemDto {

  @ApiProperty({ description: 'ID hash del  elemento multimedia a modificar.', example: 'Aasddx',type:String })
  @Transform(({ value }) => {
      // 1. Si no viene valor, retornamos undefined
      if (!value) return undefined;
  
      // 2. Usamos el método estático para desencriptar
      const id = HashIdService.staticDecode(value);
  
      // 3. Si el hash no es válido, lanzamos error aquí mismo
      if (id === undefined) {
        throw new BadRequestException(`El ID multimedia '${value}' no es válido.`);
      }
  
      // 4. Retornamos el número para que los validadores (@IsInt, @IsExistingEntity) funcionen
      return id;
  })
  @IsInt()
  id: any;

  @ApiProperty({
    description: 'Nuevo número de orden para el elemento multimedia.',
    example: 1,
    required: false,
  })
  @IsInt()
  @IsOptional()
  orden?: number;
  
  @ApiProperty({
    description: 'Nueva descripción para el elemento multimedia.',
    example: 'Descripción actualizada',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300, {
    message: 'La descripción no puede tener más de 300 caracteres.',
  })
  descripcion?: string;
}

// Helper para transformar el string JSON en una instancia de clase
const toGalleryObject = (value: any): UpdatemultimediaPostItemDto | undefined => {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return plainToInstance(UpdatemultimediaPostItemDto, parsed);
  } catch (e) {
    return value;
  }
};


// Se utiliza OmitType para excluir 'imagenes' antes de aplicar PartialType
export class UpdatePostDto extends PartialType(
  OmitType(CreatePostDto, ['multimedia'] as const)
) {

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Nuevo archivo de multimedia para añadir o reemplazar.',
    required: false,
  })
  @IsOptional()
  multimedia?: any;

  @ApiProperty({
    type: 'string',
    description: "Objeto JSON con el ID de la imagen a modificar y/o su nuevo orden., si se envia id y orden sin archivo solo se actualiza el orden, si se envia solo id y no se envia archivo se elimina la imagen.",
    required: false,
    example: '{"id": "Aasxdf", "orden": 1, "descripcion": "Descripción actualizada"}',
  })
  @Transform(({ value }) => toGalleryObject(value))
  @ValidateNested()
  @Type(() => UpdatemultimediaPostItemDto)
  @IsOptional()
  multimedia_setting?: UpdatemultimediaPostItemDto;
}
