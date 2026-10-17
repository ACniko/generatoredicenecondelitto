import test from 'node:test';
import assert from 'node:assert/strict';
import { auditStoryQuality } from '../services/storyQuality.ts';

function makeStory(playerCount = 4) {
  const names = Array.from({ length: playerCount }, (_, index) => `Personaggio ${index + 1}`);
  const prose = (subject, detail, count) => Array.from({ length: count }, (_, index) => `${subject} ${detail} ${index + 1}.`).join(' ');
  const characters = names.map((name, index) => ({
    name,
    isCulprit: index === 0,
    initialDescription: prose(name, 'ha una storia e una motivazione riconoscibile nella villa.', 85),
    relationships: prose('È legato agli altri ospiti', 'da rancori, alleanze e interessi condivisi.', 125),
    round1Info: prose('Nel primo round', 'racconta ciò che ha visto e cerca un alleato.', 105),
    round2Info: prose('Nel secondo round', 'rivela un dettaglio e mette alla prova un alibi.', 105),
    round3Info: prose('Nel terzo round', 'affronta le contraddizioni e decide cosa confessare.', 105),
    secretsAndMotives: prose('Nasconde un debito importante', 'e teme che venga scoperto durante la serata.', 125),
    opinionsOnOthers: names.filter((other) => other !== name).map((characterName) => ({
      characterName,
      opinion: prose('Nutre un sospetto', 'motivato da una vecchia promessa infranta e da dettagli concreti.', 35),
    })),
  }));

  return {
    title: 'Il segreto della villa',
    commonDocument: {
      introduction: 'Durante una cena alla villa, il padrone di casa viene trovato morto. Gli ospiti dovranno ricostruire gli eventi della serata.',
      crimeSceneMapDescription: 'La sala da pranzo comunica con il salone e il corridoio; sul tavolo è rimasto un bicchiere fuori posto.',
      characterOverviews: names.join(', '),
    },
    characters,
    evidence: [
      { id: 'e1', title: 'Bicchiere spostato', round: 1, recipients: [names[1]], type: 'decisive', content: 'Il bicchiere della vittima è stato spostato dopo il brindisi.', solutionLink: 'Dimostra che il colpevole ha avuto accesso al tavolo dopo il brindisi.', organizerNote: 'Consegnare in apertura del primo round.' },
      { id: 'e2', title: 'Chiave duplicata', round: 2, recipients: [names[2]], type: 'decisive', content: 'Esiste una copia della chiave custodita da una sola persona.', solutionLink: 'Collega l accesso alla stanza alla persona che possiede la copia della chiave.', organizerNote: 'Consegnare all inizio del secondo round.' },
      { id: 'e3', title: 'Nota strappata', round: 3, recipients: [names[3]], type: 'decisive', content: 'La nota indica un incontro segreto poco prima del delitto.', solutionLink: 'L incontro colloca il colpevole nella stanza nel momento cruciale.', organizerNote: 'Rivelare durante l ultimo round.' },
      { id: 'e4', title: 'Debito nascosto', round: 2, recipients: [names[0]], type: 'corroborating', content: 'La vittima aveva chiesto la restituzione di una somma.', solutionLink: 'Rafforza il movente economico già emerso dagli altri indizi.', organizerNote: 'Consegnare in privato.' },
      { id: 'e5', title: 'Fazzoletto blu', round: 1, recipients: [names[1]], type: 'red-herring', content: 'Un fazzoletto blu è stato trovato vicino alla finestra.', solutionLink: 'Sembra indicare un intruso, ma appartiene a un ospite innocente.', organizerNote: 'Usare per alimentare un sospetto plausibile.' },
    ],
    solution: {
      culprits: [names[0]],
      motive: 'Il colpevole voleva impedire che venisse scoperto il debito.',
      how: 'Ha manomesso il bicchiere dopo il brindisi usando la copia della chiave.',
      backstory: 'La vittima minacciava di rivelare il debito agli altri ospiti.',
      deductionChain: [
        'Il bicchiere è stato spostato dopo il brindisi, quindi il colpevole era ancora nella sala.',
        'La copia della chiave collega l accesso alla stanza al personaggio che la possedeva.',
        'Il debito fornisce il movente e conferma l identità indicata dagli indizi materiali.',
      ],
    },
  };
}

