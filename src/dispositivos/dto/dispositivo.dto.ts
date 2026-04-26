import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class DispositivoDto {
  @ApiProperty({description:'Añadir token del dispositivo.'})
  @IsString({ message: 'El token debe ser un texto válido.' })
  @IsNotEmpty({ message: 'El token del dispositivo es obligatorio.' })
  token: string;

  @ApiProperty({description:'Añadir ID del dispositivo.'})
  @IsString({ message: 'El ID del dispositivo debe ser un texto válido.' })
  @IsNotEmpty({ message: 'El ID del dispositivo es obligatorio.' })
  deviceId: string; // Aquí recibirás el deviceId generado por el cliente

  @ApiProperty({description:'Añadir plataforma del dispositivo.'})
  @IsString({ message: 'La plataforma del dispositivo debe ser un texto válido.' })
  @IsNotEmpty({ message: 'La plataforma del dispositivo es obligatoria.' })
  platform: string; // Aquí recibirás valores como 'android', 'ios' o 'web'
}