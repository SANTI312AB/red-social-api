import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';
import { IsExistingEntity } from 'src/validators/is-existing.validator';

export class CreateReaccionDto {
  @ApiProperty({
    description: 'El ID del tipo de reacción que se está aplicando (ej. 1 para "Me gusta").',
    example: 1,
  })
  @IsInt({ message: 'El ID del tipo de reacción debe ser un número entero.' })
  @IsNotEmpty({ message: 'Debes proporcionar un tipo de reacción.' })
  @IsExistingEntity({ model: 'tipo_reaccion', column: 'IDTIPO_REACCION' })
  id_tipo_reaccion: number;
}
