import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class DispositivoDto {
  @ApiProperty({description:'Añadir token del dispositivo.'})
  @IsString({ message: 'El token debe ser un texto válido.' })
  @IsNotEmpty({ message: 'El token del dispositivo es obligatorio.' })
  token: string;

  @ApiProperty({description:'Añadir codigo del dispositivo.'})
  @IsString({ message: 'El código del dispositivo debe ser un texto válido.' })
  @IsNotEmpty({ message: 'El código  es obligatorio.' })
  codigo: string; // Aquí recibirás valores como 'android', 'ios' o 'web'
}