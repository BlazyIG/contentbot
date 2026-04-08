export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { niche, format, mode, text } = req.body;
  
  // 🚨 SEGURIDAD APLICADA: La clave ahora solo se lee desde las variables de entorno.
  // Asegúrate de ir a la configuración de Vercel (o tu hosting) y añadir la variable GEMINI_API_KEY.
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
2. Los source_url deben ser URLs reales y verificables
3. El gancho debe funcionar como los primeros 3 segundos de un vídeo: explosivo, que genere curiosidad inmediata o sorpresa.
4. El cuerpo debe estar adaptado al formato indicado (si son Reels, conciso; si es YouTube, más desarrollado).
5. RESPONDE ÚNICA Y EXCLUSIVAMENTE CON JSON VÁLIDO. Cero texto fuera del JSON. Sin backticks. Sin markdown.

Estructura JSON obligatoria:
{
  "scripts": [
    {
      "num": 1,
      "headline": "Titular real y atractivo de la noticia",
      "source_name": "Nombre del medio (ej: TechCrunch, El País, Xataka)",
      "source_url": "https://url-real-del-articulo.com",
      "topic": "Etiqueta corta (ej: IA, Crypto, Apple)",
      "gancho": "Texto exacto del gancho para los primeros 3 segundos. Pregunta o afirmación explosiva que enganche al instante.",
      "cuerpo": "Desarrollo completo: contexto, por qué importa ahora, datos clave, comparativa o ejemplo. Redactado para el formato ${format}.",
      "cta": "Llamada a la acción: qué debe hacer el espectador (guardar, comentar, seguir, compartir).",
      "duracion": "30s",
      "palabras_clave": ["tag1", "tag2", "tag3"]
    }
  ],
  "resumen": "Frase breve resumiendo el lote: qué noticias has encontrado y por qué son relevantes ahora."
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
            maxOutputTokens: 4096,
            responseMimeType: "application/json" // ✅ ESTABILIDAD APLICADA: Obliga a que la respuesta sea JSON puro siempre.
          }
        })
      }
    );

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]?.content?.parts) {
      console.error('Error Gemini:', JSON.stringify(data));
      return res.status(500).json({ error: 'Gemini no devolvió contenido. Inténtalo de nuevo.' });
    }

    const fullText = data.candidates[0].content.parts
      .filter(p => p.text)
      .map(p => p.text)
      .join('');

    return res.status(200).json({ content: fullText });

  } catch (error) {
    console.error('Error servidor:', error);
    return res.status(500).json({ error: 'Error de conexión con Gemini.' });
  }
}
