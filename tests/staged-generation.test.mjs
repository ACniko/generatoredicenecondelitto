import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: ['services/groqService.ts'],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'esm',
  target: 'es2022'
});
const service = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

const makeBible = (playerCount) => {
  const names = Array.from({ length: playerCount }, (_, i) => `Personaggio ${i + 1} Rossi`);
  return {
    title: 'Il segreto della villa',
    commonDocument: {
      introduction: 'Una cena in villa si interrompe quando il proprietario viene trovato morto.',
      crimeSceneMapDescription: 'La scena comprende la sala da pranzo, la biblioteca e il giardino.',
      characterOverviews: names.join(', ')
    },
    solution: {
      culprits: [names[0]],
      motive: 'Il colpevole temeva che la vittima rivelasse una frode documentale.',
      how: 'Ha manomesso il calice durante un intervallo documentato nella cronologia.',
      backstory: 'La frode era iniziata anni prima e la vittima aveva convocato tutti per annunciarne la scoperta.',
      deductionChain: ['Il registro colloca il calice nella biblioteca.', 'L’orologio prova l’intervallo utile.', 'La lettera collega movente e colpevole.']
    },
    characterPlans: names.map((name, index) => ({
      name,
      publicRole: 'Ospite e responsabile di una parte dell’evento.',
      truth: 'Conosce un dettaglio verificabile della serata.',
      privateSecret: 'Nasconde un comportamento imbarazzante ma non il delitto.',
      motive: 'Ha avuto un conflitto personale con la vittima.',
      alibiTimeline: 'Tra le 21 e le 22 era nella sala principale.',
      relationshipFacts: names.filter((other) => other !== name).map((characterName) => ({ characterName, fact: 'Il loro rapporto è segnato da un debito e da una promessa.' })),
      cluePlan: [1, 2, 3].map((round) => ({
        id: `clue-${index}-${round}`,
        title: `Prova del round ${round}`,
        round,
        type: index === round ? 'decisive' : index === 0 && round === 1 ? 'corroborating' : 'red-herring',
        content: 'Un documento originale colloca una persona e un oggetto in un luogo preciso al momento rilevante. Questo dettaglio offre un riscontro verificabile e indica quale elemento confrontare con gli alibi degli ospiti.',
        solutionLink: 'La prova aiuta a ricostruire la sequenza degli eventi e a identificare il colpevole.',
        organizerNote: 'Questa nota è riservata all’organizzatore e contiene il significato della prova.'
      }))
    }))
  };
};

const makeCharacter = (name, allNames) => {
  const text = (word, count) => Array.from({ length: count }, () => word).join(' ');
  return {
    name,
    isCulprit: false,
    initialDescription: text('personalità', 105),
    relationships: text('relazione', 170),
    round1Info: text('rivelazione', 145),
    round2Info: text('confronto', 145),
    round3Info: text('deduzione', 145),
    secretsAndMotives: text('movente', 170),
    opinionsOnOthers: allNames.filter((other) => other !== name).map((characterName) => ({ characterName, opinion: text('giudizio', 42) }))
  };
};

