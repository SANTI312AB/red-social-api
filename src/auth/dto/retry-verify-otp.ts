import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty, IsString, Length } from 'class-validator';

export class RetryVerifyotp
{
@ApiProperty({
    description: 'Coloca email de usuario ya registrado para renviar nuevo otp.',
    example: 'maria@gmail.com',
})
@IsString()
@IsNotEmpty({ message: 'El corre no debe estar vacio.' })
@Length(4, 50, { message: 'El correo debe tener entre 4 y 50 caracteres.' })
  email: string;
}