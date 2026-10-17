import type { EvidenceClue, StoryData } from '../types';
import { auditStoryQuality, STORY_CONTENT_LIMITS } from './storyQuality';

const STORY_MODEL = 'openai/gpt-oss-120b';
const CHARACTER_BATCH_SIZE = 2;
const VERIFICATION_WARNING = 'La storia completa è disponibile, ma la verifica narrativa automatica non è riuscita. L’organizzatore dovrebbe controllare indizi e soluzione prima della partita.';

type CharacterPlan = {
  name: string;
  publicRole: string;
  truth: string;
  privateSecret: string;
  motive: string;
  alibiTimeline: string;
  relationshipFacts: Array<{ characterName: string; fact: string }>;
  cluePlan: Array<Omit<EvidenceClue, 'recipients'> & { recipients?: string[] }>;
};

type StoryBible = Pick<StoryData, 'title' | 'commonDocument' | 'solution'> & {
  victimName: string;
  timeline: Array<{ id: string; time: string; location: string; event: string; characters: string[] }>;
  characterPlans: CharacterPlan[];
};

const clueSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    round: { type: 'integer', enum: [1, 2, 3] },
    type: { type: 'string', enum: ['decisive', 'corroborating', 'red-herring'] },
    content: { type: 'string' },
    solutionLink: { type: 'string' },
    organizerNote: { type: 'string' },
  },
  required: ['id', 'title', 'round', 'type', 'content', 'solutionLink', 'organizerNote'],
};

const storyBibleSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    victimName: { type: 'string' },
    commonDocument: {
      type: 'object',
      properties: {
        introduction: { type: 'string' },
        crimeSceneMapDescription: { type: 'string' },
        characterOverviews: { type: 'string' },
      },
      required: ['introduction', 'crimeSceneMapDescription', 'characterOverviews'],
    },
    solution: {
      type: 'object',
      properties: {
        culprits: { type: 'array', items: { type: 'string' } },
        motive: { type: 'string' },
        how: { type: 'string' },
        backstory: { type: 'string' },
        deductionChain: { type: 'array', items: { type: 'string' } },
      },
      required: ['culprits', 'motive', 'how', 'backstory', 'deductionChain'],
    },
    timeline: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          time: { type: 'string' },
          location: { type: 'string' },
          event: { type: 'string' },
          characters: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'time', 'location', 'event', 'characters'],
      },
    },
    characterPlans: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          publicRole: { type: 'string' },
          truth: { type: 'string' },
          privateSecret: { type: 'string' },
          motive: { type: 'string' },
          alibiTimeline: { type: 'string' },
          relationshipFacts: {
            type: 'array',
            items: {
              type: 'object',
              properties: { characterName: { type: 'string' }, fact: { type: 'string' } },
              required: ['characterName', 'fact'],
            },
          },
          cluePlan: { type: 'array', items: clueSchema },
        },
        required: ['name', 'publicRole', 'truth', 'privateSecret', 'motive', 'alibiTimeline', 'relationshipFacts', 'cluePlan'],
      },
    },
  },
  required: ['title', 'victimName', 'commonDocument', 'solution', 'timeline', 'characterPlans'],
};

const characterSchema = {
  type: 'object',
  properties: {
    characters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          isCulprit: { type: 'boolean' },
          initialDescription: { type: 'string' },
          relationships: { type: 'string' },
          round1Info: { type: 'string' },
          round2Info: { type: 'string' },
          round3Info: { type: 'string' },
          secretsAndMotives: { type: 'string' },
          opinionsOnOthers: {
            type: 'array',
            items: {
              type: 'object',
              properties: { characterName: { type: 'string' }, opinion: { type: 'string' } },
              required: ['characterName', 'opinion'],
            },
          },
        },
        required: ['name', 'isCulprit', 'initialDescription', 'relationships', 'round1Info', 'round2Info', 'round3Info', 'secretsAndMotives', 'opinionsOnOthers'],
      },
    },
  },
  required: ['characters'],
};

const verificationSchema = {
  type: 'object',
  properties: {
    approved: { type: 'boolean' },
    summary: { type: 'string' },
    issues: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['approved', 'summary', 'issues', 'warnings'],
};

function asStrictSchema(schema: Record<string, any>): Record<string, any> {
  const copy = JSON.parse(JSON.stringify(schema));
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'object') node.additionalProperties = false;
    if (node.properties) Object.values(node.properties).forEach(visit);
    if (node.items) visit(node.items);
  };
  visit(copy);
  return copy;
}

function strictFormat(name: string, schema: Record<string, any>) {
  return { type: 'json_schema', json_schema: { name, strict: true, schema: asStrictSchema(schema) } };
}

