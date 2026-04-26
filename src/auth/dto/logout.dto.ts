import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class LogoutDto {

  @ApiPropertyOptional({
    description: 'El ID único del dispositivo móvil o navegador.',
    example: 'device-12345', required: false,
  })
  @IsOptional()
  @IsString({ message: 'El deviceId debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El deviceId no puede estar vacío si se proporciona.' })
  deviceId?: string;
}