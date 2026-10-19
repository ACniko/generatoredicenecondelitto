// Explicit live runner. Reports include failed request costs; story text stays in
// ignored local checkpoints, never in the report or application logs.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const args = process.argv.slice(2);
const option = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
if (!args.includes('--live')) {
  console.log('Use --live --base=https://your-deployment --counts=5,8,12. Optional: --baseline-ref=69ab9d1 --label=baseline --resume. Live calls consume provider quota.');
  process.exit(0);
}
const base = option('base', 'https://generatoredicenecondelitto.vercel.app');
const counts = option('counts', '5,8,12').split(',').map(Number);
if (counts.some((count) => !Number.isInteger(count) || count < 4 || count > 12)) throw new Error('Invalid player count.');
const baseline = option('baseline-ref', '');
const label = option('label', baseline ? 'baseline' : 'optimized');
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Invalid report label.');
const directory = resolve('output/benchmarks');
mkdirSync(directory, { recursive: true });
const source = baseline ? execFileSync('git', ['show', `${baseline}:services/groqService.ts`], { encoding: 'utf8' }) : readFileSync('services/groqService.ts', 'utf8');
const { outputFiles } = await build({ stdin: { contents: source, resolveDir: resolve('services'), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'browser' });
const { generateMurderMysteryStory } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const { outputFiles: auditFiles } = await build({ entryPoints: ['services/storyQuality.ts'], bundle: true, write: false, format: 'esm' });
const { auditStoryQuality } = await import(`data:text/javascript;base64,${Buffer.from(auditFiles[0].text).toString('base64')}`);
const nativeFetch = globalThis.fetch;
const report = { label, baselineRef: baseline || null, createdAt: new Date().toISOString(), cases: [] };
const themes = ['Mistero a Villa Vittoriana', 'Notte al museo', 'Delitto sul treno'];
for (const [index, playerCount] of counts.entries()) {
  const requests = [];
  const checkpointPath = resolve(directory, `${label}-${playerCount}-checkpoint.json`);
  const storyPath = resolve(directory, `${label}-${playerCount}-story.json`);
  let checkpoint = args.includes('--resume') && existsSync(checkpointPath) ? JSON.parse(readFileSync(checkpointPath, 'utf8')) : undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15 * 60_000);
  const started = performance.now();
  globalThis.fetch = async (url, init) => {
    if (requests.length >= 80) throw new Error('Benchmark request safety limit reached.');
    const body = JSON.parse(init.body);
    const record = { phase: body.phase ?? body.response_format?.json_schema?.name ?? 'legacy', elapsedMs: 0 };
    requests.push(record);
    const callStart = performance.now();
    try {
      const response = await nativeFetch(new URL(url, base), { ...init, signal: init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal });
      record.status = response.status;
      const payload = await response.clone().json().catch(() => ({}));
      record.metadata = payload.metadata;
      record.retryAfter = response.headers.get('Retry-After') ?? undefined;
      return response;
    } finally { record.elapsedMs = Math.round(performance.now() - callStart); }
  };
  const result = { playerCount, theme: themes[index % themes.length], requests, success: false };
  try {
    const story = await generateMurderMysteryStory(playerCount, result.theme, {
      checkpoint, signal: controller.signal,
      onCheckpoint(value) { checkpoint = value; writeFileSync(checkpointPath, JSON.stringify(value)); },
      onProgress(value) { console.log(`${playerCount}: ${value.stage}, ${value.completedCharacters}/${value.totalCharacters}, ${value.status}`); },
    });
    const audit = auditStoryQuality(story, playerCount);
    result.success = audit.valid;
    result.auditErrors = audit.errors;
    result.verificationWarning = Boolean(story.verificationWarning);
    result.wordCount = JSON.stringify(story).match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length;
    writeFileSync(storyPath, JSON.stringify(story));
  } catch (error) { result.error = error instanceof Error ? error.message : 'Unknown error'; }
  finally { clearTimeout(timeout); globalThis.fetch = nativeFetch; }
  result.elapsedMs = Math.round(performance.now() - started);
  for (const key of ['promptTokens', 'completionTokens', 'totalTokens', 'cachedTokens', 'reasoningTokens']) {
    const known = requests.map((request) => request.metadata?.[key]).filter((value) => typeof value === 'number');
    result[key] = known.length ? known.reduce((sum, value) => sum + value, 0) : null;
    result[`${key}KnownRequests`] = known.length;
  }
  report.cases.push(result);
  writeFileSync(resolve(directory, `${label}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ playerCount, success: result.success, elapsedMs: result.elapsedMs, calls: requests.length, totalTokens: result.totalTokens, error: result.error }));
  // Avoid sending the next expensive case into an already exhausted quota.
  if (requests.some((request) => request.status === 429 && Number(request.retryAfter) > 120)) break;
}
