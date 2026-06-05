export default async function handler(req, res) {
  // 1. Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
        console.log('Webhook verified successfully.');
        return res.status(200).send(challenge);
      } else {
        return res.status(403).send('Verification token mismatch.');
      }
    }
    return res.status(400).send('Bad Request');
  }

  // 2. Incoming Event Processing (POST)
  if (req.method === 'POST') {
    const body = req.body;

    // Check if it's a WhatsApp message event
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry && body.entry[0];
      const change = entry && entry.changes && entry.changes[0];
      const value = change && change.value;
      
      // Process incoming messages
      if (value && value.messages && value.messages[0]) {
        const phone_number_id = value.metadata.phone_number_id;
        const msg = value.messages[0];
        const from = msg.from; // Customer's phone number
        const customerName = value.contacts && value.contacts[0] && value.contacts[0].profile && value.contacts[0].profile.name || 'Cliente';
        
        // Process text messages only to avoid loops and errors
        if (msg.type === 'text' && msg.text && msg.text.body) {
          const incomingText = msg.text.body.trim();
          console.log(`Received WhatsApp message from ${from} (${customerName}): ${incomingText}`);

          const apiKey = (process.env.GEMINI_API_KEY || '').trim();
          const waAccessToken = (process.env.WA_ACCESS_TOKEN || '').trim();

          if (!apiKey || !waAccessToken) {
            console.error("Missing GEMINI_API_KEY or WA_ACCESS_TOKEN environment variables.");
            return res.status(200).send('Credentials missing');
          }

          try {
            // System prompt context
            const systemContext = `Eres el asistente oficial de WhatsApp de "La Manito Del Vegano", tienda 100% plant-based en Santiago y Pucón. Eres muy persuasivo, amigable y usas muchos emojis.
Ofrecen productos veganos deliciosos como Empanadas de Pino Soya, Pie de Arándanos, Tartas, etc.
Tu objetivo es responder de forma breve, empática, y guiar al cliente a realizar su pedido o explorar el menú en la página web: https://lamanitodelvegano.vercel.app.
Responde de manera conversacional, cálida y concisa.
Nombre del cliente: ${customerName}`;

            // Call Gemini API
            const contents = [{
              role: "user",
              parts: [{ text: systemContext + "\n\nMensaje del cliente: " + incomingText }]
            }];

            const modelName = 'gemini-1.5-flash';
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

            const geminiRes = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: contents })
            });

            if (!geminiRes.ok) {
              throw new Error(`Gemini API error: ${geminiRes.status}`);
            }

            const geminiData = await geminiRes.json();
            const replyText = geminiData.candidates[0].content.parts[0].text.trim();

            // Send reply to WhatsApp Cloud API
            const waUrl = `https://graph.facebook.com/v20.0/${phone_number_id}/messages`;
            const waRes = await fetch(waUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${waAccessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: from,
                type: "text",
                text: { preview_url: true, body: replyText }
              })
            });

            if (!waRes.ok) {
              const errBody = await waRes.text();
              throw new Error(`WhatsApp API error: ${waRes.status} - ${errBody}`);
            }

            console.log(`Successfully sent WhatsApp reply to ${from}`);

          } catch (err) {
            console.error("Error processing message:", err);
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    } else {
      return res.status(404).send('Not Found');
    }
  }

  return res.status(405).send('Method Not Allowed');
}
