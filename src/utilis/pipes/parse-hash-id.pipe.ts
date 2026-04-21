import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { HashIdService } from '../hash-id.service';

@Injectable()
export class ParseHashIdPipe implements PipeTransform<string | undefined, number | undefined> {
  constructor(private readonly hashIdService: HashIdService) {}

  transform(value: string | undefined, metadata: ArgumentMetadata): number | undefined {
    // 1. Si el valor no viene (es opcional en el Query), retornamos undefined y no hacemos nada.
    if (!value) {
      return undefined;
    }

    const id = this.hashIdService.decode(value);

    // 2. Si viene valor pero el hash es inválido, lanzamos error
    if (id === null) {
      throw new BadRequestException('El ID proporcionado no es válido.');
    }

    return id;
  }
}