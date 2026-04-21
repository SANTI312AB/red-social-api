import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';

// Define los campos permitidos para la validación
const allowedFields = ['email', 'username', 'celular'];

export class ValidateFieldDto {
  @ApiProperty({
    description: 'El campo que se desea validar.',
    example: 'username',
    enum: allowedFields,
  })
  @IsIn(allowedFields, {
    message: `El campo a validar debe ser uno de: ${allowedFields.join(', ')}`,
  })
  @IsNotEmpty()
  field: 'email' | 'username' | 'celular';

  @ApiProperty({
    description: 'El valor que se desea comprobar.',
    example: 'santi123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  value: string;
}