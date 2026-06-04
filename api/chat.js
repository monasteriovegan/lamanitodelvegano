export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { mensaje } = req.body;
  // El ".trim()" limpia la llave por si se pegó con espacios ocultos
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) return res.status(200).json({ respuesta: "Faltó la llave." });

  try {
    const prompt = `Eres el asistente experto en ventas de "La Manito Del Vegano", tienda plant-based en Santiago y Pucón. Responde muy conciso y amigable. El cliente dice: "${mensaje}"`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
    });

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
