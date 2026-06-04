export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { mensaje } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      respuesta: "⚠️ Para que yo (el Asistente Virtual) pueda pensar, mi creador necesita agregar la variable GEMINI_API_KEY en los ajustes de Vercel."
    });
  }

  try {
    const prompt = `Eres el asistente virtual experto en ventas de "La Manito Del Vegano", una tienda de comida 100% plant-based y artesanal en Santiago y Pucón, Chile.
Tu objetivo es ser amable, cercano y muy persuasivo para vender.
- El producto estrella es el Manjar de Semilla de Cáñamo (único en Chile).
- Tienen empanadas veganas de pino, pies de arándanos, y packs en oferta.
- Se pide con 3 días de anticipación y hay despacho propio.
Responde de forma MUY concisa y directa (máximo 2-3 líneas). Usa un tono súper entusiasta y amigable. 
El cliente dice: "${mensaje}"`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 150
        }
      })
    });

    if (!response.ok) {
        throw new Error('Error en API de Gemini');
    }

    const data = await response.json();
    const texto = data.candidates[0].content.parts[0].text;

    res.status(200).json({ respuesta: texto.trim() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error conectando con la IA', respuesta: 'Ups, tuve un pequeño mareo cibernético. ¿Puedes repetir eso?' });
  }
}
