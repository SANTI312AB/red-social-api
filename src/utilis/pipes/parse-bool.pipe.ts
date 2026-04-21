import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class GlobalDataTransformPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // Es útil mantener este log para debuggear qué entra exactamente
    console.log(`[PIPE RAW IN (${metadata.type})]:`, value);
    
    // Aplicamos la lógica para la Query (URL) o el Body (JSON)
    if (metadata.type === 'query' || metadata.type === 'body') {
      return this.transformValue(value);
    }
    return value;
  }

  private transformValue(value: any): any {
    if (Array.isArray(value)) {
      return value.map((v) => this.transformValue(v));
    }

    if (value !== null && typeof value === 'object') {
      Object.keys(value).forEach((key) => {
        value[key] = this.transformValue(value[key]);
      });
      return value;
    }

    // Solo intentamos parsear si el valor llega como string (Query params siempre lo son)
    if (typeof value === 'string') {
      const trimmedValue = value.trim();

      // 1. Manejo de Flutter o nulos explícitos
      if (trimmedValue === '' || trimmedValue === 'null' || trimmedValue === 'undefined') {
        return undefined;
      }

      // 2. Lógica de booleanos
      const lowerCaseValue = trimmedValue.toLowerCase();
      if (lowerCaseValue === 'true') return true;
      if (lowerCaseValue === 'false') return false;

      // 3. Manejo de Números ⚡
      // Reemplazamos la expresión regular por Number() e isNaN().
      // Esto abarca: Enteros ('10'), Decimales ('10.5'), y números con signo ('+10' o '-10').
      // Como ya filtramos los strings vacíos y los booleanos arriba, Number() es 100% seguro aquí.
      const numericValue = Number(trimmedValue);
      if (!isNaN(numericValue)) {
        return numericValue;
      }
    }

    // 4. Retorno por defecto. 
    // Si era un string que no era número (ej. "hola"), retorna "hola".
    // Si YA ERA un número en el body (ej. 123), se saltó el bloque if de string y retorna 123.
    return value;
  }
}