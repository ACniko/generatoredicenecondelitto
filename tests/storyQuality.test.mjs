import test from 'node:test';
import assert from 'node:assert/strict';
import * as quality from '../services/storyQuality.ts';

const { auditStoryQuality, STORY_CONTENT_LIMITS } = quality;

const words = (count) => Array.from({ length: count }, (_, index) => `dettaglio${index + 1}`).join(' ');
const roundText = (target, round) => `Fatti che conosci: ${words(50)}. Cosa puoi rivelare: ${words(50)}. Obiettivo concreto: chiedi a ${target} di spiegare il suo alibi. Informazione nuova: nel round ${round} ${words(50)}.`;

function makeStory(playerCount = 4) {
  const names = Array.from({ length: playerCount }, (_, index) => `Personaggio ${index + 1}`);
  const characters = names.map((name, index) => ({
    name,
    isCulprit: index === 0,
    initialDescription: words(100),
    relationships: words(180),
    round1Info: roundText(names[(index + 1) % playerCount], 1),
    round2Info: roundText(names[(index + 1) % playerCount], 2),
    round3Info: roundText(names[(index + 1) % playerCount], 3),
    secretsAndMotives: words(180),
    opinionsOnOthers: names.filter((other) => other !== name).map((characterName) => ({ characterName, opinion: words(45) })),
  }));
  const types = ['decisive', 'corroborating', 'red-herring'];
  const evidence = names.flatMap((name, index) => [1, 2, 3].map((round) => ({
    id: `e${index + 1}-${round}`,
    title: `Indizio ${index + 1} del round ${round}`,
    round,
    recipients: [name],
    type: index > 0 && index < 4 && round === index ? 'decisive' : types[(index + round) % 2 + 1],
    content: words(40),
    solutionLink: `Questo dettaglio collega la presenza alla scena e consente di dedurre l'accesso del colpevole durante il round ${round}.`,
    organizerNote: 'Consegnare al destinatario indicato nel round previsto prima di iniziare la conversazione successiva.',
  })));
  return {
    title: 'Il segreto della villa',
    commonDocument: {
      introduction: words(200),
      crimeSceneMapDescription: words(200),
      characterOverviews: names.map((name) => `${name}: ${words(45)}`).join(' '),
    },
    characters,
    evidence,
    solution: {
      culprits: [names[0]],
      motive: words(120),
      how: words(120),
      backstory: words(200),
      deductionChain: Array.from({ length: 4 }, () => words(25)),
    },
  };
}

test('accetta storie complete per 4, 8 e 12 partecipanti', () => {
  for (const count of [4, 8, 12]) {
    const result = auditStoryQuality(makeStory(count), count);
    assert.deepEqual(result.errors, [], `${count}: ${result.errors.join('; ')}`);
    assert.equal(result.valid, true);
  }
});

test('espone le soglie approvate per il contenuto', () => {
  assert.deepEqual(STORY_CONTENT_LIMITS, {
    commonIntroduction: 200, commonIntroductionMax: 350, crimeScene: 200, crimeSceneMax: 350,
    characterOverviewPerPlayer: 45, characterOverviewMaxPerPlayer: 70,
    initialDescription: 100, initialDescriptionMax: 140, relationships: 180, relationshipsMax: 260,
    roundInfo: 150, roundInfoMax: 190, secretsAndMotives: 180, secretsAndMotivesMax: 260,
    opinionMin: 45, opinionMax: 65,
    motive: 120, motiveMax: 200, method: 120, methodMax: 200, backstory: 200, backstoryMax: 300,
    deductionSteps: 4, deductionStepsMax: 6, deductionStep: 25, deductionStepMax: 80, clue: 40, clueMax: 55,
    clueSolutionLink: 15, clueSolutionLinkMax: 45, clueOrganizerNote: 10, clueOrganizerNoteMax: 45,
  });
});

test('rifiuta conteggi di giocatori fuori da 4–12', () => {
  for (const count of [3, 13]) {
    const result = auditStoryQuality(makeStory(count), count);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes('4') && error.includes('12')));
  }
});

test('richiede introduzione, scena e riepilogo sostanziosi con ogni nome', () => {
  const story = makeStory(4);
  story.commonDocument.introduction = words(199);
  story.commonDocument.crimeSceneMapDescription = words(199);
  story.commonDocument.characterOverviews = `Personaggio 1 ${words(177)}`;
  const errors = auditStoryQuality(story, 4).errors;
  assert.ok(errors.some((error) => error.includes('introduzione') && error.includes('200')));
  assert.ok(errors.some((error) => error.includes('scena') && error.includes('200')));
  assert.ok(errors.some((error) => error.includes('riepilogo') && error.includes('180')));
  assert.ok(errors.some((error) => error.includes('Personaggio 2')));
});

test('richiede tutte le sezioni dei round e un obiettivo rivolto a un altro personaggio', () => {
  const story = makeStory(4);
  story.characters[0].round1Info = `${words(151)} Obiettivo concreto: osserva la stanza.`;
  const errors = auditStoryQuality(story, 4).errors;
  for (const label of ['Fatti che conosci:', 'Cosa puoi rivelare:', 'Informazione nuova:']) {
    assert.ok(errors.some((error) => error.includes(label)), label);
  }
  assert.ok(errors.some((error) => error.includes('Obiettivo concreto') && error.includes('personaggio')));
});

