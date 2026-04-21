import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'El refresh token que se obtuvo durante el inicio de sesión.',
    example: 'a1b2c3d4e5...',
  })
  @IsString({ message: 'El refresh token debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El refresh token no puede estar vacío.' })
  refreshToken: string;
}

