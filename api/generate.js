import Groq from 'groq-sdk';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }
  if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: 'Servizio AI non configurato.' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Richiesta JSON non valida.' }); }
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > 200000) return res.status(400).json({ error: 'Prompt mancante o troppo lungo.' });
  const allowedModels = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
  const model = allowedModels.includes(body.model) ? body.model : 'openai/gpt-oss-120b';
  try {
    const result = await new Groq({ apiKey: process.env.GROQ_API_KEY }).chat.completions.create({
      model,
      messages: [{ role: 'system', content: 'Rispondi solo con JSON valido. Per le storie scrivi testi concisi e completi: massimo 70 parole per campo, 30 per opinione. Includi tutti i personaggi richiesti e tutti i campi. Non ripetere le istruzioni.' }, { role: 'user', content: prompt }],
      response_format: body.response_format?.type === 'json_schema' ? body.response_format : { type: 'json_object' },
      temperature: typeof body.temperature === 'number' ? Math.min(2, Math.max(0, body.temperature)) : 0.7,
      reasoning_effort: 'low',
      max_completion_tokens: model === 'openai/gpt-oss-20b' ? 4096 : 65536,
    });
    const content = result.choices[0]?.message?.content?.trim();
    if (!content || result.choices[0]?.finish_reason === 'length') return res.status(502).json({ error: 'Risposta AI incompleta. Riprova.' });
    JSON.parse(content);
    return res.status(200).json({ content });
  } catch (error) {
    console.error('AI provider error', { status: error.status, name: error.name });
    const status = error.status === 429 ? 429 : 502;
    return res.status(status).json({ error: status === 429 ? 'Limite temporaneo del servizio AI. Attendi un minuto e riprova.' : 'Il servizio AI non ha completato la richiesta. Riprova.' });
  }
}