async function runGeneration(playerCount, { rejectVerification = false, firstCallRateLimited = false, firstCallLongRateLimit = false, firstCallStructuredFailure = false, firstCharacterBatchIncomplete = false } = {}) {
  const bible = makeBible(playerCount);
  const allNames = bible.characterPlans.map((plan) => plan.name);
  const calls = [];
  let rateLimitReturned = false;
  let structuredFailureReturned = false;
  let characterBatchReturnedIncomplete = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const request = JSON.parse(options.body);
    const schemaName = request.response_format.json_schema.name;
    calls.push({ endpoint: url, schemaName, model: request.model, prompt: request.prompt });
    if (firstCallLongRateLimit) {
      return new Response(JSON.stringify({ error: 'Limite temporaneo del servizio AI. Attendi circa 4 minuti e 48 secondi e riprova.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '288' }
      });
    }
    if (firstCallRateLimited && !rateLimitReturned) {
      rateLimitReturned = true;
      return new Response(JSON.stringify({ error: 'Limite temporaneo. Attendi circa 1 secondo.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '1' }
      });
    }
    if (firstCallStructuredFailure && !structuredFailureReturned) {
      structuredFailureReturned = true;
      return new Response(JSON.stringify({ error: 'Risposta strutturata non valida.', retryable: true }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    let payload;
    if (schemaName === 'story_bible') payload = bible;
    else if (schemaName === 'character_batch') {
      const line = request.prompt.split('\n')[0];
      const namesText = line.split('senza aggiungerne o ometterne: ')[1].split('.')[0];
      const selectedNames = namesText.split(', ');
      payload = { characters: selectedNames.map((name) => makeCharacter(name, allNames)) };
      if (firstCharacterBatchIncomplete && !characterBatchReturnedIncomplete) {
        characterBatchReturnedIncomplete = true;
        payload.characters[0].initialDescription = 'Descrizione troppo breve.';
      }
    } else if (schemaName === 'story_verification') {
      payload = {
        approved: !rejectVerification,
        summary: rejectVerification ? 'La cronologia di prova richiede un controllo.' : 'Nessuna contraddizione sostanziale.',
        issues: rejectVerification ? ['Controllare il passaggio del calice tra biblioteca e sala.'] : [],
        warnings: []
      };
    } else throw new Error(`Fase imprevista: ${schemaName}`);
    return new Response(JSON.stringify({ content: JSON.stringify(payload) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  try {
    const story = await service.generateMurderMysteryStory(playerCount, 'Mistero nella villa');
    return { story, calls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('staged generation makes complete, long four-player cards and preserves full story on review failure', async () => {
  const { story, calls } = await runGeneration(4, { rejectVerification: true, firstCallRateLimited: true });
  assert.equal(story.characters.length, 4);
  assert.equal(story.evidence.length, 12);
  assert.equal(story.solution.deductionChain.length, 3);
  assert.ok(story.verificationWarning);
  assert.ok(story.characters.every((character) => character.isCulprit === (character.name === story.solution.culprits[0])));
  assert.ok(story.characters.every((character) => character.opinionsOnOthers.length === 3));
  assert.ok(calls.every((call) => call.model === 'openai/gpt-oss-120b'));
  assert.equal(calls.filter((call) => call.schemaName === 'story_bible').length, 2);
  assert.equal(calls.filter((call) => call.schemaName === 'character_batch').length, 2);
  assert.equal(calls.filter((call) => call.schemaName === 'story_verification').length, 1);
  assert.equal(calls.find((call) => call.schemaName === 'story_verification').endpoint, '/api/verify');
  for (const character of story.characters) {
    const wordCount = [character.initialDescription, character.relationships, character.round1Info, character.round2Info, character.round3Info, character.secretsAndMotives, ...character.opinionsOnOthers.map((opinion) => opinion.opinion)]
      .join(' ').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu).length;
    assert.ok(wordCount >= 955, `${character.name} deve contenere una scheda sostanziale`);
  }
});

test('12-player generation keeps exact cast and uses small character batches', async () => {
  const { story, calls } = await runGeneration(12);
  assert.equal(story.characters.length, 12);
  assert.equal(story.evidence.length, 36);
  assert.equal(calls.filter((call) => call.schemaName === 'character_batch').length, 6);
  assert.ok(story.characters.every((character) => character.opinionsOnOthers.length === 11));
});

test('a transient structured-output failure is retried without losing the story', async () => {
  const { story, calls } = await runGeneration(4, { firstCallStructuredFailure: true });
  assert.equal(story.characters.length, 4);
  assert.equal(calls.filter((call) => call.schemaName === 'story_bible').length, 2);
});

test('a character batch that fails completeness checks is regenerated with a focused correction', async () => {
  const { story, calls } = await runGeneration(4, { firstCharacterBatchIncomplete: true });
  const characterCalls = calls.filter((call) => call.schemaName === 'character_batch');
  assert.equal(story.characters.length, 4);
  assert.equal(characterCalls.length, 3);
  assert.match(characterCalls[1].prompt, /La scheda di .* è troppo breve in initialDescription/);
});

test('a long provider quota window is shown immediately without retrying the expensive request', async () => {
  await assert.rejects(
    () => runGeneration(4, { firstCallLongRateLimit: true }),
    /Attendi circa 4 minuti e 48 secondi/
  );
});
