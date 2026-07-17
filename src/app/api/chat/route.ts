import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { history, productos } = await request.json();

    // 1. Obtener la clave de Gemini desde la base de datos (integraciones_secretas)
    let apiKey = '';
    try {
      const supabase = createSupabaseServiceClient();
      const { data: integraciones } = await supabase
        .from('integraciones_secretas')
        .select('gemini_api_key')
        .eq('id', 'global')
        .maybeSingle();
      
      if (integraciones?.gemini_api_key) {
        apiKey = integraciones.gemini_api_key.trim();
      }
    } catch (err) {
      console.error('Error leyendo gemini_api_key de la BD:', err);
    }

    // 2. Si no está en la BD, buscar en las variables de entorno
    if (!apiKey) {
      apiKey = (process.env.GEMINI_API_KEY || '').trim();
    }

    if (!apiKey) {
      return NextResponse.json({ respuesta: 'Lo siento, la clave API de Gemini no está configurada en la base de datos ni en el servidor.' });
    }

    // 3. Crear el contexto
    let systemContext = `Eres el asistente experto en ventas de "La Manito Del Vegano", tienda plant-based en Santiago y Pucón. Eres muy persuasivo, amigable y usas emojis.
Tu objetivo es responder de forma breve, empática y guiar al cliente a comprar.
Si piden el "botón de pagar" o "dónde pago", diles que primero deben agregar los productos al carrito haciendo clic en el botón de "Agregar al carrito" en la página, y luego abrir el carrito (el ícono del supermercado arriba a la derecha) para completar el pedido.
Tienes buena memoria, recuerda lo que el cliente te dijo antes. No seas repetitivo.`;

    if (productos && productos.length > 0) {
      const listaProds = productos.map((p: any) => {
        let txt = `- ${p.nombre} ($${p.precio})`;
        if (p.descripcion) txt += `: ${p.descripcion}`;
        let opt = [];
        if (p.gramaje) opt.push(`formatos: ${p.gramaje}`);
        if (p.variedades) opt.push(`variedades: ${p.variedades}`);
        if (opt.length > 0) txt += ` (${opt.join(', ')})`;
        return txt;
      }).join('\n');
      systemContext += `\n\nLos productos disponibles actualmente en la tienda que puedes ofrecer son:\n${listaProds}`;
    } else {
      systemContext += `\n\nOfrecen productos 100% veganos como Empanadas de Pino Soya, Pies de Arándanos, Tartas, etc.`;
    }

    let contents = [];
    if (history && history.length > 0) {
      contents = [...history];
      contents[0] = {
        role: 'user',
        parts: [{ text: systemContext + '\n\nMensaje del cliente: ' + history[0].parts[0].text }]
      };
    } else {
      contents = [{ role: 'user', parts: [{ text: systemContext + '\n\nMensaje del cliente: Hola' }] }];
    }

    let modelName = 'gemini-1.5-flash';
    let url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: contents })
    });

    if (response.status === 404) {
      const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        const validModel = (modelsData.models || []).find((m: any) =>
          m.supportedGenerationMethods &&
          m.supportedGenerationMethods.includes('generateContent') &&
          m.name.includes('gemini')
        );

        if (validModel) {
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents })
          });
        }
      }
    }

    if (!response.ok) {
      const errTxt = await response.text();
      throw new Error(`Google Error ${response.status}: ${errTxt}`);
    }

    const data = await response.json();
    const respuestaText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No pude procesar tu mensaje en este momento.';
    
    return NextResponse.json({ respuesta: respuestaText.trim() });
  } catch (error: any) {
    console.error('Error in chatbot API:', error);
    return NextResponse.json({ respuesta: `Error técnico: ${error.message}` }, { status: 500 });
  }
}