async function requestJson<T>(
  prompt: string,
  name: string,
  schema: Record<string, any>,
  temperature = 0.5,
  endpoint = '/api/generate',
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model: STORY_MODEL, temperature, response_format: strictFormat(name, schema) }),
    });
    let result: { content?: string; error?: string; retryable?: boolean };
    try {
      result = await response.json();
    } catch {
      throw new Error('Il servizio AI ha restituito una risposta non leggibile. Riprova.');
    }
    if (response.status === 429 && attempt < 2) {
      const retryHeader = response.headers.get('Retry-After');
      const messageDelay = result.error?.match(/(?:circa|in)\s+(\d+(?:[.,]\d+)?)\s*(?:secondi|s)/i)?.[1]?.replace(',', '.');
      const delaySeconds = Number(retryHeader ?? messageDelay ?? 15);
      if (Number.isFinite(delaySeconds) && delaySeconds > 120) {
        throw new Error(`${name}: ${result.error || 'Limite temporaneo del servizio AI. Riprova più tardi.'}`);
      }
      const safeDelaySeconds = Number.isFinite(delaySeconds) ? Math.min(120, Math.max(1, Math.ceil(delaySeconds))) : 15;
      await new Promise((resolve) => setTimeout(resolve, safeDelaySeconds * 1000));
      continue;
    }
    if (response.status === 502 && result.retryable && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    if (!response.ok || result.error) {
      throw new Error(`${name}: ${result.error || `il servizio AI non ha completato la fase (HTTP ${response.status}).`}`);
    }
    if (typeof result.content !== 'string') throw new Error('Il servizio AI non ha restituito il contenuto richiesto.');
    try {
      return JSON.parse(result.content) as T;
    } catch {
      throw new Error('Il servizio AI ha restituito dati incompleti. Riprova con un altro tema.');
    }
  }
  throw new Error('Il servizio AI è ancora al limite: attendi circa un minuto e riprova.');
}

