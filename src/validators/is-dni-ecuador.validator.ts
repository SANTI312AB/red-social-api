import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
import { ValidacionCedulaRucService } from 'src/Services/ValidacionCedulaRucEcuadorService';

@ValidatorConstraint({ name: 'IsDniEcuador', async: true })
export class IsDniEcuadorConstraint implements ValidatorConstraintInterface {
    
    async validate(dni: string, args: ValidationArguments) {
        if (!dni) return true; // Dejamos que @IsNotEmpty haga su trabajo
        
        // Obtenemos el DTO completo para leer los demás campos
        const dto = args.object as any;
        const tipoDocumento = dto.tipo_documento;

        // Si el documento es Pasaporte (PPN), NO aplicamos la validación de Ecuador
        if (tipoDocumento === 'PPN') {
            return true;
        }

        // Si es 'CI', 'RUC' o cualquier otra cosa (por seguridad), aplicamos la validación matemática
        return await ValidacionCedulaRucService.esIdentificacionValida(dto.dni);
    }

    defaultMessage(args: ValidationArguments) {
        return `El número de identificación: '${args.value}' no es válido.`;
        
    }
}

// Generador del decorador
export function IsDniEcuador(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsDniEcuadorConstraint,
        });
    };
}