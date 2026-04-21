import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { HashIdService } from '../hash-id.service';


@Injectable()
export class GlobalHashDecodePipe implements PipeTransform {
  constructor(private readonly hashIdService: HashIdService) {}

  transform(value: any, metadata: ArgumentMetadata) {
    // 1. Ignoramos todo lo que venga en el Body (JSON). Solo miramos la URL.
    if (metadata.type !== 'param' && metadata.type !== 'query') {
      return value;
    }

    // 2. Si no hay valor (es opcional), lo dejamos pasar
    if (!value) {
      return value;
    }

    // 3. LA MAGIA: ¿Tu controlador espera que esta variable sea un NÚMERO?
    // Si tu código dice: @Param('slug') slug: number <- Esto activará el pipe
    if (metadata.metatype === Number && typeof value === 'string') {

      // Verificamos si el valor YA ES un número normal (ej: ?page=2 o ?limit=20)
      // Si es un número normal, lo dejamos pasar intacto para no romper paginaciones
      if (!isNaN(Number(value))) {
        return value;
      }

      // Si no es un número normal, asumimos que es un Hash ("aB3x9") y lo desencriptamos
      const decodedId = this.hashIdService.decode(value);

      if (decodedId === null) {
        throw new BadRequestException(`El valor '${value}' para '${metadata.data}' no es válido o está corrupto.`);
      }

      // Retornamos el número limpio para que Prisma y NestJS sean felices
      return decodedId;
    }

    // Si tu controlador espera un String normal (ej: @Query('search') search: string)
    // El pipe lo ignora completamente para no corromper tus textos reales.
    return value;
  }
}