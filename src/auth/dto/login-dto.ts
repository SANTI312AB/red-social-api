import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'usuario@correo.com',
  })
  @IsEmail({}, { message: 'Por favor, proporciona un correo electrónico válido.' })
  @IsNotEmpty({ message: 'El correo electrónico no puede estar vacío.' })
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'ContraseñaSegura123!',
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña no puede estar vacía.' })
  password: string;
}