import { ApiPropertyOptional } from '@nestjs/swagger';
import {  IsIn, IsNotEmpty, isNotEmpty, IsString } from 'class-validator';

const estados = ['LEIDA','REMOVIDA'];
export class notificacionDto{

      @ApiPropertyOptional({
        description: 'Estado de la notificacion.',
        type: String,
        enum: estados
      })
      @IsNotEmpty()
      @IsIn(estados, {
          message: `Estos son los estados: ${estados.join(', ')}`,
      })
      @IsString()
      estado: string;
}