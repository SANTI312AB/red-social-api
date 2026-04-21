import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, isBoolean, IsEmpty, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

const estado_permitidos = ['PENDING', 'ACCEPTED', 'REJECTED'];
export class EstadoSeguidorDto {
  @ApiPropertyOptional({
    description: 'Estado del seguidor',
    example: 'PENDING',
    enum: estado_permitidos,
  })
  @IsOptional()
  @IsString()
  @IsIn(estado_permitidos, {
    message: `El estado del seguidor debe ser uno de los siguientes: ${estado_permitidos.join(', ')}`,
  })
  estado: string;
 
  @ApiPropertyOptional({
    description: 'Indica si el seguidor está bloqueado',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  bloquear?: any;
}