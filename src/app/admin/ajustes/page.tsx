import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { guardarAjustes } from './actions';
import { PageHeader, SectionCard } from '../_ui/AdminUI';

export default async function AdminAjustesPage() {
  await requireRole(['admin']);
  const supabase = createSupabaseServiceClient();
  const { data: ajustesRow } = await supabase.from('ajustes').select('data').eq('id', 'global').maybeSingle();
  const ajustes = ajustesRow?.data || {};

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon transition-colors";
  const selectClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon transition-colors cursor-pointer";
  const labelClass = "block text-xs uppercase tracking-wider text-muted font-bold mb-1.5";

  return (
    <div className="max-w-[850px] text-crema space-y-6">
      <PageHeader eyebrow="⚙️ Sistema" title="Ajustes Generales" />

      <form action={guardarAjustes} className="space-y-6">
        
        {/* Identidad y Contacto */}
        <SectionCard title="🌱 Identidad & Contacto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label className={labelClass}>Nombre de la Tienda</label>
              <input
                name="nombre"
                defaultValue={ajustes.nombre || ''}
                placeholder="La Manito del Vegano"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Estado de Operación</label>
              <select
                name="estado"
                defaultValue={ajustes.estado || 'abierto'}
                className={selectClass}
              >
                <option value="abierto" className="bg-[#050e0a] text-white">🟢 Abierto — recibiendo pedidos</option>
                <option value="cerrado" className="bg-[#050e0a] text-white">🔴 Cerrado — pausado temporalmente</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>WhatsApp (ej: 56912345678)</label>
              <input
                name="whatsapp"
                defaultValue={ajustes.whatsapp || ''}
                placeholder="569XXXXXXXX"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Email de Contacto Público</label>
              <input
                name="contact_email"
                type="email"
                defaultValue={ajustes.contact_email || ''}
                placeholder="contacto@lamanitodelvegano.cl"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Teléfono Fijo / Contacto</label>
              <input
                name="contact_phone"
                defaultValue={ajustes.contact_phone || ''}
                placeholder="+5622XXXXXX"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Dirección del Taller</label>
              <input
                name="contact_address"
                defaultValue={ajustes.contact_address || ''}
                placeholder="Av. Providencia 1234"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Ciudad</label>
              <input
                name="contact_city"
                defaultValue={ajustes.contact_city || 'Santiago, Chile'}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Horarios de Atención</label>
              <input
                name="business_hours"
                defaultValue={ajustes.business_hours || 'Lunes a Viernes 09:00 - 18:00'}
                placeholder="Lun a Vie 09:00 a 18:00"
                className={inputClass}
              />
            </div>
          </div>
        </SectionCard>

        {/* Redes Sociales */}
        <SectionCard title="🔌 Redes Sociales">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
            <div>
              <label className={labelClass}>Instagram (usuario)</label>
              <input
                name="instagram"
                defaultValue={ajustes.instagram || ''}
                placeholder="lamanitodelvegano"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>TikTok (usuario)</label>
              <input
                name="tiktok"
                defaultValue={ajustes.tiktok || ''}
                placeholder="lamanitodelvegano"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Facebook (usuario)</label>
              <input
                name="facebook"
                defaultValue={ajustes.facebook || ''}
                placeholder="lamanitodelvegano"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>YouTube (canal/usuario)</label>
              <input
                name="youtube"
                defaultValue={ajustes.youtube || ''}
                placeholder="lamanito"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Pinterest (usuario)</label>
              <input
                name="pinterest"
                defaultValue={ajustes.pinterest || ''}
                placeholder="lamanito"
                className={inputClass}
              />
            </div>
          </div>
        </SectionCard>

        {/* Transferencia Bancaria */}
        <SectionCard title="🏦 Datos de Transferencia Bancaria">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label className={labelClass}>Banco Destino</label>
              <input
                name="transfer_bank_name"
                defaultValue={ajustes.transfer_bank_name || ''}
                placeholder="Banco Estado, Banco de Chile..."
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Tipo de Cuenta</label>
              <input
                name="transfer_account_type"
                defaultValue={ajustes.transfer_account_type || ''}
                placeholder="Cuenta Corriente, Cuenta Vista..."
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Nombre Titular</label>
              <input
                name="transfer_account_holder"
                defaultValue={ajustes.transfer_account_holder || ''}
                placeholder="La Manito SpA"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>RUT Titular</label>
              <input
                name="transfer_account_rut"
                defaultValue={ajustes.transfer_account_rut || ''}
                placeholder="76.XXX.XXX-X"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Número de Cuenta</label>
              <input
                name="transfer_account_number"
                defaultValue={ajustes.transfer_account_number || ''}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email para comprobante</label>
              <input
                name="transfer_email"
                type="email"
                defaultValue={ajustes.transfer_email || ''}
                placeholder="pagos@lamanitodelvegano.cl"
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Instrucciones de Pago</label>
              <textarea
                name="transfer_instructions"
                defaultValue={ajustes.transfer_instructions || 'Por favor envía el comprobante de transferencia indicando tu número de pedido.'}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon resize-none"
              />
            </div>
          </div>
        </SectionCard>

        {/* Banner Informativo */}
        <SectionCard title="📢 Banner General de Anuncio">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <div className="md:col-span-3">
              <label className="inline-flex items-center gap-3 cursor-pointer select-none mb-3">
                <input
                  name="banner_enabled"
                  type="checkbox"
                  defaultChecked={ajustes.banner_enabled || false}
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-neon focus:ring-neon accent-[#00ffb3]"
                />
                <span className="text-sm font-semibold text-white">Habilitar banner flotante de anuncio superior</span>
              </label>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Texto del Anuncio</label>
              <input
                name="banner_text"
                defaultValue={ajustes.banner_text || ''}
                placeholder="¡Despacho gratis en compras sobre $25.000!"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Color de Fondo (ej: #2d6a4f)</label>
              <input
                name="banner_color"
                defaultValue={ajustes.banner_color || '#2d6a4f'}
                className={inputClass}
              />
            </div>
          </div>
        </SectionCard>

        {/* Programa de Fidelidad */}
        <SectionCard title="⭐ Programa de Fidelidad">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div>
              <label className={labelClass}>$ para ganar 1 punto</label>
              <input
                name="tasa_puntos"
                type="number"
                defaultValue={ajustes.tasaPuntos || 1000}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>$ que equivale 1 punto al canjear</label>
              <input
                name="valor_punto"
                type="number"
                defaultValue={ajustes.valorPunto || 100}
                className={inputClass}
              />
            </div>
          </div>
        </SectionCard>

        {/* SEO */}
        <SectionCard title="🔍 Optimización SEO & Metadatos">
          <div className="grid grid-cols-1 gap-4 mt-2">
            <div>
              <label className={labelClass}>Meta Título del Sitio (página principal)</label>
              <input
                name="meta_title"
                defaultValue={ajustes.meta_title || ''}
                placeholder="La Manito del Vegano — Comida Vegana Artesanal"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Meta Descripción</label>
              <textarea
                name="meta_description"
                defaultValue={ajustes.meta_description || ''}
                rows={2}
                placeholder="Elaboración artesanal de empanadas, postres y platos listos..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon resize-none"
              />
            </div>
            <div>
              <label className={labelClass}>Imagen OpenGraph (URL compartida en redes)</label>
              <input
                name="og_image_url"
                defaultValue={ajustes.og_image_url || ''}
                placeholder="https://..."
                className={inputClass}
              />
            </div>
          </div>
        </SectionCard>

        <button
          type="submit"
          className="bg-neon text-black font-bold py-3 px-8 rounded-xl text-sm shadow-[0_0_15px_rgba(0,255,179,0.3)] hover:bg-neon/90 transition-all"
        >
          Guardar Ajustes
        </button>
      </form>
    </div>
  );
}
