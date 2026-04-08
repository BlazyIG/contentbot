module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { niche, format, mode, text } = req.body;
  
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Falta la API Key en las variables.' });
  }

  const systemPrompt = `Eres ContentBot, un asistente experto para creadores de contenido hispanohablantes.
Perfil:
- Temática: ${niche}
- Formato: ${format}

Misión: Buscar noticias REALES Y DE HOY sobre la temática. Crea un guion estructurado para cada noticia.

REGLAS:
1. Usa la búsqueda de Google para encontrar noticias de hoy o los últimos 3 días.
2. Devuelve la respuesta conteniendo UN bloque JSON válido delimitado por \`\`\`json y \`\`\`.
3. Puedes añadir texto adicional o citas de la búsqueda si el sistema lo requiere, pero el bloque JSON debe estar completo.

Estructura JSON obligatoria:
{
  "scripts": [
    {
      "num": 1,
      "headline": "Titular de la noticia",
      "source_name": "Nombre del medio",
      "source_url": "https://url-real.com",
      "topic": "Etiqueta",
      "gancho": "Texto gancho para atrapar",
      "cuerpo": "Desarrollo completo",
      "cta": "Llamada a la acción",
      "duracion": "30s",
      "palabras_clave": ["tag1", "tag2"]
    }
  ],
  "resumen": "Frase breve resumiendo lo que has encontrado."
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: 'user',
              parts: [{ text: text || 'Busca noticias de hoy y dame los guiones listos.' }]
            }
          ],
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.7
          }
        })
      }
    );

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]?.content?.parts) {
      console.error('Error Gemini:', JSON.stringify(data));
      return res.status(500).json({ error: 'Gemini buscó la información pero se bloqueó al redactarla. Inténtalo de nuevo.' });
    }

    const fullText = data.candidates[0].content.parts
      .filter(p => p.text)
      .map(p => p.text)
      .join('');

    return res.status(200).json({ content: fullText });

  } catch (error) {
    console.error('Error servidor:', error);
    return res.status(500).json({ error: 'Error de conexión.' });
  }
}
