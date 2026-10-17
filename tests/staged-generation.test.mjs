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
      introduction: Array.from({ length: 30 }, (_, i) => `Introduzione della villa e del delitto ${i + 1}.`).join(' '),
      crimeSceneMapDescription: Array.from({ length: 30 }, (_, i) => `Descrizione verificabile della scena e degli ambienti ${i + 1}.`).join(' '),
      characterOverviews: names.map((name) => `${name}: ${Array.from({ length: 10 }, (_, i) => `ruolo pubblico relazione villa ${i + 1}.`).join(' ')}`).join('\n\n')
    },
    solution: {
      culprits: [names[0]],
      motive: Array.from({ length: 20 }, (_, i) => `Movente documentale credibile e personale ${i + 1}.`).join(' '),
      how: Array.from({ length: 20 }, (_, i) => `Metodo verificabile coerente con la scena e la cronologia ${i + 1}.`).join(' '),
      backstory: Array.from({ length: 25 }, (_, i) => `Retroscena dei rapporti tra gli ospiti e la vittima ${i + 1}.`).join(' '),
      deductionChain: [1, 2, 3, 4].map((step) => Array.from({ length: 3 }, (_, i) => `Passaggio deduttivo ${step} collega una prova concreta alla cronologia ${i + 1}.`).join(' '))
    },
    timeline: [
      { id: 't1', time: '20:00', location: 'sala da pranzo', event: 'Gli ospiti arrivano per la cena.', characters: names.slice(0, 3) },
      { id: 't2', time: '20:30', location: 'biblioteca', event: 'La vittima consulta il registro.', characters: names.slice(0, 2) },
      { id: 't3', time: '21:00', location: 'sala da pranzo', event: 'Si tiene il brindisi.', characters: names.slice(1, 4) },
      { id: 't4', time: '21:30', location: 'corridoio', event: 'Un ospite trova la vittima.', characters: names.slice(0, 2) }
    ],
    characterPlans: names.map((name, index) => ({
      name,
      publicRole: 'Ospite e responsabile di una parte dell’evento.',
      truth: 'Conosce un dettaglio verificabile della serata.',
      privateSecret: 'Nasconde un comportamento imbarazzante ma non il delitto.',
      motive: 'Ha avuto un conflitto personale con la vittima.',
      alibiTimeline: 'Tra le 21 e le 22 era nella sala principale.',
      relationshipFacts: names.filter((other) => other !== name).slice(0, 3).map((characterName) => ({ characterName, fact: 'Il loro rapporto è segnato da un debito, una promessa infranta e un interesse condiviso.' })),
      cluePlan: [1, 2, 3].map((round) => ({
        id: `clue-${index}-${round}`,
        title: `Prova del round ${round}`,
        round,
        type: index === round ? 'decisive' : index === 0 && round === 1 ? 'corroborating' : 'red-herring',
        content: 'Un documento originale colloca il registro nella biblioteca alle ventuno. Il segno d inchiostro coincide con la copia trovata vicino al calice. Confrontando le due date, gli ospiti possono verificare chi ha avuto accesso al mobile e quale alibi non coincide con gli orari annotati.',
        solutionLink: 'Questa prova collega l’orario del registro alla finestra del delitto e consente di dedurre chi poteva accedere alla biblioteca senza lasciare una traccia coerente.',
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
    relationships: text('relazione', 185),
    round1Info: `Fatti che conosci: ${text('rivelazione', 150)} Cosa puoi rivelare: ${text('brindisi', 4)} Obiettivo concreto: parla con ${allNames.find((other) => other !== name)} e chiedi dell alibi. Informazione nuova: ${text('registro', 10)}`,
    round2Info: `Fatti che conosci: ${text('confronto', 150)} Cosa puoi rivelare: ${text('biblioteca', 4)} Obiettivo concreto: confronta con ${allNames.find((other) => other !== name)} gli orari. Informazione nuova: ${text('chiave', 10)}`,
    round3Info: `Fatti che conosci: ${text('deduzione', 150)} Cosa puoi rivelare: ${text('calice', 4)} Obiettivo concreto: chiedi a ${allNames.find((other) => other !== name)} di spiegare la contraddizione. Informazione nuova: ${text('prova', 10)}`,
    secretsAndMotives: text('movente', 185),
    opinionsOnOthers: allNames.filter((other) => other !== name).map((characterName) => ({ characterName, opinion: text('giudizio', 45) }))
  };
};

async function runGeneration(playerCount, { theme = 'Mistero nella villa', rejectVerification = false, firstCallRateLimited = false, firstCallLongRateLimit = false, firstCallStructuredFailure = false, firstCharacterBatchIncomplete = false, shortCommonDocument = false, invalidTimeline = false } = {}) {
  const bible = makeBible(playerCount);
  if (shortCommonDocument) bible.commonDocument.introduction = 'Introduzione troppo breve.';
  if (invalidTimeline) bible.timeline[2].time = '19:00';
  const allNames = bible.characterPlans.map((plan) => plan.name);
  const calls = [];
  let rateLimitReturned = false;
  let structuredFailureReturned = false;
  let characterBatchReturnedIncomplete = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const request = JSON.parse(options.body);
    const schemaName = request.response_format.json_schema.name;
    calls.push({ endpoint: url, schemaName, model: request.model, prompt: request.prompt, schema: request.response_format.json_schema.schema });
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
    const story = await service.generateMurderMysteryStory(playerCount, theme);
    return { story, calls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('staged generation makes complete, long four-player cards and preserves full story on review failure', async () => {
  const { story, calls } = await runGeneration(4, { rejectVerification: true, firstCallRateLimited: true });
  assert.equal(story.characters.length, 4);
  assert.equal(story.evidence.length, 12);
  assert.equal(story.solution.deductionChain.length, 4);
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

test('8-player generation creates a complete cast for a different theme', async () => {
  const { story, calls } = await runGeneration(8, { theme: 'Notte al museo' });
  assert.equal(story.characters.length, 8);
  assert.equal(story.evidence.length, 24);
  assert.ok(story.characters.every((character) => character.opinionsOnOthers.length === 7));
  assert.ok(calls.find((call) => call.schemaName === 'story_bible').prompt.includes('Notte al museo'));
});

test('canonical bible defines an ordered timeline and round cards require actionable labeled sections', async () => {
  const { calls } = await runGeneration(4);
  const bibleCall = calls.find((call) => call.schemaName === 'story_bible');
  assert.ok(bibleCall.schema.required.includes('timeline'));
  assert.equal(bibleCall.schema.properties.timeline.items.properties.time.type, 'string');
  const characterPrompt = calls.find((call) => call.schemaName === 'character_batch').prompt;
  for (const label of ['Fatti che conosci:', 'Cosa puoi rivelare:', 'Obiettivo concreto:', 'Informazione nuova:']) {
    assert.ok(characterPrompt.includes(label), `Il prompt deve richiedere la sezione ${label}`);
  }
});

test('a short common dossier is rejected before character generation', async () => {
  await assert.rejects(() => runGeneration(4, { shortCommonDocument: true }), /introduzione.*almeno 200 parole/i);
});

test('an unordered canonical timeline is rejected before character generation', async () => {
  await assert.rejects(() => runGeneration(4, { invalidTimeline: true }), /cronologia.*orari HH:MM validi e in ordine crescente/i);
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
