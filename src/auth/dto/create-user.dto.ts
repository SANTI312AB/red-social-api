import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Length, Matches, Validate } from 'class-validator';
// 1. Importa el decorador desde su ubicación compartida
import { IsUnique } from 'src/validators/is-unique.validator';
import { ProfileValidator } from 'src/validators/profile.validator';

export class CreateUserDto {

  @ApiProperty({description:'Email usuario'})
  @IsEmail({}, { message: 'Agrega un correo' })
  @Length(4, 50, { message: 'El correo debe tener entre 4 y 50 caracteres' })
  @Validate(ProfileValidator)
  email: string;

  @ApiProperty({description:'Nik de usuario'})
  @IsNotEmpty({ message: 'Agrega un nombre de usuario.' })
  @Length(4, 50, { message: 'El nombre de usuario debe tener entre 4 y 50 caracteres' })
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'El nombre de usuario sólo debe tener letras y números.',
  })
  @Validate(ProfileValidator)
  username: string;

  @ApiProperty({description:'Nombre de usuario'})
  @IsNotEmpty({ message: 'Este campo debe tener datos' })
  @Length(1, 30, { message: 'El nombre debe tener entre 1 y 30 caracteres' })
  nombre: string;

  @ApiProperty({description:'Apellido usuario'})
  @IsNotEmpty({ message: 'Este campo debe tener datos' })
  @Length(1, 30, { message: 'El apellido debe tener entre 1 y 30 caracteres' })
  apellido: string;

  @ApiProperty({description:'Contraseña del usuario'})
  @IsNotEmpty({ message: 'Agrega una contraseña' })
  @Length(4, 60, { message: 'La contraseña debe tener entre 4 y 60 caracteres' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[\W_]).{6,}$/, {
    message: 'La contraseña debe tener caracteres especiales, números y letras',
  })
  password: string;
}