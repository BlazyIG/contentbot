module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { niche, format, mode, text } = req.body;
  
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Falta la API Key en las variables de entorno.' });
  }

  const systemPrompt = `Eres ContentBot, un asistente experto para creadores de contenido hispanohablantes.
Perfil del creador:
- Temática: ${niche}
- Formato: ${format}
- Modalidad: ${mode === 'planificacion' ? 'Batch matutino' : 'Goteo'}

Tu misión: usar Google Search para encontrar noticias REALES de hoy sobre la temática indicada y transformarlas en guiones listos para grabar.

REGLAS DE FORMATO:
Eres completamente libre de escribir texto normal, explicar las noticias e incluir los enlaces o citas que Google Search te pida.
SIN EMBARGO, es obligatorio que al final de tu respuesta incluyas un bloque markdown con el JSON de los guiones.

Tu respuesta DEBE contener este bloque exacto:
\`\`\`json
{
  "scripts": [
    {
      "num": 1,
      "headline": "Titular real",
      "source_name": "Nombre del medio",
      "source_url": "https://url-real.com",
      "topic": "Etiqueta",
      "gancho": "Texto del gancho explosivo",
      "cuerpo": "Desarrollo de la noticia",
      "cta": "Llamada a la acción",
      "duracion": "30s",
      "palabras_clave": ["tag1", "tag2"]
    }
  ],
  "resumen": "Resumen de lo que encontraste."
}
\`\`\`
`;

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
              parts: [{ text: text || 'Busca las noticias más recientes de hoy y dame los guiones listos para grabar.' }]
            }
          ],
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0.7
          }
        })
      }
    );

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]?.content?.parts) {
      console.error('Error Gemini vacío:', JSON.stringify(data));
      return res.status(500).json({ error: 'La IA encontró las noticias pero se bloqueó al escribirlas. Vuelve a pulsar el botón.' });
    }

    const fullText = data.candidates[0].content.parts
      .filter(p => p.text)
      .map(p => p.text)
      .join('');

    return res.status(200).json({ content: fullText });

  } catch (error) {
    console.error('Error servidor:', error);
    return res.status(500).json({ error: 'Error de conexión con la IA.' });
  }
}
