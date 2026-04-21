import { Injectable } from "@nestjs/common";
import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";
import { PrismaService } from "src/prisma/prisma.service";

@ValidatorConstraint({ name: 'ProfileValidator', async: true }) // 👈 Faltaba este decorador
@Injectable()
export class ProfileValidator implements ValidatorConstraintInterface {
    
    constructor(
        private readonly prisma: PrismaService
    ){}

    async validate(value: any, args: ValidationArguments): Promise<boolean> {
        if (!value) return true;

        const property = args.property;
        const dto = args.object as any;
        
        // 1. Obtenemos el ID del perfil que se está editando.
        // Usamos dto.id (si viene de URL) o dto.usuario_id (si es el propio usuario logueado)
        const targetId = dto.id || dto.usuario_id; 
        
        try {
            let registroDuplicado: any = null;

            // 2. Condición mágica: Si tenemos un ID, le decimos a Prisma que ignore ese ID
            // Si targetId es undefined (ej. creando usuario nuevo), Prisma simplemente buscará en todos
            const excludeCondition = targetId ? { not: Number(targetId) } : undefined;

            switch (property) {
                case 'email':
                    registroDuplicado = await this.prisma.login.findFirst({
                        where: { 
                            EMAIL_LOGIN: value,
                            IDLOGIN: excludeCondition // Excluye al usuario actual
                        }
                    });
                    break;

                case 'username':
                    registroDuplicado = await this.prisma.login.findFirst({
                        where: { 
                            USUARIO_LOGIN: value,
                            IDLOGIN: excludeCondition
                        }
                    });
                    
                    break;

                case 'dni':
                    registroDuplicado = await this.prisma.usuarios.findFirst({
                        where: { 
                            DNI_USUARIO: value,
                            IDLOGIN: excludeCondition 
                        }
                    });
                    break;

                case 'celular':
                    registroDuplicado = await this.prisma.usuarios.findFirst({
                        where: { 
                            CELULAR_USUARIO: value,
                            IDLOGIN: excludeCondition 
                        }
                    });
                    break;

                default:
                    return false; // Si validan una propiedad no mapeada, fallamos por seguridad
            }
            
            // 3. Si encontró un duplicado (que NO es el usuario actual) -> false (Falla validación)
            // Si retornó null (no hay duplicados) -> true (Pasa validación)
            return !registroDuplicado;
            
        } catch (error) {
            console.error(`Error en ProfileValidator para ${property}:`, error);
            return false;
        }
    }

    // 👇 Mensajes personalizados dependiendo del campo que falló
    defaultMessage(args: ValidationArguments): string {
        const property = args.property;
        const value = args.value;

        switch (property) {
            case 'email':
                return `El correo electrónico '${value}' ya está registrado.`;
            case 'username':
                return `El nombre de usuario '${value}' ya está registrado .`;
            case 'dni':
                return `El DNI '${value}' ya se encuentra registrado.`;
            case 'celular':
                return `El número de celular '${value}' ya está registrado.`;
            default:
                return `El valor '${value}' ya está registrado.`;
        }
    }
}
