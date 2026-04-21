import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'El código de 6 dígitos enviado al correo electrónico',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'El código OTP no puede estar vacío.' })
  @Length(6, 6, { message: 'El código OTP debe tener exactamente 6 dígitos.' })
  otp: string;
}
