import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import ManualOrderForm from './ManualOrderForm';

export const dynamic = 'force-dynamic';

const BUSINESS_UNIT_ID = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';

type ManualOptionGroup = {
  key: string;
  label: string;
  required: boolean;
  options: string[];
};

function activeOptionGroups(product: any, prefix = '', keyPrefix = ''): ManualOptionGroup[] {
  const groups = Array.isArray(product?.product_option_groups) ? product.product_option_groups : [];
  return groups
    .filter((group: any) => group?.is_active !== false)
    .map((group: any) => ({
      key: `${keyPrefix}${String(group.id || group.code || group.name)}`,
      label: `${prefix}${String(group.name || 'Opción')}`,
      required: Boolean(group.is_required),
      options: (Array.isArray(group?.product_option_values) ? group.product_option_values : [])
        .filter((value: any) => value?.is_active !== false)
        .sort((a: any, b: any) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0))
        .map((value: any) => String(value.label)),
    }))
    .filter((group: ManualOptionGroup) => group.options.length > 0);
}

export default async function NuevoPedidoPage({
  searchParams,
}: {
  searchParams: Promise<{ conversationId?: string }>;
}) {
  await requireRole(['admin', 'soporte']);
  const { conversationId: rawConversationId } = await searchParams;
  const conversationId = String(rawConversationId || '').trim();
  const db = createSupabaseServiceClient();

  const [{ data: products, error: productError }, { data: customers, error: customerError }] = await Promise.all([
    db.from('productos')
      .select('id,nombre,precio,gramaje,variedades,maneja_stock,stock,product_option_groups(*,product_option_values(*)),product_pack_components:product_pack_components!product_pack_components_pack_product_id_business_unit_id_fkey(*)')
      .eq('business_unit_id', BUSINESS_UNIT_ID)
      .eq('activo', true)
      .order('nombre'),
    db.from('omnichannel_contacts')
      .select('id,nombre,display_name,phone,email,direccion,metadata')
      .eq('business_unit_id', BUSINESS_UNIT_ID)
      .order('updated_at', { ascending: false })
      .limit(150),
  ]);
  if (productError) throw productError;
  if (customerError) throw customerError;

  let initialContext: {
    conversationId: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    address: string;
    comuna: string;
    sourceChannel: 'whatsapp' | 'instagram';
  } | null = null;

  if (conversationId) {
    const { data: conversation, error: conversationError } = await db
      .from('conversations')
      .select('id,business_unit_id,customer_id,contact_id,channel,order_id')
      .eq('id', conversationId)
      .eq('business_unit_id', BUSINESS_UNIT_ID)
      .maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation || !['whatsapp', 'instagram'].includes(String(conversation.channel))) {
      throw new Error('La conversación no existe o no admite registro de venta.');
    }
    if (conversation.order_id) redirect(`/admin/pedidos/${conversation.order_id}`);

    const customerId = String(conversation.customer_id || conversation.contact_id || '');
    if (!customerId) throw new Error('La conversación no tiene cliente CRM asociado.');
    const { data: contact, error: contactError } = await db
      .from('omnichannel_contacts')
      .select('id,nombre,display_name,phone,email,direccion,metadata')
      .eq('id', customerId)
      .eq('business_unit_id', BUSINESS_UNIT_ID)
      .maybeSingle();
    if (contactError) throw contactError;
    if (!contact) throw new Error('No se encontró el cliente CRM de la conversación.');

    initialContext = {
      conversationId,
      customerId,
      customerName: String(contact.nombre || contact.display_name || ''),
      customerPhone: String(contact.phone || ''),
      customerEmail: String(contact.email || ''),
      address: String(contact.direccion || ''),
      comuna: typeof contact.metadata?.comuna === 'string' ? contact.metadata.comuna : '',
      sourceChannel: String(conversation.channel) as 'whatsapp' | 'instagram',
    };
  }

  const productRows = (products || []) as any[];
  const byId = new Map(productRows.map((row) => [String(row.id), row]));
  const manualProducts = productRows.map((row) => {
    const ownGroups = activeOptionGroups(row, '', `product:${row.id}:`);
    const inheritedGroups = (Array.isArray(row.product_pack_components) ? row.product_pack_components : []).flatMap((component: any) => {
      const child = component?.component_product_id ? byId.get(String(component.component_product_id)) : null;
      return child
        ? activeOptionGroups(
          child,
          `${String(component.component_name || child.nombre || 'Componente')} · `,
          `component:${String(component.id || component.component_product_id)}:`,
        )
        : [];
    });
    const dedupedGroups = Array.from(new Map([...ownGroups, ...inheritedGroups].map((group) => [group.key, group])).values());
    return {
      id: row.id,
      nombre: row.nombre,
      precio: Number(row.precio || 0),
      gramaje: row.gramaje,
      variedades: row.variedades,
      maneja_stock: row.maneja_stock,
      stock: row.stock == null ? null : Number(row.stock),
      orderOptionGroups: dedupedGroups,
    };
  });

  return (
    <div className="max-w-[1100px] w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] tracking-[4px] text-neon uppercase font-display mb-1">✦ Gestión Comercial</p>
          <h1 className="font-display font-bold text-3xl text-white">{initialContext ? 'Registrar venta desde conversación' : 'Nuevo pedido manual'}</h1>
          <p className="text-sm text-muted mt-1">{initialContext ? `Cliente y canal vinculados de forma segura a ${initialContext.sourceChannel}.` : 'Quedará en el mismo sistema de ventas, CRM, stock e impresión que Web, Instagram y WhatsApp.'}</p>
        </div>
        <Link href={initialContext ? '/admin/conversaciones' : '/admin/pedidos'} className="border border-white/10 px-4 py-2 rounded-lg text-sm text-white hover:border-neon/40">← {initialContext ? 'Conversaciones' : 'Pedidos'}</Link>
      </div>
      <ManualOrderForm products={manualProducts} customers={(customers || []) as any} initialContext={initialContext} />
    </div>
  );
}