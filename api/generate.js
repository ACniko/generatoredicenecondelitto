import Groq from 'groq-sdk';

export const config = { maxDuration: 300 };

const phasePolicies = {
  canonical_plan: [32768], common_document: [8192], solution: [8192],
  evidence_batch: [4096, 4], character_batch: [16384, 2], field_repair: [8192, 4],
  story_verification: [8192], themes: [4096],
};
const prosePhases = new Set(['common_document', 'solution', 'evidence_batch', 'character_batch', 'field_repair']);

function requestMetadata(result, phase, status, startedAt) {
  const usage = result?.usage;
  const metadata = { phase, status, elapsedMs: Math.max(0, performance.now() - startedAt) };
  const values = {
    promptTokens: usage?.prompt_tokens, completionTokens: usage?.completion_tokens,
    totalTokens: usage?.total_tokens, cachedTokens: usage?.prompt_tokens_details?.cached_tokens,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
  };
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) metadata[key] = value;
  }
  const requestId = result?.x_groq?.id ?? result?._request_id ?? result?.request_id;
  if (typeof requestId === 'string') metadata.requestId = requestId;
  const finishReason = result?.choices?.[0]?.finish_reason;
  if (typeof finishReason === 'string') metadata.finishReason = finishReason;
  return metadata;
}

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
  const startedAt = performance.now();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }
  if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: 'Servizio AI non configurato.' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Richiesta JSON non valida.' }); }
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > 500000) return res.status(400).json({ error: 'Prompt mancante o troppo lungo.' });
  const allowedModels = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
  const explicitPhase = body.phase !== undefined;
  if (explicitPhase && (typeof body.phase !== 'string' || !Object.hasOwn(phasePolicies, body.phase))) {
    return res.status(400).json({ error: 'Fase di generazione non valida.' });
  }
  const phase = explicitPhase ? body.phase : 'legacy';
  const requiredModel = phase === 'themes' ? allowedModels[0] : allowedModels[1];
  if (explicitPhase && body.model !== undefined && body.model !== requiredModel) {
    return res.status(400).json({ error: 'Modello non valido per questa fase.' });
  }
  const model = explicitPhase ? requiredModel : allowedModels.includes(body.model) ? body.model : requiredModel;
  const policy = phasePolicies[phase];
  const reasoningEffort = model === allowedModels[0] ? 'low'
    : process.env.AI_PROSE_REASONING_EFFORT === 'low' && prosePhases.has(phase) ? 'low' : 'medium';
  const maxCompletionTokens = model === allowedModels[1] && process.env.AI_PHASE_BUDGETS === 'legacy'
    ? 65536 : policy?.[0] ?? (model === allowedModels[0] ? 4096 : 65536);
  if (policy?.[1] && body.batchSize !== undefined && (!Number.isInteger(body.batchSize) || body.batchSize < 1 || body.batchSize > policy[1])) {
    return res.status(400).json({ error: 'Dimensione del gruppo non valida per questa fase.' });
  }
  let result;
  const respond = (status, payload) => {
    const metadata = { ...requestMetadata(result, phase, status, startedAt), model, maxCompletionTokens, reasoningEffort };
    console.info('AI request', metadata);
    return res.status(status).json({ ...payload, metadata });
  };
  try {
    const GroqClient = dependencies.GroqClient ?? Groq;
    const client = new GroqClient({ apiKey: process.env.GROQ_API_KEY, timeout: 240_000, maxRetries: 0 });
    result = await client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: 'Rispondi esclusivamente con un oggetto JSON valido che soddisfi lo schema richiesto. Includi tutti i campi previsti e non aggiungere proprietà.' }, { role: 'user', content: prompt }],
      response_format: body.response_format?.type === 'json_schema' ? body.response_format : { type: 'json_object' },
      temperature: typeof body.temperature === 'number' ? Math.min(2, Math.max(0, body.temperature)) : 0.7,
      reasoning_effort: reasoningEffort,
      max_completion_tokens: maxCompletionTokens,
    });
    const content = result.choices[0]?.message?.content?.trim();
    if (!content || result.choices[0]?.finish_reason === 'length') return respond(502, { error: 'Risposta AI incompleta. Riprova.' });
    JSON.parse(content);
    return respond(200, { content });
  } catch (error) {
    result ??= error?.response?.data ?? error?.error ?? error;
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
    return respond(status, { error: message, ...(retryable ? { retryable: true } : {}) });
  }
}