const normalizeName = (name: string) => name.trim().normalize('NFC').toLocaleLowerCase('it');
const countWords = (value: unknown) => typeof value === 'string' ? (value.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length : 0;

function validateBible(bible: StoryBible, playerCount: number): string[] {
  const issues: string[] = [];
  if (!bible || !bible.commonDocument || !bible.solution || !Array.isArray(bible.characterPlans)) {
    return ['Il canovaccio non contiene i campi richiesti.'];
  }
  if (bible.characterPlans.length !== playerCount) issues.push(`Il canovaccio contiene ${bible.characterPlans.length} personaggi invece di ${playerCount}.`);
  const names = bible.characterPlans.map((plan) => plan?.name?.trim() ?? '');
  if (names.some((name) => !name) || new Set(names.map(normalizeName)).size !== names.length) {
    issues.push('I nomi dei personaggi mancano o non sono univoci.');
  }
  const nameSet = new Set(names.map(normalizeName));
  const victim = typeof bible.victimName === 'string' ? bible.victimName.trim() : '';
  if (!victim || nameSet.has(normalizeName(victim))) issues.push('La vittima deve avere un nome distinto dai partecipanti e non occupare una scheda giocatore.');
  const timelineNames = new Set([...nameSet, normalizeName(victim)]);
  const common = bible.commonDocument;
  for (const [field, minimum, label] of [
    ['introduction', STORY_CONTENT_LIMITS.commonIntroduction, 'introduzione'],
    ['crimeSceneMapDescription', STORY_CONTENT_LIMITS.crimeScene, 'descrizione della scena'],
  ] as const) {
    if (countWords(common[field]) < minimum) issues.push(`Il campo ${label} deve contenere almeno ${minimum} parole.`);
  }
  for (const [field, maximum, label] of [
    ['introduction', STORY_CONTENT_LIMITS.commonIntroductionMax, 'introduzione'],
    ['crimeSceneMapDescription', STORY_CONTENT_LIMITS.crimeSceneMax, 'descrizione della scena'],
  ] as const) {
    if (countWords(common[field]) > maximum) issues.push(`Il campo ${label} deve contenere al massimo ${maximum} parole.`);
  }
  if (countWords(common.characterOverviews) < playerCount * STORY_CONTENT_LIMITS.characterOverviewPerPlayer) {
    issues.push(`Il riepilogo dei personaggi deve contenere almeno ${playerCount * STORY_CONTENT_LIMITS.characterOverviewPerPlayer} parole, con un profilo per ogni partecipante.`);
  }
  if (countWords(common.characterOverviews) > playerCount * STORY_CONTENT_LIMITS.characterOverviewMaxPerPlayer) {
    issues.push(`Il riepilogo dei personaggi deve contenere al massimo ${playerCount * STORY_CONTENT_LIMITS.characterOverviewMaxPerPlayer} parole.`);
  }
  const overviewEntries = typeof common.characterOverviews === 'string'
    ? common.characterOverviews.split(/\r?\n\s*\r?\n/u).map((entry) => entry.trim()).filter(Boolean)
    : [];
  if (overviewEntries.length !== playerCount) issues.push(`Il riepilogo del cast deve contenere un paragrafo distinto per ciascuno dei ${playerCount} personaggi.`);
  for (const entry of overviewEntries) {
    const entryWords = countWords(entry);
    if (entryWords < STORY_CONTENT_LIMITS.characterOverviewPerPlayer || entryWords > STORY_CONTENT_LIMITS.characterOverviewMaxPerPlayer) {
      issues.push(`Ogni profilo pubblico deve contenere ${STORY_CONTENT_LIMITS.characterOverviewPerPlayer}–${STORY_CONTENT_LIMITS.characterOverviewMaxPerPlayer} parole.`);
    }
  }
  for (const name of names) {
    if (name && !common.characterOverviews?.toLocaleLowerCase('it').includes(name.toLocaleLowerCase('it'))) {
      issues.push(`Il riepilogo dei personaggi deve citare «${name}».`);
    }
  }
  if (countWords(bible.solution.motive) < STORY_CONTENT_LIMITS.motive) issues.push(`Il movente della soluzione deve contenere almeno ${STORY_CONTENT_LIMITS.motive} parole.`);
  if (countWords(bible.solution.how) < STORY_CONTENT_LIMITS.method) issues.push(`La ricostruzione del delitto deve contenere almeno ${STORY_CONTENT_LIMITS.method} parole.`);
  if (countWords(bible.solution.backstory) < STORY_CONTENT_LIMITS.backstory) issues.push(`Il retroscena della soluzione deve contenere almeno ${STORY_CONTENT_LIMITS.backstory} parole.`);
  if (countWords(bible.solution.motive) > STORY_CONTENT_LIMITS.motiveMax) issues.push(`Il movente della soluzione deve contenere al massimo ${STORY_CONTENT_LIMITS.motiveMax} parole.`);
  if (countWords(bible.solution.how) > STORY_CONTENT_LIMITS.methodMax) issues.push(`La ricostruzione del delitto deve contenere al massimo ${STORY_CONTENT_LIMITS.methodMax} parole.`);
  if (countWords(bible.solution.backstory) > STORY_CONTENT_LIMITS.backstoryMax) issues.push(`Il retroscena della soluzione deve contenere al massimo ${STORY_CONTENT_LIMITS.backstoryMax} parole.`);
  if (!Array.isArray(bible.solution.deductionChain) || bible.solution.deductionChain.length < STORY_CONTENT_LIMITS.deductionSteps) {
    issues.push(`La deduzione deve contenere almeno ${STORY_CONTENT_LIMITS.deductionSteps} passaggi.`);
  } else {
    if (bible.solution.deductionChain.length > STORY_CONTENT_LIMITS.deductionStepsMax) issues.push(`La deduzione deve contenere al massimo ${STORY_CONTENT_LIMITS.deductionStepsMax} passaggi.`);
    bible.solution.deductionChain.forEach((step, index) => {
    if (countWords(step) < STORY_CONTENT_LIMITS.deductionStep) issues.push(`Il passaggio ${index + 1} della deduzione deve contenere almeno ${STORY_CONTENT_LIMITS.deductionStep} parole.`);
    if (countWords(step) > STORY_CONTENT_LIMITS.deductionStepMax) issues.push(`Il passaggio ${index + 1} della deduzione deve contenere al massimo ${STORY_CONTENT_LIMITS.deductionStepMax} parole.`);
    });
  }
  const timeline = bible.timeline;
  if (!Array.isArray(timeline) || timeline.length < 4) {
    issues.push('La cronologia canonica deve contenere almeno quattro eventi.');
  } else {
    const ids = new Set<string>();
    let previousTime = -1;
    timeline.forEach((event, index) => {
      const minutes = typeof event?.time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(event.time)
        ? Number(event.time.slice(0, 2)) * 60 + Number(event.time.slice(3))
        : -1;
      if (!event?.id?.trim() || ids.has(event.id)) issues.push('Gli eventi della cronologia devono avere identificativi univoci.');
      else ids.add(event.id);
      if (minutes < 0 || minutes <= previousTime) issues.push(`La cronologia deve avere orari HH:MM validi e in ordine crescente (evento ${index + 1}).`);
      previousTime = minutes;
      if (!event?.location?.trim() || !event?.event?.trim() || !Array.isArray(event.characters) || !event.characters.length) {
        issues.push(`L’evento ${index + 1} della cronologia deve specificare luogo, fatto e personaggi coinvolti.`);
      } else if (event.characters.some((name) => !timelineNames.has(normalizeName(name)))) {
        issues.push(`L’evento ${index + 1} cita un personaggio assente dal cast.`);
      }
    });
  }
  const culpritNames = bible.solution.culprits ?? [];
  if (culpritNames.length !== 1 || culpritNames.some((name) => !nameSet.has(normalizeName(name)))) {
    issues.push('La soluzione deve indicare un solo colpevole presente nel cast.');
  }
  const decisiveRecipients = new Set<string>();
  const clueIds = new Set<string>();
  const roundsWithDecisiveClue = new Set<number>();
  let corroboratingCount = 0;
  let redHerringCount = 0;
  for (const plan of bible.characterPlans) {
    const relationTargets = Array.isArray(plan?.relationshipFacts) ? plan.relationshipFacts.map((relation) => normalizeName(relation.characterName)) : [];
    if (relationTargets.length !== 3 || new Set(relationTargets).size !== 3 || relationTargets.some((target) => target === normalizeName(plan.name) || !nameSet.has(target))) {
      issues.push(`Il personaggio «${plan?.name || 'senza nome'}» deve avere tre relazioni distinte con altri personaggi del cast.`);
    }
    if (Array.isArray(plan?.relationshipFacts) && plan.relationshipFacts.some((relation) => countWords(relation.fact) < 12)) {
      issues.push(`Le relazioni di «${plan?.name || 'senza nome'}» devono descrivere fatti specifici e completi.`);
    }
    const clues = plan?.cluePlan;
    if (!Array.isArray(clues) || clues.length !== 3 || new Set(clues.map((clue) => clue.round)).size !== 3) {
      issues.push(`La scheda di «${plan?.name || 'personaggio senza nome'}» deve avere un indizio per ciascuno dei tre round.`);
      continue;
    }
    for (const clue of clues) {
      if (!clue?.id || clueIds.has(clue.id)) issues.push('Gli identificativi degli indizi devono essere presenti e univoci.');
      else clueIds.add(clue.id);
      if (![1, 2, 3].includes(clue.round) || !['decisive', 'corroborating', 'red-herring'].includes(clue.type)) {
        issues.push(`Un indizio assegnato a «${plan.name}» ha round o categoria non validi.`);
      }
      if (!clue.title?.trim() || !clue.content?.trim() || !clue.solutionLink?.trim() || !clue.organizerNote?.trim()) {
        issues.push(`Un indizio assegnato a «${plan.name}» è incompleto.`);
      }
      if (countWords(clue.content) < STORY_CONTENT_LIMITS.clue || countWords(clue.content) > STORY_CONTENT_LIMITS.clueMax) {
        issues.push(`L’indizio «${clue.title || 'senza titolo'}» deve contenere ${STORY_CONTENT_LIMITS.clue}–${STORY_CONTENT_LIMITS.clueMax} parole.`);
      }
      if (countWords(clue.solutionLink) < STORY_CONTENT_LIMITS.clueSolutionLink || countWords(clue.solutionLink) > STORY_CONTENT_LIMITS.clueSolutionLinkMax) {
        issues.push(`Il collegamento dell’indizio «${clue.title || 'senza titolo'}» deve contenere ${STORY_CONTENT_LIMITS.clueSolutionLink}–${STORY_CONTENT_LIMITS.clueSolutionLinkMax} parole.`);
      }
      if (countWords(clue.organizerNote) < STORY_CONTENT_LIMITS.clueOrganizerNote || countWords(clue.organizerNote) > STORY_CONTENT_LIMITS.clueOrganizerNoteMax) {
        issues.push(`La nota organizzatore dell’indizio «${clue.title || 'senza titolo'}» deve contenere ${STORY_CONTENT_LIMITS.clueOrganizerNote}–${STORY_CONTENT_LIMITS.clueOrganizerNoteMax} parole.`);
      }
      if (clue.type === 'decisive') {
        roundsWithDecisiveClue.add(clue.round);
        if (!culpritNames.some((culprit) => normalizeName(culprit) === normalizeName(plan.name))) decisiveRecipients.add(normalizeName(plan.name));
      }
      if (clue.type === 'corroborating') corroboratingCount += 1;
      if (clue.type === 'red-herring') redHerringCount += 1;
    }
  }
  if (roundsWithDecisiveClue.size < 3) issues.push('Serve almeno un indizio decisivo in ciascuno dei tre round.');
  if (decisiveRecipients.size < 3) issues.push('Gli indizi decisivi devono essere assegnati ad almeno tre innocenti distinti.');
  if (!corroboratingCount) issues.push('Serve almeno un indizio corroborante.');
  if (!redHerringCount) issues.push('Serve almeno un depistaggio plausibile.');
  return issues;
}

function validateCharacterBatch(characters: StoryData['characters'], expectedPlans: CharacterPlan[], allNames: string[]): string[] {
  if (!Array.isArray(characters) || characters.length !== expectedPlans.length) {
    return [`La fase schede ha restituito ${characters?.length ?? 0} personaggi invece dei ${expectedPlans.length} richiesti.`];
  }
  const expected = new Set(expectedPlans.map((plan) => normalizeName(plan.name)));
  const received = new Set(characters.map((character) => normalizeName(character?.name ?? '')));
  const issues: string[] = [];
  if (received.size !== characters.length || [...expected].some((name) => !received.has(name))) {
    issues.push('I nomi restituiti non coincidono con quelli del canovaccio.');
  }
  for (const character of characters) {
    const ownName = normalizeName(character.name);
    const minimumLengths: Array<[keyof StoryData['characters'][number], number]> = [
      ['initialDescription', STORY_CONTENT_LIMITS.initialDescription],
      ['relationships', STORY_CONTENT_LIMITS.relationships],
      ['round1Info', STORY_CONTENT_LIMITS.roundInfo],
      ['round2Info', STORY_CONTENT_LIMITS.roundInfo],
      ['round3Info', STORY_CONTENT_LIMITS.roundInfo],
      ['secretsAndMotives', STORY_CONTENT_LIMITS.secretsAndMotives],
    ];
    for (const [field, minimum] of minimumLengths) {
      const actual = countWords(character[field]);
      if (actual < minimum) issues.push(`La scheda di «${character.name}» è troppo breve in ${field} (${actual} parole, ne servono almeno ${minimum}).`);
    }
    const maximumLengths: Array<[keyof StoryData['characters'][number], number]> = [
      ['initialDescription', STORY_CONTENT_LIMITS.initialDescriptionMax], ['relationships', STORY_CONTENT_LIMITS.relationshipsMax],
      ['round1Info', STORY_CONTENT_LIMITS.roundInfoMax], ['round2Info', STORY_CONTENT_LIMITS.roundInfoMax],
      ['round3Info', STORY_CONTENT_LIMITS.roundInfoMax], ['secretsAndMotives', STORY_CONTENT_LIMITS.secretsAndMotivesMax],
    ];
    for (const [field, maximum] of maximumLengths) {
      const actual = countWords(character[field]);
      if (actual > maximum) issues.push(`La scheda di «${character.name}» è troppo lunga in ${field} (${actual} parole, massimo ${maximum}).`);
    }
    for (const [field, content] of [['round1Info', character.round1Info], ['round2Info', character.round2Info], ['round3Info', character.round3Info]] as const) {
      for (const label of ['Fatti che conosci:', 'Cosa puoi rivelare:', 'Obiettivo concreto:', 'Informazione nuova:']) {
        if (!content.includes(label)) issues.push(`La scheda di «${character.name}» in ${field} deve includere «${label}».`);
      }
      const objective = content.match(/Obiettivo concreto:\s*([\s\S]*?)(?=Informazione nuova:|$)/u)?.[1] ?? '';
      if (!allNames.some((name) => normalizeName(name) !== ownName && objective.toLocaleLowerCase('it').includes(name.toLocaleLowerCase('it')))) {
        issues.push(`L’obiettivo del round in ${field} deve nominare un altro personaggio.`);
      }
    }
    const opinions = character.opinionsOnOthers;
    const expectedOpinions = allNames.filter((name) => normalizeName(name) !== ownName).map(normalizeName);
    if (!Array.isArray(opinions) || opinions.length !== expectedOpinions.length) {
      issues.push(`La scheda di «${character.name}» deve contenere un’opinione su ciascuno degli altri partecipanti.`);
    } else {
      opinions.forEach((opinion) => {
        const actual = countWords(opinion.opinion);
        if (actual < STORY_CONTENT_LIMITS.opinionMin || actual > STORY_CONTENT_LIMITS.opinionMax) issues.push(`L’opinione di «${character.name}» su «${opinion.characterName}» deve contenere ${STORY_CONTENT_LIMITS.opinionMin}–${STORY_CONTENT_LIMITS.opinionMax} parole (${actual} trovate).`);
      });
      const opinionNames = opinions.map((opinion) => normalizeName(opinion.characterName));
      if (new Set(opinionNames).size !== opinionNames.length || expectedOpinions.some((name) => !opinionNames.includes(name))) {
        issues.push(`Le opinioni nella scheda di «${character.name}» hanno nomi mancanti o duplicati.`);
      }
    }
  }
  return issues;
}

function buildBiblePrompt(playerCount: number, theme: string, correction = ''): string {
  return `Fase: bibbia narrativa. Il numero di giocatori è: ${playerCount}. Tema: ${JSON.stringify(theme)}.
Progetta un caso originale, coerente e risolvibile per una cena con delitto italiana da 2–3 ore. Questa è la fonte canonica di ogni fatto: le successive schede dovranno rispettarla.

Indica in victimName il nome completo della vittima, un personaggio non giocante distinto dai partecipanti. La cronologia può citare la vittima e i nomi esatti dei partecipanti; le schede e i destinatari degli indizi includono solo i partecipanti. La storia ha un solo colpevole, un movente credibile, una cronologia verificabile e una catena di deduzioni spiegata in passaggi. La soluzione è dimostrabile usando solo informazioni distribuibili ai partecipanti. Il documento comune non deve rivelare colpevole né contenere spoiler.

Restituisci esattamente ${playerCount} piani personaggio con nomi e cognomi distinti. Ogni piano definisce ruolo pubblico, verità personale, segreto, movente o ragione del sospetto, alibi con orari e tre relazioni chiave coerenti; limita relationshipFacts a tre legami significativi per personaggio, non a tutti i possibili abbinamenti. Per ogni personaggio crea ESATTAMENTE tre indizi (uno per ciascun round), identificati univocamente. Ogni indizio è consegnato privatamente a quel personaggio; non inserire nella sua scheda informazioni che non potrebbe conoscere. Nel canovaccio descrivi ciascun indizio in 40–55 parole; il collegamento alla soluzione deve avere 15–45 parole e spiegare quale fatto verifica; la nota spoiler dell’organizzatore deve avere 10–45 parole. Distribuisci almeno tre indizi decisivi, uno per round e a destinatari innocenti differenti; includi indizi corroboranti e depistaggi con una spiegazione vera e non contraddittoria. Nessun depistaggio deve rendere falsa la soluzione.

Rispetta i limiti del dossier: introduzione comune 200–350 parole; descrizione della scena 200–350; profili nel riepilogo del cast 45–70 parole ciascuno, uno per paragrafo separato da una riga vuota e con nome completo; movente 120–200; ricostruzione del metodo 120–200; retroscena 200–300. La catena della soluzione deve avere 4–6 passaggi, ciascuno di 25–80 parole. Includi una cronologia canonica di almeno quattro eventi con identificativi univoci, orari HH:MM in ordine strettamente crescente, luogo, evento e nomi dei presenti. Deve coprire arrivi, ultimo avvistamento, finestra del delitto e scoperta del corpo. Non usare testo riempitivo o ripetuto: ogni paragrafo deve aggiungere informazioni utili.

Costruisci una trama originale, non grafica e adatta a un pubblico generale. Dai alle tre fasi un’escalation: sospetti e alibi nel primo round, riscontri e confronti nel secondo, collegamento probatorio e accusa nel terzo. Il crimine e il metodo devono rispettare i dettagli della scena e gli orari.
${correction ? `CORREGGI e rigenera il canovaccio risolvendo questi problemi: ${correction}` : ''}
Restituisci esclusivamente JSON conforme allo schema.`;
}

type TextRepairTarget = {
  path: string;
  minimum: number;
  maximum: number;
  read: () => string;
  write: (text: string) => void;
};

// Correct prose independently so a word-count miss cannot discard canonical facts.
async function repairBibleText(bible: StoryBible): Promise<void> {
  const targets: TextRepairTarget[] = [];
  const add = (record: Record<string, any>, key: string, path: string, minimum: number, maximum: number) => {
    if (!record || typeof record[key] !== 'string') return;
    targets.push({ path, minimum, maximum, read: () => record[key], write: (text) => { record[key] = text; } });
  };
  const limits = STORY_CONTENT_LIMITS;
  add(bible.commonDocument, 'introduction', 'commonDocument.introduction', limits.commonIntroduction, limits.commonIntroductionMax);
  add(bible.commonDocument, 'crimeSceneMapDescription', 'commonDocument.crimeSceneMapDescription', limits.crimeScene, limits.crimeSceneMax);
  add(bible.solution, 'motive', 'solution.motive', limits.motive, limits.motiveMax);
  add(bible.solution, 'how', 'solution.how', limits.method, limits.methodMax);
  add(bible.solution, 'backstory', 'solution.backstory', limits.backstory, limits.backstoryMax);
  if (Array.isArray(bible.solution?.deductionChain)) {
    bible.solution.deductionChain.forEach((_, index) => add(bible.solution.deductionChain, String(index), `solution.deductionChain[${index}]`, limits.deductionStep, limits.deductionStepMax));
  }
  if (Array.isArray(bible.characterPlans)) {
    bible.characterPlans.forEach((plan, index) => {
      if (Array.isArray(plan?.relationshipFacts)) {
        plan.relationshipFacts.forEach((relation, relationIndex) => add(relation, 'fact', `characterPlans[${index}].relationshipFacts[${relationIndex}].fact`, 12, 120));
      }
      if (!Array.isArray(plan?.cluePlan)) return;
      plan.cluePlan.forEach((clue, clueIndex) => {
        const path = `characterPlans[${index}].cluePlan[${clueIndex}]`;
        add(clue, 'content', `${path}.content`, limits.clue, limits.clueMax);
        add(clue, 'solutionLink', `${path}.solutionLink`, limits.clueSolutionLink, limits.clueSolutionLinkMax);
        add(clue, 'organizerNote', `${path}.organizerNote`, limits.clueOrganizerNote, limits.clueOrganizerNoteMax);
      });
    });
  }
  const overview = bible.commonDocument?.characterOverviews;
  if (typeof overview === 'string' && Array.isArray(bible.characterPlans)) {
    const entries = overview.split(/\r?\n\s*\r?\n/u).map((entry) => entry.trim()).filter(Boolean);
    if (entries.length === bible.characterPlans.length) {
      entries.forEach((_, index) => targets.push({
        path: `commonDocument.characterOverviews[${index}]`, minimum: limits.characterOverviewPerPlayer, maximum: limits.characterOverviewMaxPerPlayer,
        read: () => entries[index],
        write: (text) => { entries[index] = text; bible.commonDocument.characterOverviews = entries.join('\n\n'); },
      }));
    }
  }
  const canonicalContext = {
    title: bible.title, victimName: bible.victimName, timeline: bible.timeline, solution: bible.solution,
    cast: bible.characterPlans?.map((plan) => ({
      name: plan.name, publicRole: plan.publicRole, truth: plan.truth, privateSecret: plan.privateSecret,
      motive: plan.motive, alibiTimeline: plan.alibiTimeline, relationshipFacts: plan.relationshipFacts,
      clues: plan.cluePlan?.map((clue) => ({ id: clue.id, round: clue.round, title: clue.title, type: clue.type, solutionLink: clue.solutionLink })),
    })),
  };
  const invalid = () => targets.filter((target) => countWords(target.read()) < target.minimum || countWords(target.read()) > target.maximum);
  for (let attempt = 0; attempt < 3 && invalid().length; attempt += 1) {
    const pending = invalid();
    for (let index = 0; index < pending.length; index += 4) {
      const batch = pending.slice(index, index + 4);
      const properties = Object.fromEntries(batch.map((target, i) => [`text${i}`, { type: 'string', description: `${target.path}: ${target.minimum}–${target.maximum} parole italiane.` }]));
      const fields = batch.map((target, i) => ({
        key: `text${i}`, path: target.path, currentWords: countWords(target.read()), minimum: target.minimum, maximum: target.maximum,
        targetWords: Math.round((target.minimum + target.maximum) / 2), text: target.read(),
      }));
      const result = await requestJson<Record<string, string>>(
        `Correzione mirata dei testi del canovaccio. Riscrivi SOLO i campi richiesti, mirando al numero targetWords, ben lontano dai limiti. Conta le parole prima di rispondere. Il conteggio considera parole e numeri, con gli apostrofi interni parte della parola. Amplia con dettagli utili coerenti; niente ripetizioni o riempitivi. Conserva nomi, fatti, orari, colpevole, relazioni e valore probatorio. I campi pubblici non devono contenere spoiler. Non aggiungere nuove prove, fatti investigativi o rivelazioni. Restituisci ogni testo nella chiave assegnata.\nCAMPI:\n${JSON.stringify(fields)}\nCONTESTO CANONICO:\n${JSON.stringify(canonicalContext)}`,
        'bible_text_repair', { type: 'object', properties, required: Object.keys(properties) }, 0.25,
      );
      batch.forEach((target, i) => {
        const text = result[`text${i}`];
        const words = countWords(text);
        if (typeof text === 'string' && words >= target.minimum && words <= target.maximum) target.write(text);
      });
    }
  }
}

async function generateBible(playerCount: number, theme: string): Promise<StoryBible> {
  let correction = '';
  let lastIssues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const bible = await requestJson<StoryBible>(buildBiblePrompt(playerCount, theme, correction), 'story_bible', storyBibleSchema, 0.45);
    if (validateBible(bible, playerCount).length) await repairBibleText(bible);
    const issues = validateBible(bible, playerCount);
    if (!issues.length) return bible;
    lastIssues = issues;
    correction = issues.join(' ');
  }
  throw new Error(`Il canovaccio per ${playerCount} partecipanti non supera ancora i controlli automatici. Problema: ${lastIssues[0] ?? 'struttura incompleta'}. La correzione automatica non è riuscita a completare questi contenuti; riprova la generazione.`);
}

