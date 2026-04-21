import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'El código de 6 dígitos enviado al correo electrónico para el reseteo',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'El código OTP no puede estar vacío.' })
  @Length(6, 6, { message: 'El código OTP debe tener exactamente 6 dígitos.' })
  otp: string;

  @ApiProperty({
    description: 'La nueva contraseña para la cuenta',
    example: 'NuevaContraseñaSegura123!',
  })
  @IsNotEmpty({ message: 'La contraseña no puede estar vacía.' })
  @Length(8, 60, { message: 'La contraseña debe tener entre 8 y 60 caracteres.' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[\W_]).{6,}$/, {
    message: 'La contraseña debe tener al menos una letra, un número y un carácter especial.',
  })
  password: string;

  @ApiProperty({
    description: 'Confirmación de la nueva contraseña',
    example: 'NuevaContraseñaSegura123!',
  })
  @IsNotEmpty({ message: 'La confirmación de la contraseña no puede estar vacía.' })
  confirmPassword: string;
}
