import { createSupabaseServiceClient } from '@/lib/supabase/server';

export default async function AdminMetricasPage() {
  const supabase = createSupabaseServiceClient();
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('total, status, items, createdAt')
    .neq('status', 'Cancelado');

  const ventasTotales = (pedidos || []).reduce((sum, p) => sum + p.total, 0);
  const cantidadPedidos = (pedidos || []).length;
  const ticketPromedio = cantidadPedidos > 0 ? Math.round(ventasTotales / cantidadPedidos) : 0;

  const conteoProductos: Record<string, number> = {};
  for (const p of pedidos || []) {
    for (const item of p.items as { nombre: string; qty: number }[]) {
      conteoProductos[item.nombre] = (conteoProductos[item.nombre] || 0) + item.qty;
    }
  }
  const topProductos = Object.entries(conteoProductos)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div>
      <h1 className="font-display font-bold text-xl text-white mb-6">📊 Métricas</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-5">
          <p className="text-xs text-muted mb-1">Ventas totales</p>
          <p className="font-display font-bold text-2xl text-neon">${ventasTotales.toLocaleString('es-CL')}</p>
        </div>
        <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-5">
          <p className="text-xs text-muted mb-1">Pedidos</p>
          <p className="font-display font-bold text-2xl text-white">{cantidadPedidos}</p>
        </div>
        <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-5">
          <p className="text-xs text-muted mb-1">Ticket promedio</p>
          <p className="font-display font-bold text-2xl text-white">${ticketPromedio.toLocaleString('es-CL')}</p>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-5">
        <h2 className="text-sm font-bold text-white mb-4">🏆 Productos más vendidos</h2>
        {topProductos.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay suficientes datos.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {topProductos.map(([nombre, qty], idx) => (
              <div key={nombre} className="flex items-center justify-between">
                <span className="text-sm text-white">
                  {idx + 1}. {nombre}
                </span>
                <span className="text-sm text-neon font-bold">{qty} uds</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