function buildCharacterPrompt(bible: StoryBible, plans: CharacterPlan[], playerCount: number, correction = ''): string {
  const safeBible = {
    title: bible.title,
    commonDocument: bible.commonDocument,
    timeline: bible.timeline,
    cast: bible.characterPlans.map(({ name, publicRole, relationshipFacts }) => ({ name, publicRole, relationshipFacts })),
    selectedCharacterPlans: plans,
    solutionFactsForInternalConsistency: bible.solution,
  };
  return `Fase: schede personaggio. Il numero di giocatori è: ${playerCount}. Genera le schede soltanto per questi nomi, senza aggiungerne o ometterne: ${plans.map((plan) => plan.name).join(', ')}.
La bibbia seguente è canonica. Non cambiare nome, ruolo, alibi, movente, relazioni, fatti o indizi. Ogni fatto contraddittorio è un errore. La soluzione è contesto privato per te: non rivelare colpevole, metodo o soluzione nelle descrizioni pubbliche, nei riassunti, nelle relazioni o nelle schede degli innocenti. Il colpevole può ricevere istruzioni private coerenti per interpretare il proprio segreto. Non copiare le note spoiler nelle schede.

Obiettivo: ogni scheda deve sostenere una partita di 2–3 ore ed essere sufficientemente ricca per circa 4–6 pagine stampate. Scrivi in italiano naturale, con paragrafi e dettagli concreti. Rispetta queste soglie: descrizione pubblica 100–140 parole; relazioni private 180–260; ciascun round 150–190; segreti e movente 180–260; ogni opinione sugli altri 45–65 parole. Le opinioni sono una per ciascuno degli altri personaggi, quindi il totale varia con il numero di partecipanti; non comprimere i testi per un limite complessivo.

Ogni round deve contenere queste sezioni etichettate esattamente: «Fatti che conosci:», «Cosa puoi rivelare:», «Obiettivo concreto:» e «Informazione nuova:». L’obiettivo deve nominare un altro personaggio e descrivere un’azione realizzabile al tavolo. La cronologia canonica è: ${JSON.stringify(bible.timeline)}. Ogni round avanza l’indagine con fatti compatibili con cronologia e indizi. Le opinioni devono riflettere relazioni e pregiudizi specifici, non ripetere la stessa formula. Includi un’opinione per tutti gli altri ${playerCount - 1} personaggi, con nomi esatti dal cast. Rispetta i limiti di conoscenza: un personaggio non sa automaticamente ciò che un altro custodisce nel proprio piano o indizio.

Bibbia canonica:
${JSON.stringify(safeBible)}
${correction ? `Correzione per questo batch: ${correction}` : ''}
Restituisci solo l'oggetto JSON con l'array characters e i ${plans.length} nomi indicati.`;
}

