import Groq from 'groq-sdk';

export const config = { maxDuration: 300 };

function isTokenRateLimitError(error) {
  if (error?.status === 429 || error?.code === 'rate_limit_exceeded') return true;
  const message = String(error?.message ?? '');
  return /rate_limit_exceeded|tokens per minute\s*\(TPM\)/i.test(message);
}

function isStructuredOutputFailure(error) {
  const message = String(error?.message ?? '');
  return /json_validate_failed|failed to generate JSON/i.test(message);
}

function getRetryAfterSeconds(error) {
  const message = String(error?.message ?? '');
  const waitMatch = message.match(/try again in\s+(?:(\d+(?:\.\d+)?)\s*m)?\s*(\d+(?:\.\d+)?)\s*s/i);
  if (waitMatch) return Math.min(86400, Math.max(1, Math.ceil(Number(waitMatch[1] ?? 0) * 60 + Number(waitMatch[2]))));

  const headers = error?.headers;
  const retryAfter = headers?.get?.('retry-after') ?? headers?.['retry-after'];
  if (retryAfter) {
    const seconds = Number.parseFloat(String(retryAfter));
    if (Number.isFinite(seconds)) return Math.min(86400, Math.max(1, Math.ceil(seconds)));
    const dateSeconds = Math.ceil((Date.parse(String(retryAfter)) - Date.now()) / 1000);
    if (Number.isFinite(dateSeconds)) return Math.min(86400, Math.max(1, dateSeconds));
  }
  const retryAfterMs = headers?.get?.('retry-after-ms') ?? headers?.['retry-after-ms'];
  if (retryAfterMs && Number.isFinite(Number(retryAfterMs))) {
    return Math.min(86400, Math.max(1, Math.ceil(Number(retryAfterMs) / 1000)));
  }
  return 15;
}

export default async function handler(req, res, dependencies = {}) {
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
    const GroqClient = dependencies.GroqClient ?? Groq;
    const client = new GroqClient({ apiKey: process.env.GROQ_API_KEY, timeout: 240_000, maxRetries: 1 });
    const result = await client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: 'Rispondi esclusivamente con un oggetto JSON valido che soddisfi lo schema richiesto. Includi tutti i campi previsti e non aggiungere proprietà.' }, { role: 'user', content: prompt }],
      response_format: body.response_format?.type === 'json_schema' ? body.response_format : { type: 'json_object' },
      temperature: typeof body.temperature === 'number' ? Math.min(2, Math.max(0, body.temperature)) : 0.7,
      reasoning_effort: model === 'openai/gpt-oss-120b' ? 'medium' : 'low',
      max_completion_tokens: model === 'openai/gpt-oss-20b' ? 4096 : 65536,
    });
    const content = result.choices[0]?.message?.content?.trim();
    if (!content || result.choices[0]?.finish_reason === 'length') return res.status(502).json({ error: 'Risposta AI incompleta. Riprova.' });
    JSON.parse(content);
    return res.status(200).json({ content });
  } catch (error) {
    console.error('AI provider error', { status: error.status, name: error.name, code: error.code });
    const rateLimited = isTokenRateLimitError(error);
    const status = rateLimited ? 429 : 502;
    const retryable = !rateLimited && isStructuredOutputFailure(error);
    const retryAfterSeconds = status === 429 ? getRetryAfterSeconds(error) : undefined;
    if (retryAfterSeconds) res.setHeader('Retry-After', String(retryAfterSeconds));
    const waitText = retryAfterSeconds >= 60
      ? `${Math.floor(retryAfterSeconds / 60)} minuti e ${retryAfterSeconds % 60} secondi`
      : `${retryAfterSeconds} secondi`;
    const message = status === 429
      ? `Limite temporaneo del servizio AI. Attendi circa ${waitText} e riprova.`
      : retryable ? 'Il modello non ha completato una risposta strutturata valida.'
      : error.status === 413 ? 'La richiesta AI è troppo lunga. Riprova con meno partecipanti o un tema più semplice.'
      : 'Il servizio AI non ha completato la richiesta. Riprova.';
    const diagnostic = process.env.NODE_ENV === 'production' ? undefined : String(error.message ?? '').slice(0, 500);
    return res.status(status).json({ error: message, ...(retryable ? { retryable: true } : {}), ...(diagnostic ? { diagnostic } : {}) });
  }
}
