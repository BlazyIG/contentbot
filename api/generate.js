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

  const prompt = `Eres ContentBot, un asistente experto para creadores de contenido.
Temática: ${niche}
Formato: ${format}

Genera 5 guiones basados en las tendencias, noticias y novedades más recientes sobre esta temática.

Estructura JSON obligatoria:
{
  "scripts": [
    {
      "num": 1,
      "headline": "Titular de la novedad",
      "source_name": "Nombre de un medio de referencia",
      "source_url": "https://url-de-ejemplo.com",
      "topic": "Etiqueta",
      "gancho": "Texto del gancho explosivo",
      "cuerpo": "Desarrollo del contenido",
      "cta": "Llamada a la acción",
      "duracion": "30s",
      "palabras_clave": ["tag1", "tag2"]
    }
  ],
  "resumen": "Frase breve resumiendo las tendencias."
}

Petición del usuario: ${text || 'Dame los guiones listos.'}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]?.content?.parts) {
      console.error('Error Gemini vacío:', JSON.stringify(data));
      return res.status(500).json({ error: 'La IA se bloqueó. Inténtalo de nuevo.' });
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
