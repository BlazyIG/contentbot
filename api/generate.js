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

  const prompt = `Actúa como ContentBot, un asistente experto para creadores de contenido.
Temática: ${niche}
Formato: ${format}
Modalidad: ${mode === 'planificacion' ? 'Batch matutino' : 'Goteo'}

Busca en Google las noticias de HOY sobre esta temática y conviértelas en guiones.

INSTRUCCIÓN VITAL PARA EVITAR ERRORES:
1. PRIMERO, escribe un pequeño párrafo normal resumiendo lo que has encontrado. Aquí eres libre de poner todos los enlaces y citas que la búsqueda de Google te obligue a incluir.
2. DESPUÉS de ese párrafo introductorio, escribe un bloque de código markdown con el JSON de los guiones.

Estructura del JSON obligatoria:
\`\`\`json
{
  "scripts": [
    {
      "num": 1,
      "headline": "Titular real",
      "source_name": "Nombre del medio",
      "source_url": "https://url-real.com",
      "topic": "Etiqueta",
      "gancho": "Texto del gancho",
      "cuerpo": "Desarrollo de la noticia",
      "cta": "Llamada a la acción",
      "duracion": "30s",
      "palabras_clave": ["tag1", "tag2"]
    }
  ],
  "resumen": "Resumen breve."
}
\`\`\`

Petición del usuario: ${text || 'Busca las noticias de hoy y dame los guiones.'}`;

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
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.7
          }
        })
      }
    );

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]?.content?.parts) {
      console.error('Error Gemini vacío:', JSON.stringify(data));
      return res.status(500).json({ error: 'La IA se bloqueó al formatear los enlaces. Inténtalo de nuevo.' });
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
