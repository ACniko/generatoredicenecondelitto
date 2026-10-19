import { arraySchema as array, objectSchema as object, stringSchema as text, structure, type ValidationIssue, type Path, type Schema } from './fieldRepair';

export interface CanonicalCharacter {
  id: string; name: string; publicRole: string; publicFacts: string[]; truth: string; privateSecret: string; motive: string; alibi: string;
  relationships: Array<{ characterId: string; fact: string }>;
  knowledgeByRound: Array<{ round: number; facts: string[] }>;
}
export interface CanonicalPlan {
  title: string; victim: { id: string; name: string }; culpritId: string; setting: string; publicIntroductionFacts: string[]; publicSceneFacts: string[]; motive: string; method: string; backstory: string;
  cast: CanonicalCharacter[];
  timeline: Array<{ id: string; time: string; location: string; event: string; characters: string[] }>;
  clues: Array<{ id: string; recipientId: string; round: 1 | 2 | 3; type: 'decisive' | 'corroborating' | 'red-herring'; fact: string; deduction: string }>;
  deduction: Array<{ fact: string; clueIds: string[] }>;
}
const round = { type: 'integer', enum: [1, 2, 3] };
export const canonicalSchema = object({
  title: text, victim: object({ id: text, name: text }), culpritId: text, setting: text, publicIntroductionFacts: array(text), publicSceneFacts: array(text), motive: text, method: text, backstory: text,
  cast: array(object({ id: text, name: text, publicRole: text, publicFacts: array(text), truth: text, privateSecret: text, motive: text, alibi: text,
    relationships: array(object({ characterId: text, fact: text })), knowledgeByRound: array(object({ round, facts: array(text) })) })),
  timeline: array(object({ id: text, time: text, location: text, event: text, characters: array(text) })),
  clues: array(object({ id: text, recipientId: text, round, type: { type: 'string', enum: ['decisive', 'corroborating', 'red-herring'] }, fact: text, deduction: text })),
  deduction: array(object({ fact: text, clueIds: array(text) })),
});
export function validateCanonical(plan: CanonicalPlan, count: number): ValidationIssue[] {
  const issues = structure(plan, canonicalSchema);
  if (issues.length) return issues;
  const add = (path: Path, code: string, message: string, schema: Schema) => issues.push({ path, code, message, schema });
  const unique = (list: string[]) => new Set(list).size === list.length;
  const ids = plan.cast.map(c => c.id), names = plan.cast.map(c => c.name.trim().normalize('NFC').toLocaleLowerCase('it'));
  if (plan.cast.length !== count || !unique(ids) || !unique(names)) add(['cast'], 'cast', `Servono ${count} partecipanti con ID e nomi unici.`, canonicalSchema.properties.cast);
  if (ids.includes(plan.victim.id) || names.includes(plan.victim.name.trim().normalize('NFC').toLocaleLowerCase('it'))) add(['victim'], 'victim', 'Vittima non giocante distinta dal cast per ID e nome.', canonicalSchema.properties.victim);
  if (!ids.includes(plan.culpritId)) add(['culpritId'], 'reference', 'Unico colpevole: usa un ID del cast.', { type: 'string', enum: ids });
  const actorIds = [...ids, plan.victim.id];
  for (const field of ['publicIntroductionFacts', 'publicSceneFacts'] as const) if (!plan[field].length) add([field], 'public_facts', 'Fatti pubblici osservabili, senza soluzione: occasione, vittima, scoperta; scena con pianta, accessi, posizioni e oggetti coerenti col metodo.', canonicalSchema.properties[field]);
  if (plan.timeline.length < 4 || !unique(plan.timeline.map(t => t.id))) add(['timeline'], 'timeline', 'Almeno quattro eventi con ID unici: arrivi, ultimo avvistamento, delitto e scoperta.', canonicalSchema.properties.timeline);
  let previous = -1;
  plan.timeline.forEach((event, i) => {
    const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.time) ? Number(event.time.slice(0, 2)) * 60 + Number(event.time.slice(3)) : -1;
    if (time <= previous || time < 0) add(['timeline', i, 'time'], 'time', `Orario HH:MM valido e successivo al precedente (${i ? plan.timeline[i - 1].time : 'inizio'}).`, text);
    previous = time;
    if (!event.characters.length || event.characters.some(id => !actorIds.includes(id))) add(['timeline', i, 'characters'], 'reference', 'Usa solo ID del cast o della vittima, almeno uno.', array({ type: 'string', enum: actorIds }));
  });
  plan.cast.forEach((c, i) => {
    if (!c.publicFacts.length) add(['cast', i, 'publicFacts'], 'public_facts', 'Almeno un fatto pubblico sui rapporti o sul ruolo di questo personaggio, privo di segreti.', array(text));
    const targets = c.relationships.map(r => r.characterId);
    if (targets.length !== 3 || !unique(targets) || targets.some(id => id === c.id || !ids.includes(id))) add(['cast', i, 'relationships'], 'relationships', 'Tre relazioni distinte con altri ID del cast, fatti coerenti e specifici.', canonicalSchema.properties.cast.items.properties.relationships);
    if (c.knowledgeByRound.length !== 3 || !unique(c.knowledgeByRound.map(k => String(k.round))) || c.knowledgeByRound.some(k => !k.facts.length)) add(['cast', i, 'knowledgeByRound'], 'knowledge', 'Un insieme non vuoto di fatti conoscibili per ciascuno dei tre round.', canonicalSchema.properties.cast.items.properties.knowledgeByRound);
  });
  const clueIds = plan.clues.map(c => c.id);
  if (!unique(clueIds) || plan.clues.length !== count * 3) add(['clues'], 'clue_slots', `Esattamente ${count * 3} indizi con ID unici, uno per partecipante per round.`, canonicalSchema.properties.clues);
  plan.clues.forEach((clue, i) => {
    if (!ids.includes(clue.recipientId)) add(['clues', i, 'recipientId'], 'reference', 'Destinatario presente nel cast.', { type: 'string', enum: ids });
  });
  if (ids.some(id => [1, 2, 3].some(r => plan.clues.filter(c => c.recipientId === id && c.round === r).length !== 1))) add(['clues'], 'clue_slots', 'Un indizio per ogni coppia partecipante/round.', canonicalSchema.properties.clues);
  const decisive = plan.clues.filter(c => c.type === 'decisive');
  if (new Set(decisive.map(c => c.round)).size !== 3 || new Set(decisive.filter(c => c.recipientId !== plan.culpritId).map(c => c.recipientId)).size < 3 || !plan.clues.some(c => c.type === 'corroborating') || !plan.clues.some(c => c.type === 'red-herring')) add(['clues'], 'deducibility', 'Almeno tre indizi decisivi nei tre round ad almeno tre innocenti diversi, un corroborante e un depistaggio spiegabile.', canonicalSchema.properties.clues);
  if (plan.deduction.length < 4 || plan.deduction.length > 6) add(['deduction'], 'deduction', 'Catena di 4–6 deduzioni sostenute da ID di indizi distribuibili.', canonicalSchema.properties.deduction);
  plan.deduction.forEach((step, i) => {
    if (!step.clueIds.length || step.clueIds.some(id => !clueIds.includes(id))) add(['deduction', i, 'clueIds'], 'reference', 'Cita almeno un ID di indizio esistente che sostiene questo passo.', array({ type: 'string', enum: clueIds }));
  });
  return issues;
}

