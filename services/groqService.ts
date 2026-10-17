import type { EvidenceClue, StoryData } from '../types';
import { auditStoryQuality } from './storyQuality';

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
  required: ['title', 'commonDocument', 'solution', 'characterPlans'],
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
      if (Number.isFinite(delaySeconds) && delaySeconds > 30) {
        throw new Error(`${name}: ${result.error || 'Limite temporaneo del servizio AI. Riprova più tardi.'}`);
      }
      const safeDelaySeconds = Number.isFinite(delaySeconds) ? Math.min(30, Math.max(1, Math.ceil(delaySeconds))) : 15;
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
  const culpritNames = bible.solution.culprits ?? [];
  if (!culpritNames.length || culpritNames.some((name) => !nameSet.has(normalizeName(name)))) {
    issues.push('La soluzione deve indicare almeno un colpevole presente nel cast.');
  }
  const clueIds = new Set<string>();
  const roundsWithDecisiveClue = new Set<number>();
  let corroboratingCount = 0;
  let redHerringCount = 0;
  for (const plan of bible.characterPlans) {
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
      if (countWords(clue.content) < 30) {
        issues.push(`L’indizio «${clue.title || 'senza titolo'}» è troppo breve per essere utile al tavolo.`);
      }
      if (clue.type === 'decisive') roundsWithDecisiveClue.add(clue.round);
      if (clue.type === 'corroborating') corroboratingCount += 1;
      if (clue.type === 'red-herring') redHerringCount += 1;
    }
  }
  if (roundsWithDecisiveClue.size < 3) issues.push('Serve almeno un indizio decisivo in ciascuno dei tre round.');
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
      ['initialDescription', 100],
      ['relationships', 165],
      ['round1Info', 140],
      ['round2Info', 140],
      ['round3Info', 140],
      ['secretsAndMotives', 165],
    ];
    for (const [field, minimum] of minimumLengths) {
      const actual = countWords(character[field]);
      if (actual < minimum) issues.push(`La scheda di «${character.name}» è troppo breve in ${field} (${actual} parole, ne servono almeno ${minimum}).`);
    }
    const opinions = character.opinionsOnOthers;
    const expectedOpinions = allNames.filter((name) => normalizeName(name) !== ownName).map(normalizeName);
    if (!Array.isArray(opinions) || opinions.length !== expectedOpinions.length) {
      issues.push(`La scheda di «${character.name}» deve contenere un’opinione su ciascuno degli altri partecipanti.`);
    } else {
      opinions.forEach((opinion) => {
        const actual = countWords(opinion.opinion);
        if (actual < 40) issues.push(`L’opinione di «${character.name}» su «${opinion.characterName}» è troppo breve (${actual} parole, ne servono almeno 40).`);
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

La storia ha un solo colpevole, un movente credibile, una cronologia verificabile e una catena di deduzioni spiegata in passaggi. La soluzione è dimostrabile usando solo informazioni distribuibili ai partecipanti. Il documento comune non deve rivelare colpevole né contenere spoiler.

Restituisci esattamente ${playerCount} piani personaggio con nomi e cognomi distinti. Ogni piano definisce ruolo pubblico, verità personale, segreto, movente o ragione del sospetto, alibi con orari e tre relazioni chiave coerenti; limita relationshipFacts a tre legami significativi per personaggio, non a tutti i possibili abbinamenti. Per ogni personaggio crea ESATTAMENTE tre indizi (uno per ciascun round), identificati univocamente. Ogni indizio è consegnato privatamente a quel personaggio; non inserire nella sua scheda informazioni che non potrebbe conoscere. Nel canovaccio descrivi ciascun indizio in 40–55 parole, indica quale fatto verifica e aggiungi una nota spoiler breve per l’organizzatore. Distribuisci almeno tre indizi decisivi, uno per round e a destinatari innocenti differenti; includi indizi corroboranti e depistaggi con una spiegazione vera e non contraddittoria. Nessun depistaggio deve rendere falsa la soluzione.

Costruisci una trama originale, non grafica e adatta a un pubblico generale. Dai alle tre fasi un’escalation: sospetti e alibi nel primo round, riscontri e confronti nel secondo, collegamento probatorio e accusa nel terzo. Il crimine e il metodo devono rispettare i dettagli della scena e gli orari.
${correction ? `CORREGGI e rigenera il canovaccio risolvendo questi problemi: ${correction}` : ''}
Restituisci esclusivamente JSON conforme allo schema.`;
}

async function generateBible(playerCount: number, theme: string): Promise<StoryBible> {
  let correction = '';
  let lastIssues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const bible = await requestJson<StoryBible>(buildBiblePrompt(playerCount, theme, correction), 'story_bible', storyBibleSchema, 0.45);
    const issues = validateBible(bible, playerCount);
    if (!issues.length) return bible;
    lastIssues = issues;
    correction = issues.join(' ');
  }
  throw new Error(`Il canovaccio per ${playerCount} partecipanti non supera ancora i controlli automatici. Problema: ${lastIssues[0] ?? 'struttura incompleta'}. Riprova con un tema più semplice.`);
}

function buildCharacterPrompt(bible: StoryBible, plans: CharacterPlan[], playerCount: number, correction = ''): string {
  const safeBible = {
    title: bible.title,
    commonDocument: bible.commonDocument,
    cast: bible.characterPlans.map(({ name, publicRole, relationshipFacts }) => ({ name, publicRole, relationshipFacts })),
    selectedCharacterPlans: plans,
    solutionFactsForInternalConsistency: bible.solution,
  };
  return `Fase: schede personaggio. Il numero di giocatori è: ${playerCount}. Genera le schede soltanto per questi nomi, senza aggiungerne o ometterne: ${plans.map((plan) => plan.name).join(', ')}.
La bibbia seguente è canonica. Non cambiare nome, ruolo, alibi, movente, relazioni, fatti o indizi. Ogni fatto contraddittorio è un errore. La soluzione è contesto privato per te: non rivelare colpevole, metodo o soluzione nelle descrizioni pubbliche, nei riassunti, nelle relazioni o nelle schede degli innocenti. Il colpevole può ricevere istruzioni private coerenti per interpretare il proprio segreto. Non copiare le note spoiler nelle schede.

Obiettivo: ogni scheda deve sostenere una partita di 2–3 ore ed essere sufficientemente ricca per circa 4–6 pagine stampate. Scrivi in italiano naturale, con paragrafi e dettagli concreti. Per ciascun personaggio produci circa 1.000–1.300 parole complessive: descrizione pubblica 100–140 parole; relazioni private almeno 180; ciascun round 150–190; segreti e movente almeno 180; ogni opinione sugli altri 45–65 parole. Non comprimere le risposte in riassunti o elenchi telegrafici.

Ogni round deve avere un’intestazione leggibile e contenere: fatti che il personaggio sa in quel momento, cosa può rivelare, una motivazione per partecipare alla conversazione, un obiettivo concreto rivolto a una persona nominata e un’informazione nuova che faccia avanzare l’indagine. Gli obiettivi devono essere realizzabili al tavolo. Le opinioni devono riflettere relazioni e pregiudizi specifici, non ripetere la stessa formula. Includi un’opinione per tutti gli altri ${playerCount - 1} personaggi, con nomi esatti dal cast. Rispetta i limiti di conoscenza: un personaggio non sa automaticamente ciò che un altro custodisce nel proprio piano o indizio.

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

function buildVerificationPrompt(story: StoryData, playerCount: number): string {
  return `Fase: verifica narrativa. Il numero di giocatori è: ${playerCount}.
Esamina questa storia completa come revisore indipendente di un gioco dal vivo. Confronta canovaccio, alibi e orari, relazioni, round, indizi, destinatari, soluzione e deduzione. Controlla che il colpevole e il metodo non siano dichiarati nelle informazioni pubbliche o nelle schede degli innocenti; che ogni passaggio della deduzione sia sostenuto da indizi ottenibili; che i depistaggi siano spiegabili senza contraddire i fatti; che nomi e rapporti restino coerenti. Non modificare né riscrivere la storia: restituisci un rapporto JSON. approved è true solo se la soluzione è deducibile e non trovi contraddizioni sostanziali. Elenca in issues i problemi bloccanti e in warnings le migliorie facoltative. Sii concreto e cita nomi e indizi.

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
  try {
    const bible = await generateBible(playerCount, theme.trim());
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
      buildVerificationPrompt(story, playerCount),
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
