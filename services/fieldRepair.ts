import type { GenerationPhase, GenerationRuntime } from './generationTypes';

export type Path = Array<string | number>;
export type Schema = Record<string, any>;
export interface ValidationIssue { path: Path; code: string; message: string; schema: Schema }
export const stringSchema: Schema = { type: 'string' };
export const objectSchema = (properties: Record<string, Schema>): Schema => ({ type: 'object', properties, required: Object.keys(properties) });
export const arraySchema = (items: Schema): Schema => ({ type: 'array', items });
export const words = (value: unknown): number => typeof value === 'string' ? (value.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length : 0;
export const at = (root: any, path: Path): any => path.reduce((value, key) => value?.[key], root);
export function setAt(root: any, path: Path, value: any): any {
  if (!path.length) return value;
  let cursor = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = typeof path[i + 1] === 'number' ? [] : {};
    cursor = cursor[key];
  }
  cursor[path[path.length - 1]] = value;
  return root;
}
export function structure(value: any, schema: Schema, path: Path = []): ValidationIssue[] {
  const fail = (message: string): ValidationIssue[] => [{ path, code: 'structure', message, schema }];
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Oggetto richiesto.');
    return Object.entries(schema.properties).flatMap(([key, child]) => structure(value[key], child as Schema, [...path, key]));
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return fail('Array richiesto.');
    return Array.from(value, (item, index) => structure(item, schema.items, [...path, index])).flat();
  }
  if ((schema.type === 'integer' && !Number.isInteger(value)) || (schema.type !== 'integer' && typeof value !== schema.type)) return fail(`Richiesto ${schema.type}.`);
  if (schema.enum && !schema.enum.includes(value)) return fail(`Valori ammessi: ${schema.enum.join(', ')}.`);
  if (schema.type === 'string' && !value.trim()) return fail('Testo non vuoto richiesto.');
  return [];
}
export function lengthIssue(root: any, path: Path, min: number, max: number): ValidationIssue[] {
  const count = words(at(root, path));
  return count >= min && count <= max ? [] : [{ path, code: 'word_count', message: `Scrivi ${min}–${max} parole; trovate ${count}. Mira a ${Math.round((min + max) / 2)}.`, schema: stringSchema }];
}
const keyOf = (issue: ValidationIssue) => JSON.stringify(issue.path);
const equalPath = (a: Path, b: Path) => a.length === b.length && a.every((part, i) => b[i] === part);
const overlaps = (a: Path, b: Path) => a.every((part, i) => b[i] === part) || b.every((part, i) => a[i] === part);

/** Parsed drafts and successful atomic patches are durable before the next request. */
export async function validatedStage<T>(runtime: GenerationRuntime, key: string, phase: GenerationPhase, prompt: string, schema: Schema,
  validate: (value: T) => ValidationIssue[], context: unknown, onPatch?: (path: Path, value: T) => void, normalizeDraft?: (value: T) => T): Promise<T> {
  runtime.assertActive();
  const saved = runtime.getStage<T>(key);
  if (saved?.validated && !validate(saved.value).length) return structuredClone(saved.value);
  let draft = saved ? structuredClone(saved.value) : await runtime.requestJson<T>(prompt, phase, schema);
  runtime.saveStage(key, draft, false);
  if (key !== 'canonical_plan') runtime.invalidateStages(['assembled_story', 'story_verification']);
  if (normalizeDraft) {
    draft = normalizeDraft(structuredClone(draft));
    runtime.saveStage(key, draft, false);
  }
  const attempts = new Map<string, number>();
  const pendingTargets = new Map<string, ValidationIssue>();
  for (;;) {
    runtime.assertActive();
    const issues = validate(draft).map(issue => {
      // Preserve the expected identity if a later append was accepted while an
      // earlier missing array slot still awaits repair.
      const pending = pendingTargets.get(keyOf(issue));
      return issue.code === 'structure' && pending?.code.startsWith('missing_') ? pending : issue;
    });
    if (!issues.length) { runtime.saveStage(key, draft, true); return draft; }
    const batch: ValidationIssue[] = [];
    for (const issue of issues) {
      if (batch.length === 4) break;
      // Appends to one array are sequential: accepting index n+1 while n is
      // rejected would persist a sparse slot (serialized as null). Defer the
      // next missing unit until the previous append has been accepted.
      if (issue.code.startsWith('missing_') && batch.some(other => other.code.startsWith('missing_') && equalPath(other.path.slice(0, -1), issue.path.slice(0, -1)))) continue;
      if (!batch.some(other => overlaps(other.path, issue.path))) batch.push(issue);
    }
    for (const issue of batch) {
      const target = keyOf(issue), attempt = (attempts.get(target) ?? 0) + 1;
      if (attempt > 3) throw new Error(`Generazione in pausa: ${key} ${target}: ${issue.message} Il lavoro è conservato; riprendi per correggere solo questo campo.`);
      attempts.set(target, attempt);
      pendingTargets.set(target, issue);
    }
    runtime.progress('field_repair', `Correzione mirata: ${key}, ${batch.length} campi (massimo 3 tentativi per campo).`);
    const targets = batch.map((issue, i) => ({ key: batch.length === 1 ? 'value' : `value${i}`, path: issue.path, code: issue.code, message: issue.message, current: at(draft, issue.path) ?? null }));
    const input = batch.length === 1 ? { stage: key, ...targets[0] } : { stage: key, targets };
    const repair = await runtime.requestJson<Record<string, any>>(
      `Correggi esclusivamente i campi indicati, indipendentemente. Conserva tutti i fatti canonici; non introdurre nuove prove. Restituisci ogni valore nella chiave assegnata conforme allo schema. Rispetta i messaggi dei controlli.\nCONTESTO:\n${JSON.stringify(phase === 'canonical_plan' ? { input: context, canonicalDraft: draft } : context)}\nINPUT:\n${JSON.stringify(input)}`,
      'field_repair', objectSchema(Object.fromEntries(batch.map((issue, i) => [targets[i].key, issue.schema]))), 0.25);
    runtime.saveStage(`repair:${key}:${batch.map(keyOf).join(';')}`, repair, false);
    for (let i = 0; i < batch.length; i++) {
      runtime.assertActive();
      const issue = batch[i], replacement = repair?.[targets[i].key];
      if (structure(replacement, issue.schema).length) continue;
      const last = issue.path[issue.path.length - 1], parent = at(draft, issue.path.slice(0, -1));
      if (typeof last === 'number' && Array.isArray(parent) && last > parent.length) continue;
      const candidate = setAt(structuredClone(draft), issue.path, replacement);
      const remaining = validate(candidate);
      // A patch changes only its subtree. Newly visible sibling errors are
      // independent and never justify discarding an accepted replacement.
      if (remaining.some(next => overlaps(next.path, issue.path))) continue;
      draft = candidate;
      pendingTargets.delete(keyOf(issue));
      onPatch?.(issue.path, draft);
      runtime.saveStage(key, draft, false);
    }
  }
}
