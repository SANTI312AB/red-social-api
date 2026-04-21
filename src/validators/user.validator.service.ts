import { HttpStatus, Injectable } from "@nestjs/common";
import { ResponseService } from "src/Interfaces/response.service";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class UserValidatorService {
    constructor(
        private prisma: PrismaService,
        private responseService: ResponseService,
    ) { }

    async validar_usuario(userId: number) {
        // 1. Buscamos el usuario (LOGIN + PERFIL + TIENDA)
        const user = await this.prisma.login.findFirst({
            where: {
                IDLOGIN: userId,
                IDESTADO: 1,
                IDVERIFICACION: 7
            },
            include: {
                usuarios: true
            }
        });

        // 2. Validaciones de existencia básica
        if (!user) {
            return this.responseService.error(
                'Usuario no encontrado o no activo.',
                HttpStatus.NOT_FOUND
            );
        }

        if (!user.usuarios) {
            return this.responseService.error(
                'El usuario no tiene un perfil creado.',
                HttpStatus.BAD_REQUEST
            );
        }

        // Array para acumular errores de ambos (Usuario y Tienda)
        const camposFaltantes: string[] = [];

        // ---------------------------------------------------------
        // 3. VALIDACIÓN DE CAMPOS DEL USUARIO (Perfil)
        // ---------------------------------------------------------
        const camposUsuario = [
            { key: 'NOMBRE_USUARIO', label: 'nombre' },
            { key: 'APELLIDO_USUARIO', label: 'apellido' },
            { key: 'DNI_USUARIO', label: 'dni' },
            { key: 'TIPO_DOCUMENTO_USUARIO', label: 'tipo_documento' },
            { key: 'CELULAR_USUARIO', label: 'celular' }
        ];

        for (const campo of camposUsuario) {
            const valor = user.usuarios[campo.key];
            if (!valor || String(valor).trim() === '') {
                camposFaltantes.push(campo.label);
            }
        }

        // ---------------------------------------------------------
        // 4. VALIDACIÓN DE CAMPOS DE TIENDA (Solo si es Oficial ID 3)
        // ---------------------------------------------------------
        // Usamos ?. para evitar error si user.tiendas es null
    

        // 5. Retorno de resultados unificados
        if (camposFaltantes.length > 0) {
            
            // Creamos un mensaje dinámico dependiendo de qué falta
            const mensaje = 'Por favor complete los siguientes campos de tu perfil de usuario.';

            return this.responseService.error(
                mensaje,
                HttpStatus.BAD_REQUEST,
                camposFaltantes // Enviamos la lista combinada
            );
        }

        // Si todo está bien
        return true;
    }
}