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

test('explicit phases enforce server caps and reasoning policy', async () => {
  const caps = { canonical_plan: 32768, common_document: 8192, solution: 8192, evidence_batch: 4096, character_batch: 16384, field_repair: 8192, story_verification: 8192, themes: 4096 };
  for (const [phase, cap] of Object.entries(caps)) {
    const { captured, response } = await callHandler({ prompt: 'Generate JSON', phase, max_completion_tokens: 999999, reasoning_effort: 'high' });
    assert.equal(captured.max_completion_tokens, cap);
    assert.equal(captured.model, phase === 'themes' ? 'openai/gpt-oss-20b' : 'openai/gpt-oss-120b');
    assert.equal(captured.reasoning_effort, phase === 'themes' ? 'low' : 'medium');
    assert.equal(response.body.metadata.phase, phase);
  }
});

test('unknown phases, model misuse and oversized batches are rejected before provider calls', async () => {
  for (const input of [
    { phase: 'unknown' }, { phase: '__proto__' }, { phase: 'themes', model: 'openai/gpt-oss-120b' },
    { phase: 'canonical_plan', model: 'openai/gpt-oss-20b' },
    { phase: 'evidence_batch', batchSize: 5 }, { phase: 'character_batch', batchSize: 3 },
    { phase: 'field_repair', batchSize: 5 },
  ]) {
    const { captured, response } = await callHandler({ prompt: 'Generate JSON', ...input });
    assert.equal(response.statusCode, 400);
    assert.equal(captured, undefined);
  }
});

test('metadata preserves partial usage and does not invent unknown token counts', async () => {
  const { response } = await callHandler({ prompt: 'JSON', phase: 'solution' }, async () => ({
    choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 23, completion_tokens_details: { reasoning_tokens: 7 }, prompt_tokens_details: { cached_tokens: 0 } },
    x_groq: { id: 'req-safe-id' },
  }));
  assert.equal(response.body.content, '{"ok":true}');
  assert.equal(response.body.metadata.promptTokens, 23);
  assert.equal(response.body.metadata.reasoningTokens, 7);
  assert.equal(response.body.metadata.cachedTokens, 0);
  assert.equal(response.body.metadata.requestId, 'req-safe-id');
  assert.equal(response.body.metadata.completionTokens, undefined);
  assert.equal(response.body.metadata.totalTokens, undefined);
  assert.ok(response.body.metadata.elapsedMs >= 0);
});

test('truncation and malformed JSON retain available usage metadata', async () => {
  for (const finishReason of ['length', 'stop']) {
    const { response } = await callHandler({ prompt: 'JSON', phase: 'canonical_plan' }, async () => ({
      choices: [{ message: { content: '{bad' }, finish_reason: finishReason }], usage: { completion_tokens: 42 },
    }));
    assert.equal(response.statusCode, 502);
    assert.equal(response.body.metadata.completionTokens, 42);
    assert.equal(response.body.metadata.finishReason, finishReason);
    assert.equal(response.body.metadata.status, 502);
  }
});

test('provider failures include safe metadata without diagnostics', async () => {
  const { response } = await callHandler({ prompt: 'JSON', phase: 'solution' }, async () => {
    throw Object.assign(new Error('private provider content'), { status: 502, usage: { total_tokens: 99 }, request_id: 'request-safe' });
  });
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.metadata.totalTokens, 99);
  assert.equal(response.body.metadata.requestId, 'request-safe');
  assert.doesNotMatch(JSON.stringify(response.body), /private provider content/);
});

test('verification endpoint applies its phase budget and rejects other phases', async () => {
  const { default: verify } = await import('../api/verify.js');
  const previousKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'gsk_test_key';
  let captured;
  let options;
  class FakeGroq {
    constructor(config) {
      options = config;
      this.chat = { completions: { create: async (request) => {
        captured = request;
        return { choices: [{ message: { content: '{}' }, finish_reason: 'stop' }] };
      } } };
    }
  }
  const response = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await verify({ method: 'POST', body: { prompt: 'Verify JSON' } }, response, { GroqClient: FakeGroq });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.metadata.phase, 'story_verification');
    assert.equal(captured.max_completion_tokens, 8192);
    assert.equal(options.maxRetries, 0);
    captured = undefined;
    await verify({ method: 'POST', body: { prompt: 'JSON', phase: 'themes' } }, response, { GroqClient: FakeGroq });
    assert.equal(response.statusCode, 400);
    assert.equal(captured, undefined);
  } finally {
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  }
});

test('server experiments opt prose into low reasoning and support budget rollback', async () => {
  const previousEffort = process.env.AI_PROSE_REASONING_EFFORT;
  const previousBudgets = process.env.AI_PHASE_BUDGETS;
  try {
    delete process.env.AI_PROSE_REASONING_EFFORT;
    delete process.env.AI_PHASE_BUDGETS;
    assert.equal((await callHandler({ prompt: 'JSON', phase: 'solution' })).captured.reasoning_effort, 'medium');
    process.env.AI_PROSE_REASONING_EFFORT = 'low';
    for (const phase of ['common_document', 'solution', 'evidence_batch', 'character_batch', 'field_repair']) {
      const { captured, response } = await callHandler({ prompt: 'JSON', phase });
      assert.equal(captured.reasoning_effort, 'low');
      assert.equal(response.body.metadata.reasoningEffort, 'low');
      assert.equal(response.body.metadata.model, 'openai/gpt-oss-120b');
      assert.equal(response.body.metadata.maxCompletionTokens, captured.max_completion_tokens);
    }
    for (const phase of ['canonical_plan', 'story_verification']) {
      assert.equal((await callHandler({ prompt: 'JSON', phase })).captured.reasoning_effort, 'medium');
    }
    process.env.AI_PROSE_REASONING_EFFORT = 'high';
    assert.equal((await callHandler({ prompt: 'JSON', phase: 'solution' })).captured.reasoning_effort, 'medium');
    process.env.AI_PHASE_BUDGETS = 'legacy';
    const rollback = await callHandler({ prompt: 'JSON', phase: 'evidence_batch' });
    assert.equal(rollback.captured.max_completion_tokens, 65536);
    assert.equal(rollback.response.body.metadata.phase, 'evidence_batch');
    assert.equal(rollback.captured.model, 'openai/gpt-oss-120b');
    assert.equal((await callHandler({ prompt: 'JSON', phase: 'themes' })).captured.max_completion_tokens, 4096);
    process.env.AI_PHASE_BUDGETS = 'invalid';
    assert.equal((await callHandler({ prompt: 'JSON', phase: 'evidence_batch' })).captured.max_completion_tokens, 4096);
  } finally {
    if (previousEffort === undefined) delete process.env.AI_PROSE_REASONING_EFFORT;
    else process.env.AI_PROSE_REASONING_EFFORT = previousEffort;
    if (previousBudgets === undefined) delete process.env.AI_PHASE_BUDGETS;
    else process.env.AI_PHASE_BUDGETS = previousBudgets;
  }
});

test('large final verification prompts fit the server ceiling and oversized prompts are rejected', async () => {
  const accepted = await callHandler({ phase: 'story_verification', prompt: 'a'.repeat(210000) });
  assert.equal(accepted.response.statusCode, 200);
  assert.equal(accepted.captured.messages[1].content.length, 210000);
  const rejected = await callHandler({ phase: 'story_verification', prompt: 'a'.repeat(500001) });
  assert.equal(rejected.response.statusCode, 400);
  assert.equal(rejected.captured, undefined);
});
