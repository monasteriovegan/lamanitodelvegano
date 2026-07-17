import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Genera una respuesta breve para un mensaje entrante de WhatsApp usando
 * Gemini. Es una versión reducida y autónoma del mismo patrón que usa
 * /api/chat (Chef Remy en la web) — separada a propósito para no modificar
 * ese endpoint que ya está funcionando en producción.
 */
export async function generarRespuestaWhatsApp(mensajeCliente: string): Promise<string> {
  const supabase = createSupabaseServiceClient();
  const { data: config } = await supabase
    .from('integraciones_secretas')
    .select('gemini_api_key')
    .eq('id', 'global')
    .maybeSingle();

  const apiKey = (config?.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return 'Gracias por escribirnos 🌱 En breve un miembro del equipo te responde. Mientras tanto, puedes ver el catálogo y hacer tu pedido en lamanitodelvegano.cl';
  }

  const systemPrompt = `Eres el asistente de WhatsApp de "La Manito Del Vegano", tienda plant-based en Santiago y Pucón.
Responde MUY breve (máximo 2-3 líneas), cálido, con emojis moderados.
Si preguntan por el pedido/seguimiento, diles que revisen el link de seguimiento que les llegó por email, o que den el número de pedido.
Si quieren comprar, indícales que pueden hacerlo directo en la web: lamanitodelvegano.cl
No inventes precios ni promociones que no te hayan dado.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nMensaje del cliente: ${mensajeCliente}` }] }],
        }),
      }
    );

    if (!response.ok) throw new Error(`Gemini respondió ${response.status}`);

    const data = await response.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return texto?.trim() || 'Gracias por tu mensaje 🌱 En breve te respondemos.';
  } catch (err) {
    console.error('Error generando respuesta de WhatsApp con Gemini:', err);
    return 'Gracias por escribirnos 🌱 En breve un miembro del equipo te responde.';
  }
}
