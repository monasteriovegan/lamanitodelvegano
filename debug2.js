const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, 'api');
if (!fs.existsSync(apiDir)){
    fs.mkdirSync(apiDir);
}

const chatApiCode = `export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { mensaje } = req.body;
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) return res.status(200).json({ respuesta: "Faltó la llave." });

  try {
    const prompt = \`Eres el asistente experto en ventas de "La Manito Del Vegano", tienda plant-based en Santiago y Pucón. Responde muy conciso y amigable. El cliente dice: "\${mensaje}"\`;

    // Cambié el modelo a gemini-pro que es el más estable y universal
    const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=\${apiKey}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
    });

    if (!response.ok) {
        const errTxt = await response.text();
        throw new Error(\`Google Error \${response.status}: \${errTxt}\`);
    }

    const data = await response.json();
    res.status(200).json({ respuesta: data.candidates[0].content.parts[0].text.trim() });
  } catch (error) {
    res.status(500).json({ respuesta: \`Error técnico exacto: \${error.message}\` });
  }
}
`;

fs.writeFileSync(path.join(apiDir, 'chat.js'), chatApiCode, 'utf8');

console.log("Model updated to gemini-pro in api/chat.js");
