import { redirect } from 'next/navigation';
import { getCurrentAdminUser } from './server-auth';

export type RolAdmin = 'admin' | 'soporte' | 'bodega';

/**
 * Guardia de acceso por rol para páginas del admin. Se llama al principio
 * de cada page.tsx que deba restringirse — no basta con ocultar el link en
 * el sidebar, porque cualquiera puede escribir la URL directo. El proxy
 * (src/proxy.ts) a propósito solo verifica que haya sesión, no el rol
 * específico — dejan esa verificación para acá para no pegarle a
 * admin_roles en cada request del proxy (comentario de ellos mismos en
 * ese archivo).
 *
 * Si el rol no está permitido, redirige al dashboard en vez de mostrar un
 * error — es una redirección silenciosa, no hace falta explicarle al
 * usuario por qué no puede entrar a una sección que ni sabía que existía.
 */
export async function requireRole(rolesPermitidos: RolAdmin[]) {
  const admin = await getCurrentAdminUser();
  if (!admin) redirect('/admin/login');

  const rol = (admin.rol as RolAdmin) || 'admin';
  if (!rolesPermitidos.includes(rol)) {
    redirect('/admin');
  }

  return admin;
}
