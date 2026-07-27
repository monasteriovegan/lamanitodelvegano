/**
 * Genera un slug de URL a partir de un texto (nombre de producto, etc.):
 * minúsculas, sin tildes, espacios y símbolos -> guiones.
 * Mismo criterio que usa la migración SQL de backfill, para que un
 * producto nuevo creado desde el admin y uno migrado desde la base
 * vieja generen el mismo tipo de slug.
 */
export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