async function generateCharacterBatch(bible: StoryBible, plans: CharacterPlan[], playerCount: number): Promise<StoryData['characters']> {
  const names = bible.characterPlans.map((plan) => plan.name);
  let correction = '';
  let lastIssues: string[] = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await requestJson<{ characters: StoryData['characters'] }>(
      buildCharacterPrompt(bible, plans, playerCount, correction),
      'character_batch',
      characterSchema,
      0.6,
    );
    const issues = validateCharacterBatch(result.characters, plans, names);
    if (!issues.length) {
      const culpritNames = new Set(bible.solution.culprits.map(normalizeName));
      return result.characters.map((character) => ({
        ...character,
        name: plans.find((plan) => normalizeName(plan.name) === normalizeName(character.name))!.name,
        isCulprit: culpritNames.has(normalizeName(character.name)),
      }));
    }
    lastIssues = issues;
    correction = issues.join(' ');
  }
  throw new Error(`Non è stato possibile completare le schede di ${plans.map((plan) => plan.name).join(' e ')}. Controllo non superato: ${lastIssues[0] ?? 'contenuti incompleti'}. Riprova la generazione.`);
}

function composeStory(bible: StoryBible, characters: StoryData['characters']): StoryData {
  const evidence = bible.characterPlans.flatMap((plan) => plan.cluePlan.map((clue) => ({
    ...clue,
    recipients: [plan.name],
  }))) as EvidenceClue[];
  return {
    title: bible.title,
    commonDocument: bible.commonDocument,
    characters,
    evidence,
    solution: bible.solution,
  };
}

