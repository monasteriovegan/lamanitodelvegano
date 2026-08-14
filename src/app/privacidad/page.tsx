import Link from 'next/link';

export const metadata = {
  title: 'Política de Privacidad | La Manito del Vegano',
  description: 'Política de privacidad y tratamiento de datos de La Manito del Vegano.',
};

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-[#020705] text-[#f5f3e8]">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8 lg:py-24">
        <Link href="/" className="text-sm font-semibold text-[#00ffb3] hover:underline">← Volver a La Manito del Vegano</Link>
        <header className="mt-8 border-b border-white/10 pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#00ffb3]">Privacidad & datos</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Política de Privacidad</h1>
          <p className="mt-4 text-sm text-white/55">Última actualización: 13 de agosto de 2026</p>
        </header>

        <div className="mt-10 space-y-10 text-[15px] leading-7 text-white/75">
          <section><h2 className="text-xl font-bold text-white">1. Quiénes somos</h2><p className="mt-3">La Manito del Vegano es un emprendimiento dedicado a la elaboración y comercialización de productos veganos. Esta política explica qué información podemos tratar cuando visitas nuestro sitio, realizas un pedido o te comunicas con nosotros mediante WhatsApp, Instagram, Facebook u otros canales digitales.</p></section>
          <section><h2 className="text-xl font-bold text-white">2. Información que podemos recopilar</h2><p className="mt-3">Podemos tratar información que nos entregas directamente, como nombre, teléfono, correo electrónico, dirección o comuna de entrega, datos asociados a pedidos, preferencias comunicadas voluntariamente, mensajes y consultas. También podemos recibir datos técnicos y de atribución, como identificadores de sesión, navegador, páginas visitadas, fuente de tráfico, parámetros UTM o identificadores publicitarios cuando corresponda.</p></section>
          <section><h2 className="text-xl font-bold text-white">3. Para qué usamos la información</h2><p className="mt-3">Utilizamos los datos para gestionar pedidos, pagos y entregas; responder consultas y mensajes; mantener el historial de atención y nuestro CRM; mejorar productos y experiencia del sitio; prevenir fraude o abuso; medir el rendimiento de campañas y, cuando corresponda, enviar comunicaciones comerciales de acuerdo con tus preferencias y las reglas aplicables del canal utilizado.</p></section>
          <section><h2 className="text-xl font-bold text-white">4. Mensajería y plataformas de Meta</h2><p className="mt-3">Si interactúas con La Manito del Vegano por Instagram, Facebook o WhatsApp, podemos recibir mediante herramientas oficiales de Meta información necesaria para gestionar la conversación, como identificadores de cuenta o conversación, nombre visible, contenido del mensaje, fecha, hora y estado de entrega. Esta información puede incorporarse a nuestro CRM para dar continuidad a la atención entre canales.</p></section>
          <section><h2 className="text-xl font-bold text-white">5. Proveedores tecnológicos</h2><p className="mt-3">Podemos utilizar proveedores de hosting, base de datos, pagos, correo transaccional, analítica y mensajería, entre ellos Vercel, Supabase, Meta y proveedores de pago habilitados en el sitio. Solo compartimos lo razonablemente necesario para operar el servicio o cumplir obligaciones aplicables.</p></section>
          <section><h2 className="text-xl font-bold text-white">6. Conservación y seguridad</h2><p className="mt-3">Conservamos la información durante el tiempo necesario para prestar el servicio, mantener registros de pedidos y atención, resolver disputas, prevenir fraude y cumplir obligaciones legales o comerciales. Aplicamos medidas técnicas y organizativas razonables para limitar accesos no autorizados.</p></section>
          <section><h2 className="text-xl font-bold text-white">7. Tus solicitudes de privacidad</h2><p className="mt-3">Puedes solicitar acceso, actualización, corrección o eliminación de información personal que mantengamos, sujeto a los registros que debamos conservar por razones legales, contables, contractuales o de seguridad. Para eliminación de datos consulta también <Link href="/eliminacion-de-datos" className="font-semibold text-[#00ffb3] hover:underline">Eliminación de datos</Link>.</p></section>
          <section><h2 className="text-xl font-bold text-white">8. Contacto</h2><p className="mt-3">Para consultas relacionadas con privacidad puedes escribirnos por WhatsApp al +56 9 9081 6124 o mediante nuestro Instagram oficial @lamanitodelvegano. Para proteger tus datos podremos solicitar información razonable para verificar que la solicitud corresponde al titular.</p></section>
          <section><h2 className="text-xl font-bold text-white">9. Cambios a esta política</h2><p className="mt-3">Podemos actualizar esta política para reflejar cambios en nuestros servicios, integraciones o requisitos aplicables. La versión vigente será la publicada en esta página e indicará su fecha de actualización.</p></section>
        </div>
      </div>
    </main>
  );
}
