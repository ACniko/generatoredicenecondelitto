import { PIPELINE_VERSION } from './generationTypes.ts';
import type { GenerationCheckpoint, GenerationOptions, GenerationRuntime, GenerationPhase, RequestMetric } from './generationTypes';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export class GenerationPausedError extends Error {
  readonly retryAt: number;
  constructor(retryAt: number) { super('Limite temporaneo del servizio AI. I progressi sono salvati: riprendi dopo il conto alla rovescia.'); this.name = 'GenerationPausedError'; this.retryAt = retryAt; }
}
export function createGenerationRuntime(playerCount: number, theme: string, options: GenerationOptions = {}): GenerationRuntime {
  const cp: GenerationCheckpoint = options.checkpoint ? clone(options.checkpoint) : { version: 1, pipelineVersion: PIPELINE_VERSION, id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, createdAt: Date.now(), updatedAt: Date.now(), input: { playerCount, theme }, status: 'running', stages: {}, concurrency: 2, metrics: [] };
  if (cp.input.playerCount !== playerCount || cp.input.theme !== theme || cp.pipelineVersion !== PIPELINE_VERSION) throw new Error('Salvataggio incompatibile con la richiesta.');
  let active = 0;
  let completedCharacters = 0;
  let currentStage = 'canonical_plan';
  let currentMessage = 'Preparazione della storia...';
  const listeners = new Set<() => void>();
  const wake = () => { for (const listener of [...listeners]) listener(); };
  const persist = () => { cp.updatedAt = Date.now(); options.onCheckpoint?.(clone(cp)); };
  const assertActive = () => { if (options.signal?.aborted) throw options.signal.reason ?? new DOMException('Operazione annullata', 'AbortError'); };
  const wait = (ms: number) => new Promise<void>((resolve, reject) => {
    assertActive();
    const finish = () => { clearTimeout(timer); listeners.delete(finish); options.signal?.removeEventListener('abort', abort); resolve(); };
    const abort = () => { clearTimeout(timer); listeners.delete(finish); options.signal?.removeEventListener('abort', abort); reject(options.signal?.reason ?? new DOMException('Operazione annullata', 'AbortError')); };
    const timer = setTimeout(finish, ms); listeners.add(finish); options.signal?.addEventListener('abort', abort, { once: true });
  });
  const progress = (stage: string, message: string, completed = completedCharacters) => { completedCharacters = completed; if (stage !== 'waiting') { currentStage = stage; currentMessage = message; } persist(); options.onProgress?.({ stage, message, completedCharacters, totalCharacters: playerCount, status: cp.status, retryAt: cp.retryAt }); };
  const acquire = async () => {
    for (;;) {
      assertActive();
      if (cp.status === 'paused') { if (cp.retryAt) throw new GenerationPausedError(cp.retryAt); throw new Error('Generazione in pausa. Riprendi dai progressi salvati.'); }
      const delay = (cp.retryAt ?? 0) - Date.now();
      if (delay > 120000) throw new GenerationPausedError(cp.retryAt!);
      if (delay > 0) { cp.status = 'waiting'; progress('waiting', 'Attesa del limite temporaneo del servizio AI.'); await wait(delay); continue; }
      if (active < cp.concurrency) { const wasWaiting = cp.status === 'waiting'; active++; cp.status = 'running'; delete cp.retryAt; if (wasWaiting) progress(currentStage, currentMessage); else persist(); return; }
      await wait(60000);
    }
  };
  const requestJson = async <T>(prompt: string, phase: GenerationPhase, schema: Record<string, any>, temperature = 0.5, endpoint = '/api/generate'): Promise<T> => {
    const strictSchema = clone(schema);
    const strict = (node: any) => { if (!node || typeof node !== 'object') return; if (node.type === 'object') node.additionalProperties = false; Object.values(node).forEach(value => { if (Array.isArray(value)) value.forEach(strict); else if (value && typeof value === 'object') strict(value); }); };
    strict(strictSchema);
    for (let attempt = 0; attempt < 3; attempt++) {
      await acquire();
      const started = Date.now(); const metric: RequestMetric = { phase, elapsedMs: 0, status: 0 };
      try {
        const response = await fetch(endpoint, { method: 'POST', signal: options.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, phase, model: 'openai/gpt-oss-120b', temperature, response_format: { type: 'json_schema', json_schema: { name: phase, strict: true, schema: strictSchema } } }) });
        metric.status = response.status;
        let result: any;
        try { result = await response.json(); } catch { if (response.status !== 502) throw new Error('Risposta del servizio AI non leggibile.'); result = {}; }
        const metadata = result.metadata ?? {};
        const usage = metadata.usage ?? result.usage ?? {};
        const tokens = { promptTokens: metadata.promptTokens ?? usage.prompt_tokens, completionTokens: metadata.completionTokens ?? usage.completion_tokens, totalTokens: metadata.totalTokens ?? usage.total_tokens, cachedTokens: metadata.cachedTokens ?? usage.prompt_tokens_details?.cached_tokens, reasoningTokens: metadata.reasoningTokens ?? usage.completion_tokens_details?.reasoning_tokens };
        for (const [key, value] of Object.entries(tokens)) if (typeof value === 'number') (metric as any)[key] = value;
        for (const key of ['model', 'maxCompletionTokens', 'reasoningEffort']) if (typeof metadata[key] === 'string' || typeof metadata[key] === 'number') (metric as any)[key] = metadata[key];
        if (typeof metadata.elapsedMs === 'number') (metric as any).serverElapsedMs = metadata.elapsedMs;
        if (typeof metadata.requestId === 'string') metric.requestId = metadata.requestId;
        if (typeof metadata.finishReason === 'string') metric.finishReason = metadata.finishReason;
        if (response.status === 429) {
          const header = response.headers.get('Retry-After'); const seconds = header ? Number(header) : Number(result.retryAfterSeconds ?? 15);
          const target = header && !Number.isFinite(seconds) ? Date.parse(header) : Date.now() + (Number.isFinite(seconds) ? Math.max(1, seconds) : 15) * 1000;
          cp.retryAt = Math.max(cp.retryAt ?? 0, Number.isFinite(target) ? target : Date.now() + 15000); cp.concurrency = 1;
          cp.status = cp.retryAt - Date.now() > 120000 || attempt === 2 ? 'paused' : 'waiting'; progress(phase, 'Limite temporaneo: i progressi sono salvati.'); wake();
          if (cp.status === 'paused') throw new GenerationPausedError(cp.retryAt);
          continue;
        }
        if (response.status === 502 && attempt < 2) { await wait(1000 * (attempt + 1)); continue; }
        if (!response.ok || result.error) throw new Error(result.error || `Errore del servizio AI (HTTP ${response.status}).`);
        if (typeof result.content !== 'string') throw new Error('Contenuto del servizio AI mancante.');
        return JSON.parse(result.content) as T;
      } finally { metric.elapsedMs = Date.now() - started; cp.metrics.push(metric); active--; persist(); wake(); }
    }
    throw new Error('Servizio AI temporaneamente non disponibile.');
  };
  const runtime: GenerationRuntime = {
    get checkpoint() { return clone(cp); },
    getStage: <T>(key: string) => cp.stages[key] ? clone(cp.stages[key]) as any : undefined,
    saveStage(key, value, validated) { cp.stages[key] = { value: clone(value), validated }; persist(); },
    invalidateStages(keys) { keys.forEach(key => delete cp.stages[key]); persist(); },
    requestJson, progress, assertActive,
    pause(error) { cp.status = 'paused'; if (error instanceof GenerationPausedError) cp.retryAt = error.retryAt; persist(); wake(); },
    complete(story) { cp.status = 'complete'; delete cp.retryAt; cp.finalStory = clone(story); persist(); return story; },
  };
  if (cp.status !== 'complete') cp.status = 'running';
  persist(); return runtime;
}
