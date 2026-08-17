import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { toggleDestacado } from '../productos/actions';
import { PageHeader, SectionCard, EmptyState } from '../_ui/AdminUI';
import type { Producto } from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function AdminDestacadosPage() {
  await requireRole(['admin']);
  const supabase = createSupabaseServiceClient();
  const business = await new BusinessRepository(supabase).requireDefault();
  const { data } = await supabase.from('productos')
    .select('*')
    .eq('business_unit_id', business.id)
    .eq('activo', true)
    .order('nombre');
  const productos = (data as Producto[]) || [];
  const destacados = productos.filter((p) => p.destacado);
  const resto = productos.filter((p) => !p.destacado);

  return (
    <div>
      <PageHeader eyebrow={`${destacados.length} de ${productos.length} productos activos`} title="⭐ Destacados" />
      <p className="text-sm text-muted -mt-6 mb-8 max-w-lg">
        Los productos destacados aparecen en la sección &ldquo;Destacados &amp; Ofertas&rdquo; de la portada.
        Márcalos o quítalos desde acá — el cambio se ve en el sitio al instante.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <SectionCard title={`En portada (${destacados.length})`}>
          {destacados.length === 0 ? <EmptyState emoji="⭐" texto="Ningún producto destacado todavía." /> : (
            <div className="flex flex-col gap-2">{destacados.map((p) => <FilaProducto key={p.id} producto={p} destacado />)}</div>
          )}
        </SectionCard>
        <SectionCard title={`Resto del catálogo (${resto.length})`}>
          {resto.length === 0 ? <EmptyState emoji="🌿" texto="Todo tu catálogo ya está destacado." /> : (
            <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">{resto.map((p) => <FilaProducto key={p.id} producto={p} destacado={false} />)}</div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function FilaProducto({ producto, destacado }: { producto: Producto; destacado: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-white/[0.02] rounded-xl px-4 py-2.5 border border-white/5">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-lg shrink-0">{producto.emoji || '🌱'}</span>
        <div className="min-w-0">
          <p className="text-sm text-texto truncate">{producto.nombre}</p>
          <p className="text-xs text-muted">${producto.precio.toLocaleString('es-CL')}</p>
        </div>
      </div>
      <form action={toggleDestacado.bind(null, producto.id, producto.destacado)} className="shrink-0">
        <button type="submit" className={destacado ? 'text-xs font-semibold px-3 py-1.5 rounded-full bg-[rgba(212,175,55,0.15)] text-gold border border-[rgba(212,175,55,0.3)] hover:bg-[rgba(212,175,55,0.25)] transition-colors' : 'text-xs font-semibold px-3 py-1.5 rounded-full bg-white/5 text-muted border border-white/10 hover:border-[rgba(0,255,179,0.3)] hover:text-neon transition-colors'}>
          {destacado ? '★ Quitar' : '☆ Destacar'}
        </button>
      </form>
    </div>
  );
}
