import Link from 'next/link';

export const metadata = {
  title: 'Términos y Condiciones | La Manito del Vegano',
  description: 'Condiciones generales de uso, pedidos, pagos y entregas de La Manito del Vegano.',
};

export default function TerminosPage() {
  return (
    <main className="min-h-screen bg-[#020705] text-[#f5f3e8]">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8 lg:py-24">
        <Link href="/" className="text-sm font-semibold text-[#00ffb3] hover:underline">← Volver a La Manito del Vegano</Link>
        <header className="mt-8 border-b border-white/10 pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#00ffb3]">Condiciones del servicio</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Términos y Condiciones</h1>
          <p className="mt-4 text-sm text-white/55">Última actualización: 20 de agosto de 2026</p>
        </header>
        <div className="mt-10 space-y-10 text-[15px] leading-7 text-white/75">
          <section><h2 className="text-xl font-bold text-white">1. Alcance</h2><p className="mt-3">Estos términos regulan el uso del sitio y la solicitud de productos elaborados por La Manito del Vegano. La disponibilidad, precios, zonas y fechas de entrega vigentes se informan durante el proceso de pedido.</p></section>
          <section><h2 className="text-xl font-bold text-white">2. Pedidos</h2><p className="mt-3">Un pedido queda sujeto a disponibilidad de productos, confirmación de los datos entregados y aceptación del medio de pago seleccionado. Cuando un producto se elabora por encargo pueden aplicarse plazos mínimos informados en el sitio.</p></section>
          <section><h2 className="text-xl font-bold text-white">3. Precios y pagos</h2><p className="mt-3">Los precios se expresan en pesos chilenos. El total aplicable, incluidos despacho y descuentos válidos, se confirma de forma segura antes de procesar el pago. Los proveedores de pago pueden aplicar sus propias condiciones.</p></section>
          <section><h2 className="text-xl font-bold text-white">4. Entregas</h2><p className="mt-3">La cobertura, tarifa y fecha dependen de la zona seleccionada y de la capacidad disponible. El cliente debe proporcionar datos de contacto y dirección correctos para coordinar la entrega.</p></section>
          <section><h2 className="text-xl font-bold text-white">5. Cambios e incidencias</h2><p className="mt-3">Si existe un problema con un pedido, contáctanos oportunamente por nuestros canales oficiales. Revisaremos cada caso considerando el estado de elaboración, pago, entrega y la naturaleza perecible de los productos.</p></section>
          <section><h2 className="text-xl font-bold text-white">6. Uso del sitio</h2><p className="mt-3">No se permite intentar acceder sin autorización a áreas administrativas, interferir con el funcionamiento del servicio ni utilizar el sitio para actividades ilícitas o fraudulentas.</p></section>
          <section><h2 className="text-xl font-bold text-white">7. Privacidad</h2><p className="mt-3">El tratamiento de información personal se describe en nuestra <Link href="/privacidad" className="font-semibold text-[#00ffb3] hover:underline">Política de Privacidad</Link>. Las instrucciones para solicitudes de eliminación están disponibles en <Link href="/eliminacion-de-datos" className="font-semibold text-[#00ffb3] hover:underline">Eliminación de datos</Link>.</p></section>
          <section><h2 className="text-xl font-bold text-white">8. Contacto</h2><p className="mt-3">Para consultas sobre pedidos o estos términos puedes comunicarte mediante el WhatsApp o Instagram oficial de La Manito del Vegano.</p></section>
        </div>
      </div>
    </main>
  );
}