function buildVerificationPrompt(story: StoryData, playerCount: number, timeline: StoryBible['timeline']): string {
  return `Fase: verifica narrativa. Il numero di giocatori è: ${playerCount}.
Esamina questa storia completa come revisore indipendente di un gioco dal vivo. Confronta la cronologia canonica con alibi e orari, relazioni, round, indizi, destinatari, soluzione e deduzione. Controlla che il colpevole e il metodo non siano dichiarati nelle informazioni pubbliche o nelle schede degli innocenti; che ogni passaggio della deduzione sia sostenuto da indizi ottenibili; che i depistaggi siano spiegabili senza contraddire i fatti; che nomi e rapporti restino coerenti. Non modificare né riscrivere la storia: restituisci un rapporto JSON. approved è true solo se la soluzione è deducibile e non trovi contraddizioni sostanziali. Elenca in issues i problemi bloccanti e in warnings le migliorie facoltative. Sii concreto e cita nomi e indizi.

CRONOLOGIA CANONICA:
${JSON.stringify(timeline)}

STORIA:
${JSON.stringify(story)}
Rispondi esclusivamente con JSON conforme allo schema.`;
}

function verificationWarning(report?: { summary?: string; issues?: string[] }): string {
  const detail = [...(report?.issues ?? []), report?.summary ?? ''].filter(Boolean).join(' ');
  return detail ? `${VERIFICATION_WARNING} Esito: ${detail}` : VERIFICATION_WARNING;
}

