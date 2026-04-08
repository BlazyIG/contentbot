export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { niche, format, mode, text } = req.body;
  
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Falta la API Key en las variables de entorno del servidor.' });
  }

  const systemPrompt = `Eres ContentBot, un asistente experto para creadores de contenido hispanohablantes.
Perfil del creador:
- Temática: ${niche}
- Formato: ${format}
- Modalidad: ${mode === 'planificacion' ? 'Batch matutino — genera 5 guiones' : 'Goteo — genera 1-2 guiones de última hora'}

Tu misión: usar Google Search para encontrar noticias REALES, VERIFICABLES Y DE HOY sobre la temática indicada. Luego transforma cada noticia en un guion estructurado y listo para grabar.

REGLAS ESTRICTAS:
1. Usa SIEMPRE Google Search para encontrar noticias de hoy o de los últimos 3 días.
2. Los source_url deben ser URLs reales y verificables.
3. El gancho debe funcionar como los primeros 3 segundos de un vídeo: explosivo, que genere curiosidad inmediata o sorpresa.
4. El cuerpo debe estar adaptado al formato indicado.
5. RESPONDE ÚNICA Y EXCLUSIVAMENTE CON JSON VÁLIDO. Cero texto fuera del JSON.

Estructura JSON obligatoria:
{
  "scripts": [
    {
      "num": 1,
      "headline": "Titular",
      "source_name": "Nombre del medio",
      "source_url": "https://url-real.com",
      "topic": "Etiqueta",
      "gancho": "Texto gancho",
      "cuerpo": "Desarrollo",
      "cta": "Llamada a la acción",
      "duracion": "30s",
      "palabras_clave": ["tag1", "tag2"]
    }
  ],
  "resumen": "Frase breve resumiendo."
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
              parts: [{ text: text || 'Busca las noticias más recientes de hoy y dame los guiones listos para grabar.' }]
            }
          ],
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096
          }
        })
      }
    );

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]?.content?.parts) {
      console.error('Error Gemini:', JSON.stringify(data));
      return res.status(500).json({ error: 'Gemini no devolvió contenido.' });
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
