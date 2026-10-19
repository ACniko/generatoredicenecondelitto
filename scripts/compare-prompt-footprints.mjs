// Deterministic comparison of serialized prompt size, not a token estimate.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeBible, makeCanonical, makeCharacter } from '../tests/generationFixtures.mjs';
const baseline = execFileSync('git', ['show', '69ab9d1:services/groqService.ts'], { encoding: 'utf8' });
const optimized = readFileSync('services/groqService.ts', 'utf8');
const load = async (contents) => {
  const { outputFiles } = await build({ stdin: { contents, resolveDir: resolve('services'), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'browser' });
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
};
const modules = [await load(baseline), await load(optimized)];
const nativeFetch = globalThis.fetch;
try {
  for (const count of [5, 8, 12]) {
    const results = [];
    for (const [index, service] of modules.entries()) {
      const bible = makeBible(count), plan = makeCanonical(count), names = plan.cast.map(c => c.name), prompts = [];
      globalThis.fetch = async (url, options) => {
        const request = JSON.parse(options.body);
        const phase = request.phase ?? request.response_format.json_schema.name;
        prompts.push({ phase, characters: request.prompt.length });
        let value;
        if (phase === 'story_bible') value = bible;
        else if (phase === 'canonical_plan') value = plan;
        else if (phase === 'common_document') value = bible.commonDocument;
        else if (phase === 'solution') value = bible.solution;
        else if (phase === 'evidence_batch') {
          const input = JSON.parse(request.prompt.split('\nINPUT:\n')[1]);
          value = { evidence: input.selected.map(c => ({ ...bible.characterPlans.flatMap(p => p.cluePlan).find(p => p.id === c.id), recipients: [plan.cast.find(p => p.id === c.recipientId).name] })) };
        } else if (phase === 'character_batch') {
          const selected = index === 0 ? request.prompt.split('\n')[0].split('senza aggiungerne o ometterne: ')[1].split('.')[0].split(', ') : JSON.parse(request.prompt.split('\nINPUT:\n')[1]).selected.map(c => c.name);
          value = { characters: selected.map(name => ({ ...makeCharacter(name, names), isCulprit: name === names[0] })) };
        } else if (phase === 'story_verification') value = { approved: true, summary: 'OK', issues: [], warnings: [] };
        else throw new Error(`Unexpected ${phase}`);
        return new Response(JSON.stringify({ content: JSON.stringify(value) }), { status: 200 });
      };
      await service.generateMurderMysteryStory(count, 'Villa Vittoriana');
      results.push({ version: index ? 'optimized' : 'baseline', calls: prompts.length, promptCharacters: prompts.reduce((sum, p) => sum + p.characters, 0), characterPromptCharacters: prompts.filter(p => p.phase === 'character_batch').reduce((sum, p) => sum + p.characters, 0) });
    }
    console.log(JSON.stringify({ count, results, promptReductionPercent: Math.round((1 - results[1].promptCharacters / results[0].promptCharacters) * 1000) / 10 }));
  }
} finally { globalThis.fetch = nativeFetch; }
