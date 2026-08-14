import Link from 'next/link';

export const metadata = {
  title: 'Eliminación de Datos | La Manito del Vegano',
  description: 'Información para solicitar la eliminación de datos personales.',
};

export default function EliminacionDatosPage() {
  return (
    <main className="min-h-screen bg-[#020705] text-[#f5f3e8]">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8 lg:py-24">
        <Link href="/" className="text-sm font-semibold text-[#00ffb3] hover:underline">← Volver a La Manito del Vegano</Link>
        <header className="mt-8 border-b border-white/10 pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#00ffb3]">Privacidad & datos</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Eliminación de datos</h1>
          <p className="mt-4 text-sm text-white/55">Última actualización: 13 de agosto de 2026</p>
        </header>

        <div className="mt-10 space-y-8 text-[15px] leading-7 text-white/75">
          <section><h2 className="text-xl font-bold text-white">Solicitudes de eliminación</h2><p className="mt-3">Puedes solicitar la eliminación o desvinculación de datos personales asociados a tus interacciones con La Manito del Vegano, incluidos datos provenientes de Instagram, Facebook, WhatsApp, formularios web o nuestro CRM.</p></section>
          <section><h2 className="text-xl font-bold text-white">Cómo contactarnos</h2><p className="mt-3">Envía tu solicitud por WhatsApp al +56 9 9081 6124 o mediante mensaje directo a nuestro Instagram oficial @lamanitodelvegano. Indica que se trata de una solicitud de privacidad y el canal desde el cual interactuaste con nosotros.</p></section>
          <section><h2 className="text-xl font-bold text-white">Verificación de identidad</h2><p className="mt-3">Para proteger la información podremos solicitar datos razonables que permitan confirmar que la solicitud corresponde al titular de la cuenta, teléfono o conversación. Nunca solicitaremos tu contraseña.</p></section>
          <section><h2 className="text-xl font-bold text-white">Registros que deban conservarse</h2><p className="mt-3">Ciertos antecedentes pueden conservarse cuando sean necesarios por obligaciones legales, contables, contractuales, de seguridad o prevención de fraude. En los demás casos procesaremos la solicitud dentro de un plazo razonable.</p></section>
          <section><h2 className="text-xl font-bold text-white">Más información</h2><p className="mt-3">Consulta nuestra <Link href="/privacidad" className="font-semibold text-[#00ffb3] hover:underline">Política de Privacidad</Link> para conocer cómo tratamos la información personal.</p></section>
        </div>
      </div>
    </main>
  );
}
