export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // Si viene 'mensaje' (versión antigua) o 'history' (versión nueva)
  const { mensaje, history } = req.body;
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) return res.status(200).json({ respuesta: "Faltó la llave." });

  try {
    const systemContext = `Eres el asistente experto en ventas de "La Manito Del Vegano", tienda plant-based en Santiago y Pucón. Eres muy persuasivo, amigable y usas emojis.
Ofrecen productos 100% veganos como Empanadas de Pino Soya, Pies de Arándanos, Tartas, etc.
Tu objetivo es responder de forma breve, empática y guiar al cliente a comprar.
Si piden el "botón de pagar" o "dónde pago", diles que primero deben agregar los productos al carrito haciendo clic en el botón de "Agregar al carrito" en la página, y luego abrir el carrito (el ícono del supermercado arriba a la derecha) para completar el pedido.
Tienes buena memoria, recuerda lo que el cliente te dijo antes. No seas repetitivo.`;

    let contents = [];
    if (history && history.length > 0) {
        contents = [...history];
        // Inyectar el contexto del sistema en el primer mensaje del usuario para asegurar que la IA sepa quién es.
        contents[0] = {
            role: "user",
            parts: [{ text: systemContext + "\n\nMensaje del cliente: " + history[0].parts[0].text }]
        };
    } else {
        // Fallback por si acaso el frontend no mandó history
        contents = [{ role: "user", parts: [{ text: systemContext + "\n\nMensaje del cliente: " + (mensaje || "Hola") }] }];
    }

    let modelName = 'gemini-1.5-flash';
    let url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: contents })
    });

    if (response.status === 404) {
      // Fallback: Buscar dinámicamente qué modelos tiene permitidos esta API Key
      const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        const validModel = (modelsData.models || []).find(m => 
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
    res.status(200).json({ respuesta: data.candidates[0].content.parts[0].text.trim() });
  } catch (error) {
    res.status(500).json({ respuesta: `Error técnico exacto: ${error.message}` });
  }
}
