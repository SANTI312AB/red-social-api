import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface IsExistingEntityOptions {
  model: string;
  column: string;
}

@ValidatorConstraint({ name: 'isExistingEntity', async: true })
@Injectable()
export class IsExistingEntityConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prisma: PrismaService) {}

  async validate(value: any, args: ValidationArguments) {
    if (value === null || value === undefined) {
      return true;
    }

    const { model, column }: IsExistingEntityOptions = args.constraints[0];

    try {
      // Caso 1: El valor es un array (ej. [1, 5, 10])
      if (Array.isArray(value)) {
        // Si el array está vacío, pasa la validación (ArrayNotEmpty debe manejarlo si es requerido)
        if (value.length === 0) {
          return true;
        }
        
        // Contamos cuántos de los IDs proporcionados existen en la base de datos.
        const count = await this.prisma[model].count({
          where: { [column]: { in: value } },
        });

        // La validación es exitosa solo si el número de IDs encontrados es igual
        // al número de IDs que se enviaron.
        return count === value.length;
      }
      
      // Caso 2: El valor es único (lógica original)
      else {
        const count = await this.prisma[model].count({
          where: { [column]: value },
        });
        return count > 0;
      }
    } catch (e) {
      console.error(e); // Loguear el error para depuración
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    const { model } = args.constraints[0];
    const value = args.value;

    if (Array.isArray(value)) {
      return `Una o más de las opciones seleccionadas para ${model.replace(/_/g, ' ')} no son válidas o no existen.`;
    }
    return `La opción seleccionada para ${model.replace(/_/g, ' ')} no es válida o no existe.`;
  }
}

// La función decoradora que se usará en los DTOs.
export function IsExistingEntity(
  options: IsExistingEntityOptions,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: IsExistingEntityConstraint,
    });
  };
}