export const CANONICAL_INSTRUCTIONS = `Progetta fatti canonici compatti per una cena con delitto italiana originale, non grafica, di 2–3 ore. Non scrivere dossier o prosa lunga: ogni fatto in una frase breve e precisa. Usa ID stabili c1… per i partecipanti, v1 per la vittima non giocante, t1… per gli eventi e p1… per gli indizi. Un solo colpevole. Ogni partecipante ha tre relazioni specifiche, alibi e conoscenze separate per round. Le conoscenze devono derivare da esperienza diretta o prove ricevute, senza onniscienza. Timeline HH:MM strettamente crescente con arrivi, ultimo avvistamento, finestra del delitto e scoperta. Un indizio privato per partecipante per round; almeno tre decisivi, nei tre round, distribuiti a tre innocenti diversi; aggiungi corroboranti e depistaggi spiegabili. La catena di 4–6 deduzioni deve citare gli ID degli indizi che dimostrano colpevole, movente e metodo. publicIntroductionFacts descrive occasione, vittima e scoperta senza spoiler. publicSceneFacts definisce pianta, accessi, posizioni, oggetti e osservazioni iniziali coerenti col metodo. publicFacts di ciascun personaggio contiene solo rapporti e fatti pubblicamente noti. Non inserire la soluzione nei fatti pubblici. Restituisci solo JSON.`;
