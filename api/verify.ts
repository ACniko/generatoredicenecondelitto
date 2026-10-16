import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

const MAX_PROMPT_LENGTH = 60_000;
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Servizio AI non configurato: manca GROQ_API_KEY.' });

  let body: any;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Corpo JSON non valido.' });
  }
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) return res.status(400).json({ error: 'Richiesta non valida.' });

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: typeof body.model === 'string' ? body.model : DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: body.response_format?.type === 'json_object' ? { type: 'json_object' } : undefined,
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.1,
    });
    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) return res.status(502).json({ error: 'Il modello AI ha restituito una risposta vuota.' });
    try { JSON.parse(content); } catch { return res.status(502).json({ error: 'Il modello AI ha restituito JSON non valido.' }); }
    return res.status(200).json({ content });
  } catch (error) {
    console.error('Groq verification failed:', error);
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Errore del provider AI.' });
  }
}
