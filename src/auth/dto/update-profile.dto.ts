import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  IsDateString,
  IsNumber,
  IsIn,
  IsBoolean,
  Validate,
} from 'class-validator';
import { IsDniEcuador } from 'src/validators/is-dni-ecuador.validator';
import { IsExistingEntity } from 'src/validators/is-existing.validator';
import { ProfileValidator } from 'src/validators/profile.validator';

// 1. Importar el decorador de unicidad (asegúrate de que la ruta sea correcta)

const tiposDeDocumentoPermitidos = ['CI', 'RUC','PPN'];
const generosPermitidos = ['MASCULINO', 'FEMENINO', 'NO_ESPECIFICADO'];
const toNumber = (value: any): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? value : num;
};


export class UpdateProfileDto {
  // --- Campos del modelo 'login' ---
  @IsOptional()
  id?: number;

  @IsOptional()
  usuario_id:number;

  @ApiPropertyOptional({
    description: 'El nuevo nombre de usuario (debe ser único)',
    example: 'nuevo_usuario_123',
  })
  @IsOptional()
  @IsString()
  @Length(4, 50, { message: 'El nombre de usuario debe tener entre 4 y 50 caracteres' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'El nombre de usuario sólo debe contener letras, números y guiones bajos.',
  })
  @Validate(ProfileValidator)
  username?: string;

  @ApiPropertyOptional({
    description: 'El nuevo correo electrónico (debe ser único y requerirá re-verificación)',
    example: 'nuevo@correo.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Por favor, proporciona un correo electrónico válido.(si se cambia el email se debe volver a verificar la cuenta por otp)' })
  @Validate(ProfileValidator)
  email?: string;

  // --- Campos del modelo 'usuarios' ---
  @ApiPropertyOptional({ description: 'Nombre del usuario', example: 'Juan' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  nombre?: string;

  @ApiPropertyOptional({ description: 'Apellido del usuario', example: 'Pérez' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  apellido?: string;

  @ApiPropertyOptional({
    description: 'Número de documento de identidad (DNI/Cédula)',
    example: '1712345678',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return value;
    const str = String(value).trim();
    
    // Si tiene 9 dígitos, era una cédula que perdió su 0
    // Si tiene 12 dígitos, era un RUC que perdió su 0
    if (str.length === 9 || str.length === 12) {
      return '0' + str;
    }
    
    return str; // Si tiene 10, 13 o cualquier otro tamaño, lo dejamos intacto
  })
  @IsString()
  @Length(5, 20, { message: 'El DNI debe tener entre 4 y 20 caracteres.' })
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'El DNI solo debe contener letras y números.',
  })
  @IsDniEcuador()
  @Validate(ProfileValidator)
  dni?: string;

  @ApiPropertyOptional({
    description: 'Tipo de documento de identidad',
    example: 'CI',
    enum: tiposDeDocumentoPermitidos,
  })
  @IsOptional()
  @IsString()
  @IsIn(tiposDeDocumentoPermitidos, {
    message: `El tipo de documento debe ser uno de los siguientes: ${tiposDeDocumentoPermitidos.join(', ')}`,
  })
  tipo_documento?: string;

  @ApiPropertyOptional({ description: 'Número de celular del usuario', example: '0991234567' })
  @IsOptional()
  @IsString()
  @Length(7, 20)
  @Matches(/^[0-9+ ]+$/, { 
    message: 'El celular solo debe contener números y el símbolo +' 
  })
  @Validate(ProfileValidator)
  celular?: string;


  @ApiPropertyOptional({
    description: 'Género del usuario',
    example: 'MASCULINO',
    enum: generosPermitidos,
  })
  @IsOptional()
  @IsString()
  @IsIn(generosPermitidos, {
    message: `El género debe ser uno de los siguientes: ${generosPermitidos.join(', ')}`,
  })
  genero?: string;
  
  @ApiPropertyOptional({
    description: 'Fecha de nacimiento del usuario en formato YYYY-MM-DD',
    example: '1990-05-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe tener el formato AAAA-MM-DD.' })
  fecha_nacimiento?: string;

 @ApiPropertyOptional({ description: 'ID del país del usuario', example: 1 })
 @Transform(({ value }) => toNumber(value))
 @IsOptional()
 @IsNumber()
 @IsExistingEntity({ model: 'pais', column: 'IDPAIS' })
 id_pais?: number;


 @ApiPropertyOptional({
     type: 'string',
     format: 'binary',
     description: 'El archivo de imagen para el avatar (formatos permitidos: .png, .jpeg, .jpg), si se envia estring vacio o null se elimina la imgagen',
   })
  @IsOptional()
  avatar: any; // El tipo real será Express.Multer.File, pero 'any' se usa aquí para el DTO.


  @ApiPropertyOptional({
    type: 'boolean',
    description: 'Indica si el perfil es público o privado',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  public_profile?: boolean;


  @ApiPropertyOptional({
    type: 'boolean',
    description: 'Indica si deseas recibir notificaciones push.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  notificaciones_push:boolean;


  @ApiPropertyOptional({
    type: 'boolean',
    description: 'Indica si deseas recibir notificaciones por email.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notificaciones_email:boolean;
}