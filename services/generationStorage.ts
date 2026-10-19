import { auditStoryQuality } from './storyQuality';
import { validateCanonical } from './canonicalPlan';
import { PIPELINE_VERSION } from './generationTypes.ts';
import type { GenerationCheckpoint } from './generationTypes';
export const GENERATION_STORAGE_KEY = 'murder-mystery:generation:v1';
export const STORAGE_WARNING = 'Salvataggio locale non disponibile: mantieni aperta questa pagina per conservare i progressi.';
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export function validateCheckpoint(v: unknown): v is GenerationCheckpoint {
  if (!object(v) || v.version !== 1 || v.pipelineVersion !== PIPELINE_VERSION || typeof v.id !== 'string' || !v.id || !Number.isFinite(v.createdAt) || !Number.isFinite(v.updatedAt)) return false;
  if (!object(v.input) || !Number.isInteger(v.input.playerCount) || v.input.playerCount < 4 || v.input.playerCount > 12 || typeof v.input.theme !== 'string' || !v.input.theme.trim() || !object(v.stages) || !Array.isArray(v.metrics)) return false;
  if (!['running', 'waiting', 'paused', 'complete'].includes(v.status) || ![1, 2].includes(v.concurrency) || (v.retryAt !== undefined && !Number.isFinite(v.retryAt))) return false;
  if (!Object.values(v.stages).every(s => object(s) && typeof s.validated === 'boolean' && 'value' in s)) return false;
  if (!v.metrics.every(m => object(m) && typeof m.phase === 'string' && Number.isFinite(m.elapsedMs) && Number.isFinite(m.status))) return false;
  if (v.status === 'complete' && (!object(v.finalStory) || typeof v.finalStory.title !== 'string' || !object(v.finalStory.commonDocument) || !object(v.finalStory.solution) || !Array.isArray(v.finalStory.characters) || v.finalStory.characters.length !== v.input.playerCount || !Array.isArray(v.finalStory.evidence))) return false;
  if (v.status === 'complete') {
    try {
      if (!auditStoryQuality(v.finalStory, v.input.playerCount).valid) return false;
      const canonical = v.stages.canonical_plan?.value;
      if (!canonical || validateCanonical(canonical, v.input.playerCount).length) return false;
      const culprit = canonical.cast.find((entry: any) => entry.id === canonical.culpritId)?.name;
      if (!culprit || v.finalStory.title !== canonical.title || v.finalStory.solution.culprits.length !== 1 || v.finalStory.solution.culprits[0] !== culprit) return false;
      if (!canonical.cast.every((entry: any) => v.finalStory.characters.some((character: any) => character.name === entry.name && character.isCulprit === (entry.id === canonical.culpritId)))) return false;
    } catch { return false; }
  }
  return true;
}
export function loadGeneration(storage?: Pick<Storage, 'getItem'>): { checkpoint?: GenerationCheckpoint; warning?: string } {
  try {
    const raw = (storage ?? localStorage).getItem(GENERATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return validateCheckpoint(parsed) ? { checkpoint: parsed } : { warning: 'Il salvataggio non è compatibile o è danneggiato. Puoi eliminarlo e iniziare una nuova storia.' };
  } catch { return { warning: STORAGE_WARNING }; }
}
export function saveGeneration(checkpoint: GenerationCheckpoint, storage?: Pick<Storage, 'setItem'>): string | undefined {
  try { (storage ?? localStorage).setItem(GENERATION_STORAGE_KEY, JSON.stringify(checkpoint)); } catch { return STORAGE_WARNING; }
}
export function deleteGeneration(storage?: Pick<Storage, 'removeItem'>): string | undefined {
  try { (storage ?? localStorage).removeItem(GENERATION_STORAGE_KEY); } catch { return STORAGE_WARNING; }
}
