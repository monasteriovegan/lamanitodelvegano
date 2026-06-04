export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { mensaje } = req.body;
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) return res.status(200).json({ respuesta: "Faltó la llave." });

  try {
    const prompt = `Eres el asistente experto en ventas de "La Manito Del Vegano", tienda plant-based en Santiago y Pucón. Responde muy conciso y amigable. El cliente dice: "${mensaje}"`;

    let modelName = 'gemini-1.5-flash';
    let url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
    });

    if (response.status === 404) {
      // Fallback: Buscar dinámicamente qué modelos tiene permitidos esta API Key
      const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        // Buscar el primer modelo Gemini que soporte generación de texto
        const validModel = (modelsData.models || []).find(m => 
            m.supportedGenerationMethods && 
            m.supportedGenerationMethods.includes('generateContent') &&
            m.name.includes('gemini')
        );
        
        if (validModel) {
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
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
