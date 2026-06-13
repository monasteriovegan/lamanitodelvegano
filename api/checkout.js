export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { carrito, nombre, direccion, telefono, zona, envio, fecha, pedidoId } = req.body;
  const mpAccessToken = (process.env.MP_ACCESS_TOKEN || '').trim();

  if (!mpAccessToken) {
    return res.status(500).json({ 
      error: 'La variable de entorno MP_ACCESS_TOKEN no está configurada en Vercel.' 
    });
  }

  if (!carrito || Object.keys(carrito).length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío.' });
  }

  try {
    // 1. Preparar los items para Mercado Pago
    const items = [];
    const keys = Object.keys(carrito);
    
    for (const key of keys) {
      const item = carrito[key];
      items.push({
        title: item.nombre,
        description: `Cantidad: ${item.qty}`,
        quantity: parseInt(item.qty),
        unit_price: parseFloat(item.precio),
        currency_id: 'CLP' // Moneda local de Chile
      });
    }

    // 2. Si el costo de envío es mayor a cero, agregarlo como un producto adicional
    if (envio && parseFloat(envio) > 0) {
      items.push({
        title: `Despacho: ${zona || 'Zona seleccionada'}`,
        description: `Fecha de entrega: ${fecha || 'Coordinar'}`,
        quantity: 1,
        unit_price: parseFloat(envio),
        currency_id: 'CLP'
      });
    }

    // 3. Obtener el origen dinámicamente de los headers para la redirección de vuelta
    const referer = req.headers.referer || '';
    const origin = referer ? new URL(referer).origin : 'https://la-manito-del-vegano.vercel.app';

    // 4. Construir el payload de Mercado Pago
    const preferencePayload = {
      items: items,
      payer: {
        name: nombre || 'Cliente La Manito',
        phone: telefono ? { number: telefono } : undefined,
        address: direccion ? { street_name: direccion } : undefined
      },
      back_urls: {
        success: `${origin}/?status=success`,
        failure: `${origin}/?status=failure`,
        pending: `${origin}/?status=pending`
      },
      auto_return: 'approved',
      external_reference: pedidoId || undefined,
      // Metadata útil para asociar compras en tu panel
      metadata: {
        pedido_id: pedidoId,
        nombre_cliente: nombre,
        direccion_entrega: direccion,
        telefono_cliente: telefono,
        fecha_entrega: fecha,
        zona_envio: zona
      }
    };

    // 5. Llamar a la API de Mercado Pago para crear la preferencia
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferencePayload)
    });

    if (!mpResponse.ok) {
      const errBody = await mpResponse.text();
      throw new Error(`Mercado Pago API error: ${mpResponse.status} - ${errBody}`);
    }

    const mpData = await mpResponse.json();

    // Devolvemos el init_point para redirigir al cliente
    return res.status(200).json({ 
      id: mpData.id,
      init_point: mpData.init_point // URL real de cobro de Mercado Pago
    });

  } catch (error) {
    console.error('Error creando preferencia de Mercado Pago:', error);
    return res.status(500).json({ 
      error: `Error al procesar el pago con Mercado Pago: ${error.message}` 
    });
  }
}
