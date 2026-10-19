
import type { Character, EvidenceClue, StoryData } from '../types';
import { auditStoryQuality, STORY_CONTENT_LIMITS as L } from './storyQuality';
import { createGenerationRuntime } from './generationRuntime';
import type { GenerationOptions } from './generationTypes';
import { canonicalSchema, CANONICAL_INSTRUCTIONS, validateCanonical, type CanonicalPlan, type CanonicalCharacter } from './canonicalPlan';
import { arraySchema, objectSchema, stringSchema, structure, lengthIssue, validatedStage, type ValidationIssue, type Path, type Schema } from './fieldRepair';
import { characterSchema, clueSchema, verificationSchema } from './generationSchemas';

const commonSchema = objectSchema({ introduction: stringSchema, crimeSceneMapDescription: stringSchema, characterOverviews: stringSchema });
type CommonDraft = Omit<StoryData['commonDocument'], 'characterOverviews'> & { publicProfiles: Array<{ characterName: string; description: string }> };
const profileSchema = objectSchema({ characterName: stringSchema, description: stringSchema });
const commonDraftSchema = objectSchema({ introduction: stringSchema, crimeSceneMapDescription: stringSchema, publicProfiles: arraySchema(profileSchema) });
const solutionSchema = objectSchema({ culprits: arraySchema(stringSchema), motive: stringSchema, how: stringSchema, backstory: stringSchema, deductionChain: arraySchema(stringSchema) });
const evidenceSchema = objectSchema({ evidence: arraySchema(objectSchema({ ...clueSchema.properties, recipients: arraySchema(stringSchema) })) });
const WARNING = 'La storia completa è disponibile, ma la verifica narrativa automatica non è riuscita. L’organizzatore dovrebbe controllare indizi e soluzione prima della partita.';
const normalize = (s: string) => s.trim().normalize('NFC').toLocaleLowerCase('it');
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const issue = (path: Path, code: string, message: string, schema: Schema): ValidationIssue => ({ path, code, message, schema });
const exact = (value: unknown, expected: unknown, path: Path, schema: Schema) => equal(value, expected) ? [] : [issue(path, 'canonical_identity', `Il valore canonico richiesto è ${JSON.stringify(expected)}.`, schema)];
const prompt = (instructions: string, context: unknown, input: unknown) => `${instructions}\nCONTESTO:\n${JSON.stringify(context)}\nINPUT:\n${JSON.stringify(input)}`;
const BASE = `Scrivi in italiano naturale, concreto, senza ripetizioni. Rispetta esclusivamente i fatti canonici forniti e tutti i limiti di parole. Nessun nuovo fatto investigativo, prova o rapporto. Le informazioni pubbliche non rivelano colpevole, metodo o soluzione. Gli innocenti conoscono solo i fatti consentiti al loro round; non copiare note riservate. Restituisci solo JSON conforme allo schema.`;
const publicContext = (p: CanonicalPlan) => ({ title: p.title, victim: p.victim, setting: p.setting, publicIntroductionFacts: p.publicIntroductionFacts, publicSceneFacts: p.publicSceneFacts, cast: p.cast.map(c => ({ id: c.id, name: c.name, publicRole: c.publicRole, publicFacts: c.publicFacts })) });
const privateContext = (p: CanonicalPlan) => ({ ...publicContext(p), culpritId: p.culpritId, motive: p.motive, method: p.method, backstory: p.backstory, timeline: p.timeline, deduction: p.deduction });
function uniqueExpected<T>(items: T[], allowed: string[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter(item => { const identity = key(item); if (!allowed.includes(identity) || seen.has(identity)) return false; seen.add(identity); return true; });
}
function normalizeCharacters(value: { characters: Character[] }, selected: CanonicalCharacter[], plan: CanonicalPlan) {
  if (!value || !Array.isArray(value.characters)) return value;
  return { characters: uniqueExpected(value.characters, selected.map(c => c.name), c => c?.name).map(c => ({ ...c,
    opinionsOnOthers: Array.isArray(c.opinionsOnOthers) ? uniqueExpected(c.opinionsOnOthers, plan.cast.filter(p => p.name !== c.name).map(p => p.name), o => o?.characterName) : c.opinionsOnOthers,
  })) };
}
function dependentStages(keys: string[], path: Path, plan: CanonicalPlan): string[] {
  const root = path[0];
  const result = new Set(['assembled_story', 'story_verification']);
  const add = (predicate: (key: string) => boolean) => keys.filter(predicate).forEach(key => result.add(key));
  const rendered = (key: string) => key === 'common_document' || key === 'solution' || key.startsWith('characters:') || key.startsWith('evidence:');
  if (root === 'cast' && typeof path[1] === 'number' && path.length > 2 && ['truth', 'privateSecret', 'motive', 'alibi', 'relationships', 'knowledgeByRound'].includes(String(path[2]))) {
    const id = plan.cast[path[1]]?.id;
    add(key => key.startsWith('characters:') && key.slice('characters:'.length).split(',').includes(id));
    if (path[2] === 'truth' || path[2] === 'alibi') result.add('solution');
  } else if (root === 'clues' && typeof path[1] === 'number' && path.length > 2 && !['id', 'recipientId'].includes(String(path[2]))) {
    const clue = plan.clues[path[1]];
    add(key => key.startsWith('evidence:') && key.slice('evidence:'.length).split(',').includes(clue.id));
    add(key => key.startsWith('characters:') && key.slice('characters:'.length).split(',').includes(clue.recipientId));
    result.add('solution');
  } else if (['culpritId', 'motive', 'method', 'backstory', 'timeline', 'deduction'].includes(String(root))) {
    add(key => rendered(key) && key !== 'common_document');
  } else add(rendered);
  return [...result];
}

function normalizeCommon(value: CommonDraft | StoryData['commonDocument'], plan: CanonicalPlan): CommonDraft {
  if (!value || typeof value !== 'object') return value as CommonDraft;
  const profiles = 'publicProfiles' in value ? value.publicProfiles : typeof value.characterOverviews === 'string' ? value.characterOverviews.split(/\r?\n\s*\r?\n/u).map(s => s.trim()).filter(Boolean).map((description, index) => ({ characterName: plan.cast.find(c => description.includes(c.name))?.name ?? plan.cast[index]?.name ?? '', description })) : [];
  return { introduction: value.introduction, crimeSceneMapDescription: value.crimeSceneMapDescription, publicProfiles: Array.isArray(profiles) ? uniqueExpected(profiles, plan.cast.map(c => c.name), p => p?.characterName) : profiles };
}
function validateCommon(value: CommonDraft, plan: CanonicalPlan): ValidationIssue[] {
  const issues = structure(value, commonDraftSchema);
  if (issues.length) return issues;
  issues.push(...lengthIssue(value, ['introduction'], L.commonIntroduction, L.commonIntroductionMax), ...lengthIssue(value, ['crimeSceneMapDescription'], L.crimeScene, L.crimeSceneMax));
  plan.cast.filter(c => !value.publicProfiles.some(p => p.characterName === c.name)).forEach((c, offset) => issues.push(issue(['publicProfiles', value.publicProfiles.length + offset], 'missing_public_profile', `Solo il profilo pubblico di ${c.name}, 45–70 parole, senza segreti, con nome completo nel testo.`, objectSchema({ characterName: { type: 'string', enum: [c.name] }, description: stringSchema }))));
  value.publicProfiles.forEach((profile, index) => {
    issues.push(...lengthIssue(value, ['publicProfiles', index, 'description'], L.characterOverviewPerPlayer, L.characterOverviewMaxPerPlayer));
    if (!profile.description.includes(profile.characterName)) issues.push(issue(['publicProfiles', index, 'description'], 'public_profile_name', `Profilo pubblico di 45–70 parole con il nome esatto ${profile.characterName}; solo fatti pubblici.`, stringSchema));
  });
  return issues;
}
function validateSolution(value: StoryData['solution'], plan: CanonicalPlan): ValidationIssue[] {
  const issues = structure(value, solutionSchema);
  if (issues.length) return issues;
  issues.push(...exact(value.culprits, [plan.cast.find(c => c.id === plan.culpritId)!.name], ['culprits'], solutionSchema.properties.culprits));
  for (const [field, min, max] of [['motive', L.motive, L.motiveMax], ['how', L.method, L.methodMax], ['backstory', L.backstory, L.backstoryMax]] as const) {
    issues.push(...lengthIssue(value, [field], min, max));
  }
  if (value.deductionChain.length < L.deductionSteps || value.deductionChain.length > L.deductionStepsMax) issues.push(issue(['deductionChain'], 'deduction_count', 'Richiesti 4–6 passaggi deduttivi canonici, 25–80 parole ciascuno.', solutionSchema.properties.deductionChain));
  value.deductionChain.forEach((_, i) => issues.push(...lengthIssue(value, ['deductionChain', i], L.deductionStep, L.deductionStepMax)));
  return issues;
}

function validateCharacters(value: { characters: Character[] }, selected: CanonicalCharacter[], plan: CanonicalPlan): ValidationIssue[] {
  const issues = structure(value, characterSchema);
  if (issues.length) return issues;
  const item = characterSchema.properties.characters.items, expected = selected.map(c => c.name);
  expected.filter(name => !value.characters.some(c => c.name === name)).forEach((name, offset) => issues.push(issue(['characters', value.characters.length + offset], 'missing_character', `Genera esclusivamente la scheda mancante di ${name}; isCulprit=${plan.cast.find(c => c.name === name)!.id === plan.culpritId}.`, { ...item, properties: { ...item.properties, name: { type: 'string', enum: [name] } } })));
  if (issues.length) return issues;
  if (value.characters.length !== selected.length || new Set(value.characters.map(c => c.name)).size !== selected.length || value.characters.some(c => !expected.includes(c.name))) return [issue(['characters'], 'cast', `Solo questi personaggi, una volta ciascuno: ${expected.join(', ')}.`, characterSchema.properties.characters)];
  value.characters.forEach((c, i) => {
    const path: Path = ['characters', i];
    issues.push(...exact(c.isCulprit, plan.cast.find(p => p.name === c.name)!.id === plan.culpritId, [...path, 'isCulprit'], { type: 'boolean' }));
    for (const [field, min, max] of [['initialDescription', L.initialDescription, L.initialDescriptionMax], ['relationships', L.relationships, L.relationshipsMax], ['secretsAndMotives', L.secretsAndMotives, L.secretsAndMotivesMax], ['round1Info', L.roundInfo, L.roundInfoMax], ['round2Info', L.roundInfo, L.roundInfoMax], ['round3Info', L.roundInfo, L.roundInfoMax]] as const) issues.push(...lengthIssue(value, [...path, field], min, max));
    for (const field of ['round1Info', 'round2Info', 'round3Info'] as const) {
      const text = c[field], objective = text.match(/Obiettivo concreto:\s*([\s\S]*?)(?=Informazione nuova:|$)/u)?.[1] ?? '';
      if (['Fatti che conosci:', 'Cosa puoi rivelare:', 'Obiettivo concreto:', 'Informazione nuova:'].some(label => !text.includes(label)) || !plan.cast.some(other => other.name !== c.name && normalize(objective).includes(normalize(other.name)))) issues.push(issue([...path, field], 'round_sections', `Round 150–190 parole con le sezioni esatte Fatti che conosci:, Cosa puoi rivelare:, Obiettivo concreto:, Informazione nuova:. L'obiettivo nomina un altro partecipante e un'azione al tavolo.`, stringSchema));
    }
    const others = plan.cast.filter(other => other.name !== c.name);
    let missing = 0;
    for (const other of others) {
      const index = c.opinionsOnOthers.findIndex(o => o.characterName === other.name);
      if (index < 0) {
        issues.push(issue([...path, 'opinionsOnOthers', c.opinionsOnOthers.length + missing++], 'missing_opinion', `Solo l'opinione di ${c.name} su ${other.name}: 45–65 parole, nome esatto.`, objectSchema({ characterName: { type: 'string', enum: [other.name] }, opinion: stringSchema })));
        continue;
      }
      issues.push(...lengthIssue(value, [...path, 'opinionsOnOthers', index, 'opinion'], L.opinionMin, L.opinionMax));
    }
    if (c.opinionsOnOthers.some(o => !others.some(other => other.name === o.characterName)) || new Set(c.opinionsOnOthers.map(o => o.characterName)).size !== c.opinionsOnOthers.length) issues.push(issue([...path, 'opinionsOnOthers'], 'opinion_targets', `Un'opinione distinta di 45–65 parole per ciascuno: ${others.map(o => o.name).join(', ')}.`, item.properties.opinionsOnOthers));
  });
  return issues;
}
function validateEvidence(value: { evidence: EvidenceClue[] }, selected: CanonicalPlan['clues'], plan: CanonicalPlan): ValidationIssue[] {
  const issues = structure(value, evidenceSchema);
  if (issues.length) return issues;
  selected.filter(clue => !value.evidence.some(c => c.id === clue.id)).forEach((clue, offset) => issues.push(issue(['evidence', value.evidence.length + offset], 'missing_clue', `Genera solo l'indizio ${clue.id}.`, { ...evidenceSchema.properties.evidence.items, properties: { ...evidenceSchema.properties.evidence.items.properties, id: { type: 'string', enum: [clue.id] } } })));
  if (issues.length) return issues;
  if (value.evidence.length !== selected.length || new Set(value.evidence.map(c => c.id)).size !== selected.length || value.evidence.some(c => !selected.some(p => p.id === c.id))) return [issue(['evidence'], 'clue_ids', `Solo gli ID ${selected.map(c => c.id).join(', ')}.`, evidenceSchema.properties.evidence)];
  value.evidence.forEach((c, i) => {
    const fact = selected.find(p => p.id === c.id)!;
    for (const field of ['round', 'type'] as const) issues.push(...exact(c[field], fact[field], ['evidence', i, field], { ...evidenceSchema.properties.evidence.items.properties[field], enum: [fact[field]] }));
    issues.push(...exact(c.recipients, [plan.cast.find(p => p.id === fact.recipientId)!.name], ['evidence', i, 'recipients'], arraySchema(stringSchema)));
    for (const [field, min, max] of [['content', L.clue, L.clueMax], ['solutionLink', L.clueSolutionLink, L.clueSolutionLinkMax], ['organizerNote', L.clueOrganizerNote, L.clueOrganizerNoteMax]] as const) issues.push(...lengthIssue(value, ['evidence', i, field], min, max));
    if (c.type === 'decisive' && !/(?:dimostr|colleg|deduc|esclud|conferm|identific|prov|rivel|mostr)/iu.test(c.solutionLink)) issues.push(issue(['evidence', i, 'solutionLink'], 'deductive_link', 'Spiega in 15–45 parole quale deduzione concreta questa prova dimostra o conferma.', stringSchema));
  });
  return issues;
}

/** Finish already active siblings before propagating a failure; never dequeue after it. */
async function runRenderTasks(tasks: Array<() => Promise<void>>): Promise<void> {
  let next = 0, failed = false, error: unknown;
  const worker = async () => {
    while (!failed && next < tasks.length) {
      const task = tasks[next++];
      try { await task(); } catch (cause) { if (!failed) error = cause; failed = true; }
    }
  };
  await Promise.all([worker(), worker()]);
  if (failed) throw error;
}

export async function generateMurderMysteryStory(playerCount: number, theme: string, options: GenerationOptions = {}): Promise<StoryData> {
  if (!Number.isInteger(playerCount) || playerCount < 4 || playerCount > 12) throw new Error('Scegli un numero di partecipanti compreso tra 4 e 12.');
  if (!theme?.trim()) throw new Error('Scegli un tema prima di generare la storia.');
  const runtime = createGenerationRuntime(playerCount, theme.trim(), options);
  try {
    runtime.progress('canonical_plan', 'Progettazione dei fatti e della cronologia.');
    const plan = await validatedStage<CanonicalPlan>(runtime, 'canonical_plan', 'canonical_plan', prompt(CANONICAL_INSTRUCTIONS, {}, { playerCount, theme: theme.trim() }), canonicalSchema, p => validateCanonical(p, playerCount), { playerCount, theme }, (path, value) => runtime.invalidateStages(dependentStages(Object.keys(runtime.checkpoint.stages), path, value)));
    const commonContext = publicContext(plan), solutionContext = { ...privateContext(plan), clues: plan.clues, castFacts: plan.cast.map(c => ({ id: c.id, truth: c.truth, alibi: c.alibi })) };
    runtime.progress('common_document', 'Scrittura del documento comune e della soluzione.');
    const commonDraft = await validatedStage<CommonDraft>(runtime, 'common_document', 'common_document', prompt(`${BASE} Introduzione 200–350 parole; scena del crimine 200–350 parole con luoghi, accessi e oggetti coerenti. characterOverviews: un paragrafo pubblico per partecipante, 45–70 parole, separati da righe vuote, con nomi esatti.`, commonContext, {}), commonSchema, v => validateCommon(v, plan), commonContext, undefined, v => normalizeCommon(v, plan));
    const commonDocument: StoryData['commonDocument'] = { introduction: commonDraft.introduction, crimeSceneMapDescription: commonDraft.crimeSceneMapDescription, characterOverviews: plan.cast.map(c => commonDraft.publicProfiles.find(p => p.characterName === c.name)!.description).join('\n\n') };
    const solution = await validatedStage<StoryData['solution']>(runtime, 'solution', 'solution', prompt(`${BASE} Dossier riservato all'organizzatore: culprits contiene il nome dell'unico colpevole. Movente 120–200 parole, metodo how 120–200, backstory 200–300. deductionChain 4–6 passaggi di 25–80 parole sostenuti dagli indizi citati.`, solutionContext, {}), solutionSchema, v => validateSolution(v, plan), solutionContext);
    const characters: Character[] = [], evidence: EvidenceClue[] = [], tasks: Array<() => Promise<void>> = [];
    let completed = 0;
    for (let i = 0; i < plan.cast.length; i += 2) {
      const selected = plan.cast.slice(i, i + 2), key = `characters:${selected.map(c => c.id).join(',')}`;
      const context = { ...privateContext(plan), selectedClues: plan.clues.filter(clue => selected.some(c => c.id === clue.recipientId)) };
      tasks.push(async () => {
        const batch = await validatedStage<{ characters: Character[] }>(runtime, key, 'character_batch', prompt(`${BASE} Genera solo i personaggi selezionati. isCulprit deriva dall'ID canonico. initialDescription pubblica 100–140 parole; relationships private 180–260; secretsAndMotives 180–260; ogni round 150–190 parole. Ogni round include esattamente le etichette Fatti che conosci:, Cosa puoi rivelare:, Obiettivo concreto:, Informazione nuova:. L'obiettivo nomina un altro personaggio e un'azione realizzabile al tavolo. Le conoscenze seguono knowledgeByRound. opinionsOnOthers: una opinione distinta di 45–65 parole per ciascun altro partecipante del cast, con nomi esatti.`, context, { selected }), characterSchema, v => validateCharacters(v, selected, plan), { ...context, selected }, undefined, v => normalizeCharacters(v, selected, plan));
        characters.push(...batch.characters); completed += selected.length;
        runtime.progress('character_batch', 'Schede personaggio conservate.', completed);
      });
    }
    for (let i = 0; i < plan.clues.length; i += 4) {
      const selected = plan.clues.slice(i, i + 4), key = `evidence:${selected.map(c => c.id).join(',')}`;
      const context = privateContext(plan);
      tasks.push(async () => {
        const batch = await validatedStage<{ evidence: EvidenceClue[] }>(runtime, key, 'evidence_batch', prompt(`${BASE} Genera solo gli indizi selezionati, preservando ID, round, type e destinatario (nome dal cast). content 40–55 parole; solutionLink 15–45 parole spiega quale fatto dimostra; organizerNote riservata 10–45 parole. Non rivelare note o soluzione nel testo distribuibile.`, context, { selected }), evidenceSchema, v => validateEvidence(v, selected, plan), { ...context, selected }, undefined, v => v && Array.isArray(v.evidence) ? { evidence: uniqueExpected(v.evidence, selected.map(c => c.id), c => c?.id) } : v);
        evidence.push(...batch.evidence);
        runtime.progress('evidence_batch', 'Indizi conservati.', completed);
      });
    }
    await runRenderTasks(tasks);
    runtime.assertActive();
    let story: StoryData = { title: plan.title, commonDocument, solution, characters: plan.cast.map(c => characters.find(v => v.name === c.name)!), evidence: plan.clues.map(c => evidence.find(v => v.id === c.id)!) };
    const audit = auditStoryQuality(story, playerCount);
    if (!audit.valid) throw new Error(`La storia non supera i controlli di completezza: ${audit.errors.slice(0, 3).join(' ')} Il lavoro è conservato.`);
    runtime.saveStage('assembled_story', story, true);
    runtime.progress('story_verification', 'Verifica della storia completa.', completed);
    try {
      const stored = runtime.getStage<{ approved: boolean; summary: string; issues: string[]; warnings: string[] }>('story_verification');
      const report = stored?.validated && !structure(stored.value, verificationSchema).length ? stored.value : await runtime.requestJson<{ approved: boolean; summary: string; issues: string[]; warnings: string[] }>(prompt(`Esamina questa storia completa come revisore indipendente. Confronta cronologia, alibi e orari, relazioni, round, indizi, destinatari, soluzione e deduzione. Controlla assenza di spoiler pubblici e nelle schede degli innocenti, deducibilità da indizi ottenibili, depistaggi spiegabili, coerenza dei nomi e rapporti. Non riscrivere la storia. approved=true solo senza contraddizioni sostanziali; issues bloccanti e warnings facoltative citano nomi e indizi.`, { timeline: plan.timeline, cast: commonContext.cast, victim: plan.victim }, { playerCount, story }), 'story_verification', verificationSchema, 0.1, '/api/verify');
      runtime.saveStage('story_verification', report, false);
      if (structure(report, verificationSchema).length) throw new Error('Rapporto di verifica incompleto.');
      runtime.saveStage('story_verification', report, true);
      runtime.assertActive();
      if (!report.approved || report.issues.length) story = { ...story, verificationWarning: `${WARNING} Esito: ${[...report.issues, report.summary].filter(Boolean).join(' ')}` };
      else if (report.warnings.length) story = { ...story, verificationWarning: `La storia è stata verificata; l’organizzatore può valutare queste note: ${report.warnings.join(' ')}` };
    } catch (error) {
      runtime.assertActive();
      if (error instanceof Error && error.name === 'AbortError') throw error;
      story = { ...story, verificationWarning: WARNING };
    }
    return runtime.complete(story);
  } catch (error) { runtime.pause(error); throw error; }
}
