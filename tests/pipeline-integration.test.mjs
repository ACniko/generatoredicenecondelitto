import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { makeBible, makeCanonical, makeCharacter } from './generationFixtures.mjs';

const { outputFiles } = await build({ entryPoints: ['services/groqService.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
const { generateMurderMysteryStory } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const { outputFiles: storageFiles } = await build({ entryPoints: ['services/generationStorage.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
const { validateCheckpoint, loadGeneration } = await import(`data:text/javascript;base64,${Buffer.from(storageFiles[0].text).toString('base64')}`);

function provider(count, { pauseCharacters = false, rejectVerification = false } = {}) {
  const bible = makeBible(count), canonical = makeCanonical(count), calls = [];
  return { calls, async fetch(url, options) {
    const body = JSON.parse(options.body), phase = body.phase;
    const input = JSON.parse(body.prompt.split('\nINPUT:\n')[1]);
    calls.push({ phase, input, endpoint: url });
    if (pauseCharacters && phase === 'character_batch') return new Response(JSON.stringify({ error: 'Quota temporanea.', metadata: { phase, status: 429 } }), { status: 429, headers: { 'Retry-After': '288' } });
    let value;
    switch (phase) {
      case 'canonical_plan': value = canonical; break;
      case 'common_document': value = bible.commonDocument; break;
      case 'solution': value = bible.solution; break;
      case 'evidence_batch': value = { evidence: input.selected.map(selected => {
        const clue = bible.characterPlans.flatMap(c => c.cluePlan).find(clue => clue.id === selected.id);
        return { ...clue, recipients: [canonical.cast.find(c => c.id === selected.recipientId).name] };
      }) }; break;
      case 'character_batch': value = { characters: input.selected.map(selected => ({
        ...makeCharacter(selected.name, canonical.cast.map(c => c.name)), isCulprit: selected.id === canonical.culpritId,
      })) }; break;
      case 'story_verification': value = { approved: !rejectVerification, summary: 'Rapporto di controllo.', issues: rejectVerification ? ['Controllare la cronologia.'] : [], warnings: [] }; break;
      default: throw new Error(`Unexpected phase ${phase}`);
    }
    return new Response(JSON.stringify({ content: JSON.stringify(value), metadata: { phase, promptTokens: 100, completionTokens: 200, totalTokens: 300, cachedTokens: 50, model: 'openai/gpt-oss-120b' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } };
}

test('real runtime and pipeline complete 5, 8 and 12 guests and retain measured API usage', async () => {
  const original = globalThis.fetch;
  try {
    for (const count of [5, 8, 12]) {
      const mock = provider(count);
      globalThis.fetch = mock.fetch;
      let checkpoint;
      const story = await generateMurderMysteryStory(count, 'Villa Vittoriana', { onCheckpoint(value) { checkpoint = value; } });
      assert.equal(story.characters.length, count);
      assert.equal(story.evidence.length, count * 3);
      assert.equal(checkpoint.status, 'complete');
      assert.equal(validateCheckpoint(checkpoint), true, 'completed real pipeline output must be restorable');
      assert.equal(loadGeneration({ getItem: () => JSON.stringify(checkpoint) }).checkpoint.status, 'complete');
      assert.equal(checkpoint.metrics.length, mock.calls.length);
      assert.ok(checkpoint.metrics.every(metric => metric.totalTokens === 300));
      assert.ok(mock.calls.some(call => call.endpoint === '/api/verify'));
      const calls = mock.calls.length;
      await generateMurderMysteryStory(count, 'Villa Vittoriana', { checkpoint });
      assert.equal(mock.calls.length, calls, 'completed restore must make no requests');
    }
  } finally { globalThis.fetch = original; }
});

test('a quota pause resumes pending cards without regenerating saved canonical or prose stages', async () => {
  const original = globalThis.fetch;
  let checkpoint;
  try {
    const first = provider(5, { pauseCharacters: true });
    globalThis.fetch = first.fetch;
    await assert.rejects(() => generateMurderMysteryStory(5, 'Villa', { onCheckpoint(value) { checkpoint = value; } }), /progressi|salvat|pausa/i);
    assert.equal(checkpoint.status, 'paused');
    assert.ok(Object.values(checkpoint.stages).some(stage => stage.validated));
    checkpoint.retryAt = Date.now() - 1;
    const resumed = provider(5);
    globalThis.fetch = resumed.fetch;
    const story = await generateMurderMysteryStory(5, 'Villa', { checkpoint });
    assert.equal(story.characters.length, 5);
    assert.equal(resumed.calls.filter(call => call.phase === 'canonical_plan').length, 0);
    assert.equal(resumed.calls.filter(call => call.phase === 'common_document').length, 0);
    assert.equal(resumed.calls.filter(call => call.phase === 'solution').length, 0);
  } finally { globalThis.fetch = original; }
});

test('a rejected final narrative check keeps the complete story and checkpoint', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = provider(5, { rejectVerification: true }).fetch;
    let checkpoint;
    const story = await generateMurderMysteryStory(5, 'Villa', { onCheckpoint(value) { checkpoint = value; } });
    assert.equal(story.characters.length, 5);
    assert.ok(story.verificationWarning);
    assert.equal(checkpoint.status, 'complete');
    assert.ok(checkpoint.finalStory.verificationWarning);
  } finally { globalThis.fetch = original; }
});
