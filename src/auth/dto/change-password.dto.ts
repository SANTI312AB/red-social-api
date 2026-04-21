import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Length, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'La contraseña actual del usuario.',
    example: 'MiContraseñaActual123!',
    minLength: 4,
    maxLength: 30,
  })
  @IsNotEmpty({ message: 'Por favor, introduce tu contraseña actual.' })
  @Length(4, 30, { message: 'La contraseña actual debe tener entre 4 y 30 caracteres.' })
  oldPassword: string;

  @ApiProperty({
    description: 'La nueva contraseña para el usuario. Debe contener al menos una letra, un número, un carácter especial y tener un mínimo de 6 caracteres.',
    example: 'NuevaClaveSegura$2025',
    minLength: 6,
    maxLength: 30,
  })
  @IsNotEmpty({ message: 'Por favor, introduce tu nueva contraseña.' })
  @Length(6, 30, { message: 'La nueva contraseña debe tener entre 6 y 30 caracteres.' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[\W_]).{6,}$/, {
    message: 'La nueva contraseña debe tener caracteres especiales, números y letras.',
  })
  newPassword: string;
}