export const generateMurderMysteryStory = async (playerCount: number, theme: string): Promise<StoryData> => {
  if (!Number.isInteger(playerCount) || playerCount < 4 || playerCount > 12) {
    throw new Error('Scegli un numero di partecipanti compreso tra 4 e 12.');
  }
  if (!theme?.trim()) throw new Error('Scegli un tema prima di generare la storia.');

  let story: StoryData;
  let canonicalTimeline: StoryBible['timeline'] = [];
  try {
    const bible = await generateBible(playerCount, theme.trim());
    canonicalTimeline = bible.timeline;
    const characters: StoryData['characters'] = [];
    for (let index = 0; index < bible.characterPlans.length; index += CHARACTER_BATCH_SIZE) {
      const batch = bible.characterPlans.slice(index, index + CHARACTER_BATCH_SIZE);
      characters.push(...await generateCharacterBatch(bible, batch, playerCount));
    }
    story = composeStory(bible, characters);
  } catch (error) {
    console.error('Errore nella generazione narrativa Groq:', error instanceof Error ? error.message : 'Errore sconosciuto.');
    if (error instanceof Error) throw error;
    throw new Error('Non è stato possibile completare la storia con l’AI. Attendi qualche secondo e riprova.');
  }

  const originalAudit = auditStoryQuality(story, playerCount);
  if (!originalAudit.valid) {
    throw new Error(`La storia generata non ha superato i controlli di completezza: ${originalAudit.errors.slice(0, 3).join(' ')}`);
  }

  try {
    const report = await requestJson<{ approved: boolean; summary: string; issues: string[]; warnings: string[] }>(
      buildVerificationPrompt(story, playerCount, canonicalTimeline),
      'story_verification',
      verificationSchema,
      0.1,
      '/api/verify',
    );
    const verifiedAudit = auditStoryQuality(story, playerCount);
    if (!report.approved || report.issues.length || !verifiedAudit.valid) {
      const issues = [...report.issues, ...verifiedAudit.errors];
      console.warn('La revisione narrativa ha segnalato problemi; si restituisce la storia generata con avviso.', issues);
      return { ...story, verificationWarning: verificationWarning({ summary: report.summary, issues }) };
    }
    if (report.warnings.length) {
      return { ...story, verificationWarning: `La storia è stata verificata; l’organizzatore può valutare queste note: ${report.warnings.join(' ')}` };
    }
    return story;
  } catch (error) {
    console.warn('La verifica AI non è riuscita; si conserva la storia completa generata.', error);
    return { ...story, verificationWarning: verificationWarning() };
  }
};
