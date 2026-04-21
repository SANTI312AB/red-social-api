import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isTwoDecimalPlaces', async: false })
export class IsTwoDecimalPlacesConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    // La validación se aplica solo si el valor es un número.
    // El decorador @IsNumber debe usarse antes de este.
    if (typeof value !== 'number') {
      return true; // No es responsabilidad de este validador si no es un número.
    }

    // La lógica clave: multiplicamos por 100 y comprobamos si el resultado es un entero.
    // Esto es una forma segura de verificar que no hay más de dos decimales.
    return (value * 100) % 1 === 0;
  }

  defaultMessage(args: ValidationArguments) {
    return `El campo ${args.property} debe tener como máximo dos decimales.`;
  }
}

// La función decoradora que usaremos en nuestros DTOs.
export function IsTwoDecimalPlaces(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsTwoDecimalPlacesConstraint,
    });
  };
}