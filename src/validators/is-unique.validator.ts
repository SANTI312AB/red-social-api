import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

// Interfaz para los argumentos que recibirá nuestro decorador
export interface IsUniqueConstraintInput {
  table: string;
  column: string;
}

@ValidatorConstraint({ name: 'isUnique', async: true })
@Injectable()
export class IsUniqueConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prisma: PrismaService) {}

  async validate(value: any, args: ValidationArguments) {
    const { table, column } = args.constraints[0] as IsUniqueConstraintInput;

    const exists = await this.prisma[table].findFirst({
      where: {
        [column]: value,
      },
    });

    return !exists;
  }

  defaultMessage(args: ValidationArguments) {
    return `El campo ${args.property} con el valor '${args.value}' ya está registrado.`;
  }
}

// La función decoradora que usaremos en nuestros DTOs
export function IsUnique(
  options: IsUniqueConstraintInput,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isUnique',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: IsUniqueConstraint,
    });
  };
}