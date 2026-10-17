import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/generate.js';

const callHandler = async (input, completion = async () => ({
  choices: [{ message: { content: JSON.stringify({ ok: true }) }, finish_reason: 'stop' }]
})) => {
  const previousKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'gsk_test_key';
  let captured;
  class FakeGroq {
    constructor() {
      this.chat = { completions: { create: async (request) => {
        captured = request;
        return completion(request);
      } } };
    }
  }
  const response = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
  try {
    await handler({ method: 'POST', body: input }, response, { GroqClient: FakeGroq });
    return { captured, response };
  } finally {
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  }
};

test('story requests are not restricted to miniature text fields', async () => {
  const { captured } = await callHandler({
    model: 'openai/gpt-oss-120b',
    prompt: 'Fase: personaggi. Genera schede estese per una partita di 2-3 ore.',
    response_format: { type: 'json_object' }
  });
  const systemPrompt = captured.messages.find((message) => message.role === 'system').content;
  assert.doesNotMatch(systemPrompt, /35 parole|15 parole|maximo?\s+(35|15)/i);
  assert.match(systemPrompt, /JSON/i);
});

test('story and verification calls reserve the long output budget for GPT-OSS 120B', async () => {
  const { captured } = await callHandler({
    model: 'openai/gpt-oss-120b',
    prompt: 'Fase: verifica. Controlla la coerenza della storia.'
  });
  assert.equal(captured.model, 'openai/gpt-oss-120b');
  assert.ok(captured.max_completion_tokens >= 32768);
});

test('theme requests retain the fast GPT-OSS 20B output budget', async () => {
  const { captured } = await callHandler({
    model: 'openai/gpt-oss-20b',
    prompt: 'Proponi sei temi per una cena con delitto in JSON.'
  });
  assert.equal(captured.model, 'openai/gpt-oss-20b');
  assert.ok(captured.max_completion_tokens <= 8192);
});

test('rate limit responses expose Groq retry timing to the client', async () => {
  const { response } = await callHandler({
    model: 'openai/gpt-oss-120b',
    prompt: 'Fase: schede. Genera una scheda.'
  }, async () => {
    const error = Object.assign(new Error('rate limited'), {
      status: 429,
      headers: new Headers({ 'retry-after': '12' })
    });
    throw error;
  });
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers['Retry-After'], '12');
  assert.match(response.body.error, /12/);
});

test('Groq TPM limits returned as HTTP 413 are retried as rate limits', async () => {
  const { response } = await callHandler({
    model: 'openai/gpt-oss-120b',
    prompt: 'Fase: canovaccio. Il numero di giocatori è: 4.'
  }, async () => {
    throw Object.assign(new Error('413 {"error":{"type":"tokens","code":"rate_limit_exceeded","message":"tokens per minute (TPM): Limit 8000, Requested 8502"}}'), {
      status: 413
    });
  });
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers['Retry-After'], '15');
  assert.match(response.body.error, /Limite temporaneo/);
});

test('daily token quota waits embedded in Groq errors become accurate Retry-After responses', async () => {
  const { response } = await callHandler({
    model: 'openai/gpt-oss-120b',
    prompt: 'Fase: canovaccio. Il numero di giocatori è: 4.'
  }, async () => {
    throw Object.assign(new Error('429 {"error":{"message":"tokens per day (TPD): Limit 200000, Used 199226, Requested 1439. Please try again in 4m47.28s."}}'), {
      status: 429,
      headers: new Headers({ 'retry-after': '60' })
    });
  });
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers['Retry-After'], '288');
  assert.match(response.body.error, /4 minuti e 48 secondi/);
});

test('structured-output validation failures are marked for a client retry', async () => {
  const { response } = await callHandler({
    model: 'openai/gpt-oss-120b',
    prompt: 'Fase: canovaccio. Il numero di giocatori è: 4.'
  }, async () => {
    throw Object.assign(new Error('400 {"error":{"code":"json_validate_failed","message":"Failed to generate JSON."}}'), {
      status: 400
    });
  });
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.retryable, true);
  assert.match(response.body.error, /risposta strutturata valida/);
});