test('accetta una storia completa con indizi distribuiti e soluzione coerente', () => {
  const result = auditStoryQuality(makeStory(4), 4);

  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test('rende bloccante il numero errato di personaggi e i nomi duplicati', () => {
  const story = makeStory(4);
  story.characters[3].name = story.characters[2].name;

  const result = auditStoryQuality(story, 5);

  assert.ok(result.errors.some((issue) => issue.includes('5 personaggi')));
  assert.ok(result.errors.some((issue) => issue.includes('nomi')));
});

test('segnala indizi mancanti per personaggi e categorie richieste', () => {
  const story = makeStory(4);
  story.evidence = story.evidence.filter((clue) => clue.type === 'decisive');

  const result = auditStoryQuality(story, 4);

  assert.ok(result.errors.some((issue) => issue.includes('corroborante')));
  assert.ok(result.errors.some((issue) => issue.includes('depistaggio')));
  assert.ok(result.errors.some((issue) => issue.includes('personaggi')));
});

test('valida round e destinatari e richiede una catena di deduzione non vuota', () => {
  const story = makeStory(4);
  story.evidence[0].round = 4;
  story.evidence[1].recipients = ['Sconosciuto'];
  story.solution.deductionChain = ['  ', 'Un passaggio valido.'];

  const result = auditStoryQuality(story, 4);

  assert.ok(result.errors.some((issue) => issue.includes('round')));
  assert.ok(result.errors.some((issue) => issue.includes('destinatario')));
  assert.ok(result.errors.some((issue) => issue.includes('deduzione')));
});

test('rende bloccanti i campi richiesti mancanti di scheda e indizi', () => {
  const story = makeStory(4);
  story.characters[1].relationships = '   ';
  story.evidence[3].organizerNote = '';

  const result = auditStoryQuality(story, 4);

  assert.ok(result.errors.some((issue) => issue.includes('relationships')));
  assert.ok(result.errors.some((issue) => issue.includes('organizerNote')));
});

test('rileva mismatch tra colpevoli e personaggi e collegamenti decisivi vaghi', () => {
  const story = makeStory(4);
  story.solution.culprits = ['Personaggio 2'];
  story.evidence[0].solutionLink = 'Utile alla soluzione.';

  const result = auditStoryQuality(story, 4);

  assert.ok(result.errors.some((issue) => issue.includes('colpevol')));
  assert.ok(result.errors.some((issue) => issue.includes('collegamento')));
});

test('richiede almeno un indizio decisivo in ciascun round', () => {
  const story = makeStory(4);
  story.evidence[2].round = 2;

  const result = auditStoryQuality(story, 4);

  assert.ok(result.errors.some((issue) => issue.includes('ogni round')));
});

test('avvisa se un indizio decisivo sembra rivelare la colpevolezza del destinatario innocente', () => {
  const story = makeStory(4);
  story.evidence[0].recipients = ['Personaggio 2'];
  story.evidence[0].content = 'Personaggio 2 è l assassino e ha avvelenato la vittima.';

  const result = auditStoryQuality(story, 4);

  assert.ok(result.errors.length === 0);
  assert.ok(result.warnings.some((issue) => issue.includes('sospetto')));
});

test('mantiene avvisi non bloccanti per rischi semantici che richiedono revisione umana', () => {
  const story = makeStory(4);
  story.characters[2].round2Info = story.characters[2].round1Info;

  const result = auditStoryQuality(story, 4);

  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((issue) => issue.includes('revisione narrativa')));
});
