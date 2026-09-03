import { normalizeAmountToNumber } from '../messaging/amounts.ts';

export function formatDeterministicToolResponse(
  toolResults: Array<{ name: string; result: any }>,
  userQuery = '',
): string {
  if (!toolResults || toolResults.length === 0) {
    return 'No se obtuvieron resultados de las herramientas de consulta.';
  }

  // 1. Prioridad: search_omnichannel_messages
  const searchMsgResult = toolResults.find((t) => t.name === 'search_omnichannel_messages')?.result;
  if (searchMsgResult && typeof searchMsgResult === 'object') {
    const amountObj = searchMsgResult.searched_amount;
    const amountStr = amountObj?.normalized_clp
      ? `$${amountObj.normalized_clp.toLocaleString('es-CL')}`
      : amountObj?.input || '';
    const messages = Array.isArray(searchMsgResult.messages) ? searchMsgResult.messages : [];
    const orders = Array.isArray(searchMsgResult.matched_orders_with_same_amount) ? searchMsgResult.matched_orders_with_same_amount : [];

    if (messages.length === 0 && orders.length === 0) {
      if (amountStr) {
        return `Revisé los mensajes, comprobantes procesados y pedidos registrados en WhatsApp, Instagram y Web, y no encontré coincidencias por ${amountStr}.`;
      }
      return 'Revisé los mensajes, comprobantes procesados y pedidos registrados en WhatsApp, Instagram y Web, y no encontré coincidencias para esa búsqueda.';
    }

    const parts: string[] = [];
    if (orders.length > 0) {
      parts.push(`Encontré ${orders.length} pedido(s) registrado(s) con ese monto:`);
      for (const ord of orders) {
        parts.push(`• Pedido #${ord.order_number || ord.id.slice(0, 8)}: ${ord.nombre_cliente || 'Sin nombre'} (${ord.telefono || 'Sin teléfono'}) · $${Number(ord.total || 0).toLocaleString('es-CL')} · Estado: ${ord.estado || 'desconocido'} · Canal: ${ord.source_channel || 'web'} · Fecha: ${ord.created_at ? ord.created_at.slice(0, 10) : 'N/A'}`);
      }
    }

    if (messages.length > 0) {
      parts.push(`Encontré ${messages.length} mensaje(s)/comprobante(s) coincidente(s):`);
      for (const m of messages) {
        const cust = m.customer?.name || m.customer?.phone || 'Contacto no identificado';
        const phone = m.customer?.phone ? ` (${m.customer.phone})` : '';
        const ch = m.channel ? `[${m.channel.toUpperCase()}]` : '';
        const date = m.sent_at ? m.sent_at.slice(0, 16).replace('T', ' ') : '';
        const content = m.ocr_text ? `OCR: ${m.ocr_text.slice(0, 120)}` : m.body ? `Texto: "${m.body.slice(0, 100)}"` : 'Adjunto sin texto';
        parts.push(`• ${ch} ${cust}${phone} el ${date}: ${content}`);
      }
    }

    return parts.join('\n');
  }

  // 2. recent_orders
  const recentOrdersResult = toolResults.find((t) => t.name === 'recent_orders')?.result;
  if (Array.isArray(recentOrdersResult)) {
    if (recentOrdersResult.length === 0) return 'No hay pedidos recientes registrados.';
    const lines = recentOrdersResult.slice(0, 5).map((o: any) =>
      `• Pedido #${o.id?.slice(0, 8)}: ${o.nombre_cliente || 'Cliente'} · $${Number(o.total || 0).toLocaleString('es-CL')} · ${o.estado || 'sin estado'}`
    );
    return `Pedidos recientes:\n${lines.join('\n')}`;
  }

  // 3. customer_search
  const custSearchResult = toolResults.find((t) => t.name === 'customer_search')?.result;
  if (Array.isArray(custSearchResult)) {
    if (custSearchResult.length === 0) return 'No se encontraron clientes que coincidan con la búsqueda.';
    const lines = custSearchResult.slice(0, 5).map((c: any) =>
      `• ${c.nombre || c.display_name || 'Contacto'} · Tel: ${c.phone || 'N/A'} · Pedidos: ${c.total_orders || 0}`
    );
    return `Clientes encontrados:\n${lines.join('\n')}`;
  }

  // 4. business_overview
  const overview = toolResults.find((t) => t.name === 'business_overview')?.result;
  if (overview && typeof overview === 'object') {
    return `Resumen operativo: ${overview.orders_recent || 0} pedidos recientes ($${Number(overview.sales_recent_total || 0).toLocaleString('es-CL')}), ${overview.orders_pending || 0} pendientes y ${overview.conversations || 0} conversaciones.`;
  }

  return 'Consulta completada con éxito.';
}