test('applica i minimi delle schede, i limiti delle opinioni e della soluzione', () => {
  const story = makeStory(4);
  story.characters[0].initialDescription = words(99);
  story.characters[0].relationships = words(179);
  story.characters[0].round2Info = roundText('Personaggio 2', 2).split(' ').slice(0, 149).join(' ');
  story.characters[0].secretsAndMotives = words(179);
  story.characters[0].opinionsOnOthers[0].opinion = words(44);
  story.characters[0].opinionsOnOthers[1].opinion = words(66);
  story.solution.motive = words(119);
  story.solution.how = words(119);
  story.solution.backstory = words(199);
  story.solution.deductionChain = [words(24), words(25), words(25)];
  const errors = auditStoryQuality(story, 4).errors;
  for (const fragment of ['initialDescription', 'relationships', 'round2Info', 'secretsAndMotives', '45 parole', '65 parole', 'motive', 'how', 'backstory', '4 passaggi', '25 parole']) {
    assert.ok(errors.some((error) => error.includes(fragment)), fragment);
  }
});

test('rifiuta campi che superano i limiti massimi di impaginazione', () => {
  const story = makeStory(4);
  story.commonDocument.introduction = words(STORY_CONTENT_LIMITS.commonIntroductionMax + 1);
  story.characters[0].initialDescription = words(STORY_CONTENT_LIMITS.initialDescriptionMax + 1);
  story.characters[0].round1Info = roundText('Personaggio 2', 1).replace(/Informazione nuova:.*$/u, `Informazione nuova: ${words(100)}`);
  story.evidence[0].content = words(STORY_CONTENT_LIMITS.clueMax + 1);
  story.evidence[1].solutionLink = words(STORY_CONTENT_LIMITS.clueSolutionLinkMax + 1);
  story.evidence[2].organizerNote = words(STORY_CONTENT_LIMITS.clueOrganizerNoteMax + 1);
  const errors = auditStoryQuality(story, 4).errors;
  assert.ok(errors.some((error) => error.includes('introduzione') && error.includes('massimo')));
  assert.ok(errors.some((error) => error.includes('initialDescription') && error.includes('massimo')));
  assert.ok(errors.some((error) => error.includes('round1Info') && error.includes('massimo')));
  assert.ok(errors.some((error) => error.includes('indizio 1: content') && error.includes('massimo')));
  assert.ok(errors.some((error) => error.includes('indizio 2: solutionLink') && error.includes('massimo')));
  assert.ok(errors.some((error) => error.includes('indizio 3: organizerNote') && error.includes('massimo')));
});

test('richiede esattamente un indizio per personaggio e round, con destinatario unico e testo sufficiente', () => {
  const story = makeStory(4);
  story.evidence[0].recipients = ['Personaggio 1', 'Personaggio 2'];
  story.evidence[1].content = words(39);
  story.evidence.push({ ...story.evidence[2], id: 'duplicato' });
  const errors = auditStoryQuality(story, 4).errors;
  assert.ok(errors.some((error) => error.includes('un destinatario')));
  assert.ok(errors.some((error) => error.includes('40 parole')));
  assert.ok(errors.some((error) => error.includes('Personaggio 1') && error.includes('round 3')));
});

test('segnala un round senza indizio per un personaggio', () => {
  const story = makeStory(12);
  story.evidence = story.evidence.filter((clue) => clue.id !== 'e12-2');
  const errors = auditStoryQuality(story, 12).errors;
  assert.ok(errors.some((error) => error.includes('Personaggio 12') && error.includes('round 2')));
});

test('richiede categorie complete e collegamenti decisivi che spieghino la deduzione', () => {
  const story = makeStory(4);
  story.evidence[3].solutionLink = 'Utile alla soluzione.';
  story.evidence.filter((clue) => clue.type === 'red-herring').forEach((clue) => { clue.type = 'corroborating'; });
  const errors = auditStoryQuality(story, 4).errors;
  assert.ok(errors.some((error) => error.includes('collegamento')));
  assert.ok(errors.some((error) => error.includes('depistaggio')));
});

test('distribuisce almeno tre indizi decisivi a innocenti distinti e uno in ogni round', () => {
  const story = makeStory(4);
  story.evidence.find((clue) => clue.id === 'e4-3').type = 'corroborating';
  const errors = auditStoryQuality(story, 4).errors;
  assert.ok(errors.some((error) => error.includes('innocenti distinti')));
  assert.ok(errors.some((error) => error.includes('ogni round')));
});

test('preserva avvisi semantici e controlli di malformazione', () => {
  const story = makeStory(4);
  story.characters[2].round2Info = story.characters[2].round1Info;
  story.evidence.find((clue) => clue.id === 'e2-1').content = `Personaggio 2 è l'assassino. ${words(40)}`;
  const result = auditStoryQuality(story, 4);
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((warning) => warning.includes('revisione narrativa')));
  assert.ok(result.warnings.some((warning) => warning.includes('sospetto')));

  const malformed = makeStory(8);
  malformed.characters[7].name = malformed.characters[6].name;
  malformed.evidence[0].round = 4;
  malformed.evidence[1].recipients = ['Sconosciuto'];
  malformed.solution.culprits = ['Personaggio 2'];
  const errors = auditStoryQuality(malformed, 8).errors;
  for (const fragment of ['nomi', 'round', 'destinatario', 'colpevol']) {
    assert.ok(errors.some((error) => error.includes(fragment)), fragment);
  }
});
