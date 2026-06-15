import crypto from 'crypto';

const SUPABASE_URL = 'https://adrydqvahzqjbgtcvlay.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcnlkcXZhaHpxamJndGN2bGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNjExMDAsImV4cCI6MjA5NTkzNzEwMH0.mjpGjVN90sHJAahn3NTslo3wLzW0ttQlOrwBQ62BZko';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Flow sends the token in URL-encoded form body
  const token = req.body.token;
  if (!token) {
    return res.status(400).json({ error: 'Falta el token de pago' });
  }

  try {
    // 1. Obtener configuraciones de Flow
    const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/ajustes?id=eq.global`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!supabaseRes.ok) {
      throw new Error('Error al obtener ajustes globales');
    }

    const ajustesList = await supabaseRes.json();
    const ajustes = ajustesList[0]?.data || {};

    const flowApiKey = (ajustes.flow_api_key || '').trim();
    const flowSecretKey = (ajustes.flow_secret_key || '').trim();
    const flowSandbox = ajustes.flow_sandbox;

    if (!flowApiKey || !flowSecretKey) {
      throw new Error('Flow no está configurado en los ajustes');
    }

    // 2. Parámetros para consultar el estado del pago
    const params = {
      apiKey: flowApiKey,
      token: token
    };

    // Ordenar y firmar
    const keys = Object.keys(params).sort();
    let toSign = '';
    keys.forEach(k => {
      toSign += k + params[k];
    });

    const signature = crypto
      .createHmac('sha256', flowSecretKey)
      .update(toSign)
      .digest('hex');

    params.s = signature;

    const queryString = Object.keys(params)
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
      .join('&');

    const statusEndpoint = flowSandbox
      ? 'https://sandbox.flow.cl/api/payment/getStatus'
      : 'https://www.flow.cl/api/payment/getStatus';

    // 3. Consultar estado a Flow
    const statusRes = await fetch(`${statusEndpoint}?${queryString}`);
    if (!statusRes.ok) {
      const errTxt = await statusRes.text();
      throw new Error(`Error en getStatus de Flow: ${statusRes.status} - ${errTxt}`);
    }

    const flowStatus = await statusRes.json();

    // 4. Si el pago fue aprobado (status === 2), actualizar base de datos
    // status values: 1 = pendiente, 2 = pagado, 3 = rechazado
    if (parseInt(flowStatus.status) === 2) {
      const pedidoId = flowStatus.commerceOrder;
      
      console.log(`Pago aprobado para el pedido ${pedidoId} en Flow`);

      // Actualizar el estado del pedido en Supabase
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/pedidos?id=eq.${pedidoId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'Pagado' })
      });

      if (!updateRes.ok) {
        console.error(`Error actualizando pedido ${pedidoId} a Pagado en Supabase`);
      } else {
        console.log(`Pedido ${pedidoId} actualizado correctamente a Pagado`);
      }
    }

    // Responder a Flow confirmando recepción exitosa
    return res.status(200).send('OK');

  } catch (error) {
    console.error('Error procesando webhook de Flow:', error);
    return res.status(500).json({ error: error.message });
  }
}
