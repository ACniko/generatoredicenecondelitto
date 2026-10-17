import type { EvidenceClue, StoryData } from '../types';

export interface StoryQualityAudit {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const CLUE_TYPES = ['decisive', 'corroborating', 'red-herring'] as const;
export const STORY_CONTENT_LIMITS = {
  commonIntroduction: 200,
  commonIntroductionMax: 350,
  crimeScene: 200,
  crimeSceneMax: 350,
  characterOverviewPerPlayer: 45,
  characterOverviewMaxPerPlayer: 70,
  initialDescription: 100,
  initialDescriptionMax: 140,
  relationships: 180,
  relationshipsMax: 260,
  roundInfo: 150,
  roundInfoMax: 190,
  secretsAndMotives: 180,
  secretsAndMotivesMax: 260,
  opinionMin: 45,
  opinionMax: 65,
  motive: 120,
  motiveMax: 200,
  method: 120,
  methodMax: 200,
  backstory: 200,
  backstoryMax: 300,
  deductionSteps: 4,
  deductionStepsMax: 6,
  deductionStep: 25,
  deductionStepMax: 80,
  clue: 40,
  clueMax: 55,
  clueSolutionLink: 15,
  clueSolutionLinkMax: 45,
  clueOrganizerNote: 10,
  clueOrganizerNoteMax: 45,
} as const;
const ROUND_LABELS = ['Fatti che conosci:', 'Cosa puoi rivelare:', 'Obiettivo concreto:', 'Informazione nuova:'] as const;
const REQUIRED_CHARACTER_TEXT_FIELDS = [
  'initialDescription',
  'relationships',
  'round1Info',
  'round2Info',
  'round3Info',
  'secretsAndMotives',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function wordCount(value: unknown): number {
  return typeof value === 'string' ? (value.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length : 0;
}

function normalizedName(value: string): string {
  return value.trim().normalize('NFC').toLocaleLowerCase('it');
}

function addRequiredTextError(
  errors: string[],
  value: unknown,
  label: string,
): void {
  if (!nonEmptyString(value)) errors.push(`Il campo «${label}» è vuoto o mancante.`);
}

function addMinimumWordsError(errors: string[], value: unknown, label: string, minimum: number): void {
  if (nonEmptyString(value) && wordCount(value) < minimum) {
    errors.push(`Il campo «${label}» è troppo breve: servono almeno ${minimum} parole.`);
  }
}

function addMaximumWordsError(errors: string[], value: unknown, label: string, maximum: number): void {
  if (nonEmptyString(value) && wordCount(value) > maximum) {
    errors.push(`Il campo «${label}» è troppo lungo: massimo ${maximum} parole.`);
  }
}

function asClue(value: unknown): value is EvidenceClue {
  return isRecord(value);
}

/**
 * Checks the structural playability contract for an AI-generated story.
 * It cannot establish that prose, motives, timelines, or deductions are
 * narratively coherent; those still need a model or human review.
 */
export function auditStoryQuality(
  input: unknown,
  expectedPlayerCount: number,
): StoryQualityAudit {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Number.isInteger(expectedPlayerCount) || expectedPlayerCount < 4 || expectedPlayerCount > 12) {
    errors.push('Il numero richiesto di partecipanti deve essere un intero tra 4 e 12.');
  }
  if (!isRecord(input)) {
    return { valid: false, errors: ['La storia generata non è un oggetto valido.'], warnings };
  }

  addRequiredTextError(errors, input.title, 'titolo');

  const commonDocument = input.commonDocument;
  if (!isRecord(commonDocument)) {
    errors.push('Il documento comune è assente o non valido.');
  } else {
    addRequiredTextError(errors, commonDocument.introduction, 'introduzione');
    addRequiredTextError(errors, commonDocument.crimeSceneMapDescription, 'descrizione della scena del crimine');
    addRequiredTextError(errors, commonDocument.characterOverviews, 'riepilogo dei personaggi');
    addMinimumWordsError(errors, commonDocument.introduction, 'introduzione', STORY_CONTENT_LIMITS.commonIntroduction);
    addMinimumWordsError(errors, commonDocument.crimeSceneMapDescription, 'descrizione della scena del crimine', STORY_CONTENT_LIMITS.crimeScene);
    addMinimumWordsError(errors, commonDocument.characterOverviews, 'riepilogo dei personaggi', expectedPlayerCount * STORY_CONTENT_LIMITS.characterOverviewPerPlayer);
    addMaximumWordsError(errors, commonDocument.introduction, 'introduzione', STORY_CONTENT_LIMITS.commonIntroductionMax);
    addMaximumWordsError(errors, commonDocument.crimeSceneMapDescription, 'descrizione della scena del crimine', STORY_CONTENT_LIMITS.crimeSceneMax);
    addMaximumWordsError(errors, commonDocument.characterOverviews, 'riepilogo dei personaggi', expectedPlayerCount * STORY_CONTENT_LIMITS.characterOverviewMaxPerPlayer);
  }

  const characters = Array.isArray(input.characters) ? input.characters : [];
  if (!Array.isArray(input.characters)) {
    errors.push('La lista dei personaggi è assente o non valida.');
  }
  if (characters.length !== expectedPlayerCount) {
    errors.push(`La storia contiene ${characters.length} personaggi; sono richiesti ${expectedPlayerCount} personaggi.`);
  }

  const validCharacters: Array<Record<string, unknown>> = [];
  const names = new Map<string, Record<string, unknown>>();
  characters.forEach((character, index) => {
    const position = index + 1;
    if (!isRecord(character)) {
      errors.push(`Il personaggio ${position} non è un oggetto valido.`);
      return;
    }
    validCharacters.push(character);

    if (!nonEmptyString(character.name)) {
      errors.push(`Il personaggio ${position} deve avere un nome non vuoto.`);
    } else {
      const key = normalizedName(character.name);
      if (names.has(key)) errors.push(`I nomi dei personaggi devono essere univoci: «${character.name.trim()}» è duplicato.`);
      else names.set(key, character);
    }
    if (typeof character.isCulprit !== 'boolean') {
      errors.push(`Il campo «colpevole» del personaggio ${position} deve essere booleano.`);
    }
    for (const field of REQUIRED_CHARACTER_TEXT_FIELDS) {
      addRequiredTextError(errors, character[field], `personaggio ${position}: ${field}`);
    }
    const maximumFieldWords: Record<(typeof REQUIRED_CHARACTER_TEXT_FIELDS)[number], number> = {
      initialDescription: STORY_CONTENT_LIMITS.initialDescriptionMax,
      relationships: STORY_CONTENT_LIMITS.relationshipsMax,
      round1Info: STORY_CONTENT_LIMITS.roundInfoMax,
      round2Info: STORY_CONTENT_LIMITS.roundInfoMax,
      round3Info: STORY_CONTENT_LIMITS.roundInfoMax,
      secretsAndMotives: STORY_CONTENT_LIMITS.secretsAndMotivesMax,
    };
    for (const field of REQUIRED_CHARACTER_TEXT_FIELDS) addMaximumWordsError(errors, character[field], `personaggio ${position}: ${field}`, maximumFieldWords[field]);

    const minimumFieldWords: Record<(typeof REQUIRED_CHARACTER_TEXT_FIELDS)[number], number> = {
      initialDescription: STORY_CONTENT_LIMITS.initialDescription,
      relationships: STORY_CONTENT_LIMITS.relationships,
      round1Info: STORY_CONTENT_LIMITS.roundInfo,
      round2Info: STORY_CONTENT_LIMITS.roundInfo,
      round3Info: STORY_CONTENT_LIMITS.roundInfo,
      secretsAndMotives: STORY_CONTENT_LIMITS.secretsAndMotives,
    };
    for (const field of REQUIRED_CHARACTER_TEXT_FIELDS) {
      if (nonEmptyString(character[field]) && wordCount(character[field]) < minimumFieldWords[field]) {
        errors.push(`La scheda ${position} è troppo breve in ${field}: servono almeno ${minimumFieldWords[field]} parole.`);
      }
    }

    for (const field of ['round1Info', 'round2Info', 'round3Info'] as const) {
      const roundText = character[field];
      if (!nonEmptyString(roundText)) continue;
      for (const label of ROUND_LABELS) {
        if (!roundText.includes(label)) errors.push(`La scheda ${position} in ${field} deve includere la sezione «${label}».`);
      }
      const objective = roundText.match(/Obiettivo concreto:\s*([\s\S]*?)(?=Informazione nuova:|$)/u)?.[1] ?? '';
      const otherNames = characters.filter(isRecord)
        .map((other) => other.name)
        .filter((name): name is string => nonEmptyString(name) && normalizedName(name) !== normalizedName(String(character.name ?? '')));
      if (!otherNames.some((name) => objective.toLocaleLowerCase('it').includes(name.trim().toLocaleLowerCase('it')))) {
        errors.push(`La scheda ${position} in ${field}: «Obiettivo concreto:» deve nominare un altro personaggio.`);
      }
    }

    const opinions = character.opinionsOnOthers;
    if (!Array.isArray(opinions)) {
      errors.push(`Le opinioni del personaggio ${position} sono assenti o non valide.`);
    } else {
      const actualOpinionNames = new Set<string>();
      const knownNameSet = new Set(characters.filter(isRecord).filter((candidate) => nonEmptyString(candidate.name)).map((candidate) => normalizedName(candidate.name as string)));
      opinions.forEach((opinion, opinionIndex) => {
        if (!isRecord(opinion)) {
          errors.push(`L’opinione ${opinionIndex + 1} del personaggio ${position} non è valida.`);
          return;
        }
        addRequiredTextError(errors, opinion.characterName, `personaggio ${position}: nome nell’opinione ${opinionIndex + 1}`);
        addRequiredTextError(errors, opinion.opinion, `personaggio ${position}: testo dell’opinione ${opinionIndex + 1}`);
        if (nonEmptyString(opinion.opinion) && wordCount(opinion.opinion) < STORY_CONTENT_LIMITS.opinionMin) {
          errors.push(`L’opinione ${opinionIndex + 1} del personaggio ${position} è troppo breve: servono almeno ${STORY_CONTENT_LIMITS.opinionMin} parole.`);
        }
        if (nonEmptyString(opinion.opinion) && wordCount(opinion.opinion) > STORY_CONTENT_LIMITS.opinionMax) {
          errors.push(`L’opinione ${opinionIndex + 1} del personaggio ${position} è troppo lunga: massimo ${STORY_CONTENT_LIMITS.opinionMax} parole.`);
        }
        if (nonEmptyString(opinion.characterName) && knownNameSet.has(normalizedName(opinion.characterName))) {
          actualOpinionNames.add(normalizedName(opinion.characterName));
        }
      });
      const expectedOthers = new Set([...knownNameSet].filter((name) => name !== normalizedName(character.name as string)));
      if (actualOpinionNames.size !== expectedOthers.size || [...expectedOthers].some((name) => !actualOpinionNames.has(name))) {
        errors.push(`Il personaggio «${String(character.name).trim()}» deve avere un’opinione distinta su ciascun altro partecipante.`);
      }
    }
  });

  if (isRecord(commonDocument) && nonEmptyString(commonDocument.characterOverviews)) {
    const overview = commonDocument.characterOverviews.toLocaleLowerCase('it');
    for (const character of validCharacters) {
      if (nonEmptyString(character.name) && !overview.includes(character.name.trim().toLocaleLowerCase('it'))) {
        errors.push(`Il riepilogo dei personaggi deve citare «${character.name.trim()}».`);
      }
    }
  }

  const solution = input.solution;
  if (!isRecord(solution)) {
    errors.push('La soluzione è assente o non valida.');
  } else {
    for (const field of ['motive', 'how', 'backstory'] as const) {
      addRequiredTextError(errors, solution[field], `soluzione: ${field}`);
    }
    addMinimumWordsError(errors, solution.motive, 'soluzione: motive', STORY_CONTENT_LIMITS.motive);
    addMinimumWordsError(errors, solution.how, 'soluzione: how', STORY_CONTENT_LIMITS.method);
    addMinimumWordsError(errors, solution.backstory, 'soluzione: backstory', STORY_CONTENT_LIMITS.backstory);
    addMaximumWordsError(errors, solution.motive, 'soluzione: motive', STORY_CONTENT_LIMITS.motiveMax);
    addMaximumWordsError(errors, solution.how, 'soluzione: how', STORY_CONTENT_LIMITS.methodMax);
    addMaximumWordsError(errors, solution.backstory, 'soluzione: backstory', STORY_CONTENT_LIMITS.backstoryMax);

    const culprits = solution.culprits;
    if (!Array.isArray(culprits) || culprits.length === 0 || culprits.some((name) => !nonEmptyString(name))) {
      errors.push('La soluzione deve indicare almeno un colpevole con un nome valido.');
    } else {
      const flaggedCulprits = validCharacters
        .filter((character) => character.isCulprit === true && nonEmptyString(character.name))
        .map((character) => normalizedName(character.name as string))
        .sort();
      const solutionCulprits = culprits.map((name) => normalizedName(name as string)).sort();
      if (
        new Set(solutionCulprits).size !== solutionCulprits.length ||
        solutionCulprits.length !== flaggedCulprits.length ||
        solutionCulprits.some((name, index) => name !== flaggedCulprits[index])
      ) {
        errors.push('I colpevoli nella soluzione non corrispondono ai personaggi contrassegnati come colpevoli.');
      }
    }

    if (!Array.isArray(solution.deductionChain) || solution.deductionChain.length === 0) {
      errors.push('La catena di deduzione della soluzione deve contenere almeno un passaggio.');
    } else {
      if (solution.deductionChain.length < STORY_CONTENT_LIMITS.deductionSteps) {
        errors.push(`La catena di deduzione richiede almeno ${STORY_CONTENT_LIMITS.deductionSteps} passaggi.`);
      }
      if (solution.deductionChain.length > STORY_CONTENT_LIMITS.deductionStepsMax) {
        errors.push(`La catena di deduzione deve contenere al massimo ${STORY_CONTENT_LIMITS.deductionStepsMax} passaggi.`);
      }
      solution.deductionChain.forEach((step, index) => {
        if (!nonEmptyString(step)) errors.push('Ogni passaggio della catena di deduzione deve contenere testo non vuoto.');
        else addMinimumWordsError(errors, step, `deduzione, passaggio ${index + 1}`, STORY_CONTENT_LIMITS.deductionStep);
        addMaximumWordsError(errors, step, `deduzione, passaggio ${index + 1}`, STORY_CONTENT_LIMITS.deductionStepMax);
      });
    }
  }

  const evidence = Array.isArray(input.evidence) ? input.evidence : [];
  if (!Array.isArray(input.evidence)) {
    errors.push('La lista degli indizi è assente o non valida.');
  }
  if (evidence.length === 0) errors.push('La storia deve contenere indizi distribuibili ai partecipanti.');

  const knownNames = new Set(names.keys());
  const clueIds = new Set<string>();
  const recipientNames = new Set<string>();
  const clueTypes = new Set<string>();
  const decisiveRounds = new Set<number>();
  const innocentDecisiveRecipients = new Set<string>();
  const clueSlots = new Map<string, number>();
  let decisiveCount = 0;
  let corroboratingCount = 0;

  evidence.forEach((rawClue, index) => {
    const position = index + 1;
    if (!asClue(rawClue)) {
      errors.push(`L’indizio ${position} non è un oggetto valido.`);
      return;
    }
    const clue = rawClue as unknown as Record<string, unknown>;
    for (const field of ['id', 'title', 'content', 'solutionLink', 'organizerNote'] as const) {
      addRequiredTextError(errors, clue[field], `indizio ${position}: ${field}`);
    }
    addMinimumWordsError(errors, clue.content, `indizio ${position}: content`, STORY_CONTENT_LIMITS.clue);
    addMaximumWordsError(errors, clue.content, `indizio ${position}: content`, STORY_CONTENT_LIMITS.clueMax);
    addMinimumWordsError(errors, clue.solutionLink, `indizio ${position}: solutionLink`, STORY_CONTENT_LIMITS.clueSolutionLink);
    addMaximumWordsError(errors, clue.solutionLink, `indizio ${position}: solutionLink`, STORY_CONTENT_LIMITS.clueSolutionLinkMax);
    addMinimumWordsError(errors, clue.organizerNote, `indizio ${position}: organizerNote`, STORY_CONTENT_LIMITS.clueOrganizerNote);
    addMaximumWordsError(errors, clue.organizerNote, `indizio ${position}: organizerNote`, STORY_CONTENT_LIMITS.clueOrganizerNoteMax);

    if (nonEmptyString(clue.id)) {
      if (clueIds.has(clue.id.trim())) errors.push(`L’identificativo «${clue.id.trim()}» è assegnato a più indizi.`);
      clueIds.add(clue.id.trim());
    }

    const round = clue.round;
    if (round !== 1 && round !== 2 && round !== 3) {
      errors.push(`L’indizio ${position} deve appartenere al round 1, 2 o 3.`);
    }

    const recipients = clue.recipients;
    if (!Array.isArray(recipients) || recipients.length !== 1) {
      errors.push(`L’indizio ${position} deve avere esattamente un destinatario.`);
    } else {
      const clueRecipientNames = new Set<string>();
      recipients.forEach((recipient) => {
        if (!nonEmptyString(recipient)) {
          errors.push(`L’indizio ${position} contiene un destinatario vuoto.`);
          return;
        }
        const key = normalizedName(recipient);
        if (!knownNames.has(key)) errors.push(`L’indizio ${position} è assegnato al destinatario «${recipient.trim()}», che non è un personaggio valido.`);
        if (clueRecipientNames.has(key)) errors.push(`L’indizio ${position} assegna due volte lo stesso destinatario.`);
        clueRecipientNames.add(key);
        recipientNames.add(key);
        if (knownNames.has(key) && (round === 1 || round === 2 || round === 3)) {
          const slot = `${key}:${round}`;
          clueSlots.set(slot, (clueSlots.get(slot) ?? 0) + 1);
          if (clue.type === 'decisive' && names.get(key)?.isCulprit === false) innocentDecisiveRecipients.add(key);
        }
      });
    }

    if (typeof clue.type !== 'string' || !(CLUE_TYPES as readonly string[]).includes(clue.type)) {
      errors.push(`L’indizio ${position} ha una categoria non valida: usare decisivo, corroborante o depistaggio.`);
    } else {
      clueTypes.add(clue.type);
      if (clue.type === 'decisive') {
        decisiveCount += 1;
        if (round === 1 || round === 2 || round === 3) decisiveRounds.add(round);
        if (nonEmptyString(clue.solutionLink)) {
          const link = clue.solutionLink.trim();
          const words = wordCount(link);
          if (words < 15 || !/(?:dimostr|colleg|deduc|esclud|conferm|identific|prov|rivel|mostr)/iu.test(link)) {
            errors.push(`Il collegamento alla soluzione dell’indizio decisivo ${position} è troppo generico: spiega quale deduzione consente.`);
          }
        }
      } else if (clue.type === 'corroborating') {
        corroboratingCount += 1;
      }
    }
  });

  if (!clueTypes.has('decisive')) errors.push('Manca almeno un indizio decisivo.');
  if (!clueTypes.has('corroborating')) errors.push('Manca almeno un indizio corroborante.');
  if (!clueTypes.has('red-herring')) errors.push('Manca almeno un indizio di depistaggio.');
  if (decisiveCount < 3) errors.push(`Servono almeno 3 indizi decisivi; ne sono presenti ${decisiveCount}.`);
  if (innocentDecisiveRecipients.size < 3) errors.push('Servono indizi decisivi assegnati ad almeno 3 innocenti distinti.');
  if (corroboratingCount < 1) errors.push('Serve almeno un indizio corroborante.');
  if (decisiveRounds.size < 3) errors.push('Distribuisci almeno un indizio decisivo in ogni round.');

  for (const key of knownNames) {
    for (const round of [1, 2, 3]) {
      const count = clueSlots.get(`${key}:${round}`) ?? 0;
      if (count !== 1) errors.push(`Il personaggio «${String(names.get(key)?.name ?? key)}» deve ricevere esattamente un indizio nel round ${round}; ne riceve ${count}.`);
    }
    if (!recipientNames.has(key)) {
      const characterName = names.get(key)?.name;
      errors.push(`Il personaggio «${String(characterName ?? key)}» non riceve alcun indizio.`);
    }
  }

  // This is a deliberately conservative text heuristic, not a semantic proof.
  for (const rawClue of evidence) {
    if (!asClue(rawClue) || rawClue.type !== 'decisive' || !Array.isArray(rawClue.recipients)) continue;
    for (const recipient of rawClue.recipients) {
      if (!nonEmptyString(recipient)) continue;
      const recipientRecord = names.get(normalizedName(recipient));
      if (!recipientRecord || recipientRecord.isCulprit === true || !nonEmptyString(rawClue.content)) continue;
      const text = rawClue.content.toLocaleLowerCase('it');
      const recipientName = recipient.trim().toLocaleLowerCase('it');
      const namesRecipient = text.includes(recipientName);
      const declaresGuilt = /\b(colpevole|assassino|assassina|responsabile del (?:delitto|crimine|omicidio))\b/u.test(text);
      if (namesRecipient && declaresGuilt) {
        warnings.push(`L’indizio decisivo «${rawClue.title}» desta il sospetto che attribuisca la colpevolezza al destinatario «${recipient.trim()}»: controlla che non riveli esplicitamente un innocente come colpevole.`);
      }
    }
  }

  for (const character of validCharacters) {
    if (!nonEmptyString(character.name)) continue;
    const values = REQUIRED_CHARACTER_TEXT_FIELDS
      .filter((field) => field.startsWith('round'))
      .map((field) => character[field])
      .filter(nonEmptyString)
      .map((value) => value.trim().toLocaleLowerCase('it'));
    if (new Set(values).size < values.length) {
      warnings.push(`La scheda di «${character.name.trim()}» ripete una o più informazioni tra i round e richiede revisione narrativa: verifica che ogni round faccia avanzare il gioco.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

