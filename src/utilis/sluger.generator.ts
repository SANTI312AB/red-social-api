import slugify from 'slugify';

/**
 * Genera un slug único para un string dado, limitado a 100 caracteres.
 * Si el slug base ya existe, le añade un sufijo numérico incremental (ej. 'mi-slug-2').
 * @param name El string base para generar el slug (ej. "Mi Tienda").
 * @param checkExistsFn Una función asíncrona que recibe un slug y devuelve `true` si existe, `false` si no.
 * @returns Una promesa que se resuelve con el slug único.
 */
export async function generateUniqueSlug(
  name: string,
  checkExistsFn: (slug: string) => Promise<boolean>,
): Promise<string> {
  const maxLength = 100;

  // --- CORRECCIÓN CLAVE AQUÍ ---
  // Se elimina 'strict: true', ya que elimina los espacios en lugar de reemplazarlos.
  // Se añade 'replacement: "-"' para asegurar que los espacios se conviertan en guiones.
  let baseSlug = slugify(name, {
    lower: true, // Convierte a minúsculas
    replacement: '-', // Reemplaza espacios con guiones
    trim: true, // Elimina espacios al inicio y al final
  });
  // -------------------------

  if (baseSlug.length > maxLength) {
    baseSlug = baseSlug.substring(0, maxLength);
  }

  // Elimina un posible guión al final que pueda quedar después de truncar.
  if (baseSlug.endsWith('-')) {
    baseSlug = baseSlug.slice(0, -1);
  }

  let finalSlug = baseSlug;
  let counter = 2;

  // 2. Bucle para verificar la unicidad.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await checkExistsFn(finalSlug);

    // Si no existe, hemos encontrado un slug único.
    if (!exists) {
      return finalSlug;
    }

    // 3. Si ya existe, crea un nuevo slug con sufijo, asegurándose de que el total
    //    no exceda los 100 caracteres.
    const suffix = `-${counter}`;
    const availableLength = maxLength - suffix.length;

    // Recorta el slug base para dejar espacio para el sufijo.
    const truncatedBaseSlug = baseSlug.substring(0, availableLength);

    finalSlug = `${truncatedBaseSlug}${suffix}`;
    counter++;
  }
}
