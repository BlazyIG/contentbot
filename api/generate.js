export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { niche, format, mode, text } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Falta la API Key en Vercel' });
  }

  const systemPrompt = `Eres ContentBot, un asistente experto para creadores de contenido.
Temática: ${niche}
Formato: ${format}

Busca en internet noticias REALES Y DE HOY sobre esta temática usando Google Search y conviértelas en guiones estructurados.

DEBES RESPONDER ÚNICA Y EXCLUSIVAMENTE CON UN JSON VÁLIDO. Ningún otro texto fuera del JSON. Usa esta estructura exacta:
{
  "scripts": [
    {
      "num": 1,
      "headline": "Titular real de la noticia",
      "source_name": "Nombre del medio o web",
      "source_url": "URL real de la noticia",
      "topic": "Tema",
      "gancho": "Texto explosivo para los primeros 3 segundos",
      "cuerpo": "Desarrollo completo de la noticia adaptado al formato",
      "cta": "Llamada a la acción",
      "duracion": "30s",
      "palabras_clave": ["tag1", "tag2"]
    }
  ],
  "resumen": "He encontrado estas noticias recientes..."
}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          { role: 'user', parts: [{ text: text || "Busca las noticias más recientes y dame los guiones" }] }
        ],
        tools: [{ google_search: {} }]
      })
    });

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0].content) {
        console.error("Error de Gemini:", data);
        return res.status(500).json({ error: 'Error procesando la noticia con Gemini' });
    }

    const fullText = data.candidates[0].content.parts[0].text;
    res.status(200).json({ content: fullText });

  } catch (error) {
    console.error("Error de servidor:", error);
    res.status(500).json({ error: 'Error de conexión con el servidor.' });
  }
}