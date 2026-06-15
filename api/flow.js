import crypto from 'crypto';

const SUPABASE_URL = 'https://adrydqvahzqjbgtcvlay.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcnlkcXZhaHpxamJndGN2bGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNjExMDAsImV4cCI6MjA5NTkzNzEwMH0.mjpGjVN90sHJAahn3NTslo3wLzW0ttQlOrwBQ62BZko';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { carrito, nombre, direccion, telefono, zona, envio, fecha, pedidoId, descuentoCupon, descuentoFidelidad } = req.body;

  if (!carrito || Object.keys(carrito).length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío.' });
  }

  try {
    // 1. Obtener configuraciones de Flow desde Supabase
    const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/ajustes?id=eq.global`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!supabaseRes.ok) {
      throw new Error('No se pudo conectar a la base de datos de ajustes');
    }

    const ajustesList = await supabaseRes.json();
    const ajustes = ajustesList[0]?.data || {};

    const flowEnabled = ajustes.flow_enabled;
    const flowApiKey = (ajustes.flow_api_key || '').trim();
    const flowSecretKey = (ajustes.flow_secret_key || '').trim();
    const flowSandbox = ajustes.flow_sandbox;

    if (!flowEnabled || !flowApiKey || !flowSecretKey) {
      return res.status(500).json({ 
        error: 'La pasarela de pago Flow no está configurada o activada en el panel de control.' 
      });
    }

    // 2. Calcular el total a cobrar
    const itemsTotal = Object.keys(carrito).reduce((sum, key) => {
      const item = carrito[key];
      return sum + (parseInt(item.precio) * parseInt(item.qty));
    }, 0);
    
    const finalTotal = Math.max(0, itemsTotal + parseInt(envio || 0) - parseInt(descuentoCupon || 0) - parseInt(descuentoFidelidad || 0));

    // 3. Determinar dominio del cliente para redirecciones
    const referer = req.headers.referer || '';
    const origin = referer ? new URL(referer).origin : 'https://lamanitodelvegano.vercel.app';

    // 4. Parámetros de Flow (deben ir ordenados alfabéticamente para la firma)
    const flowParams = {
      amount: finalTotal.toString(),
      apiKey: flowApiKey,
      commerceOrder: pedidoId || `order_${Date.now()}`,
      email: req.body.email || 'cliente@lamanitodelvegano.cl',
      subject: `Pedido #${(pedidoId || '').substring(0, 6).toUpperCase()} - La Manito Del Vegano`,
      urlConfirmation: `${origin}/api/flow-confirm`,
      urlReturn: `${origin}/?status=success`
    };

    // Ordenar llaves alfabéticamente
    const keys = Object.keys(flowParams).sort();

    // Concatenar parámetros para firma
    let toSign = '';
    keys.forEach(k => {
      toSign += k + flowParams[k];
    });

    // Generar firma HMAC-SHA256
    const signature = crypto
      .createHmac('sha256', flowSecretKey)
      .update(toSign)
      .digest('hex');

    // Agregar firma al payload
    flowParams.s = signature;

    // Convertir a URL-encoded string
    const formBody = Object.keys(flowParams)
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(flowParams[k]))
      .join('&');

    const flowEndpoint = flowSandbox 
      ? 'https://sandbox.flow.cl/api/payment/create' 
      : 'https://www.flow.cl/api/payment/create';

    // 5. Llamar a Flow
    const flowRes = await fetch(flowEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody
    });

    if (!flowRes.ok) {
      const errBody = await flowRes.text();
      throw new Error(`Flow API error: ${flowRes.status} - ${errBody}`);
    }

    const flowData = await flowRes.json();

    if (flowData.url && flowData.token) {
      return res.status(200).json({ 
        url: `${flowData.url}?token=${flowData.token}`
      });
    } else {
      throw new Error('La respuesta de Flow no contiene la URL de redirección');
    }

  } catch (error) {
    console.error('Error al procesar pago con Flow:', error);
    return res.status(500).json({ 
      error: `Error al procesar el pago con Flow: ${error.message}` 
    });
  }
}
