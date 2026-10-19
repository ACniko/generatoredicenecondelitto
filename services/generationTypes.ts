import type { StoryData } from '../types';

export const PIPELINE_VERSION = 'compact-v1';
export type GenerationPhase = 'canonical_plan' | 'common_document' | 'solution' | 'evidence_batch' | 'character_batch' | 'field_repair' | 'story_verification';
export type GenerationStatus = 'running' | 'waiting' | 'paused' | 'complete';

export interface RequestMetric {
  phase: string;
  elapsedMs: number;
  status: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  requestId?: string;
  finishReason?: string;
  model?: string;
  maxCompletionTokens?: number;
  reasoningEffort?: string;
  serverElapsedMs?: number;
}

export interface StageCheckpoint<T = unknown> {
  value: T;
  validated: boolean;
}

export interface GenerationCheckpoint {
  version: 1;
  pipelineVersion: string;
  id: string;
  createdAt: number;
  updatedAt: number;
  input: { playerCount: number; theme: string };
  status: GenerationStatus;
  stages: Record<string, StageCheckpoint>;
  retryAt?: number;
  concurrency: 1 | 2;
  metrics: RequestMetric[];
  finalStory?: StoryData;
}

export interface GenerationProgress {
  stage: string;
  status: GenerationStatus;
  completedCharacters: number;
  totalCharacters: number;
  retryAt?: number;
  message: string;
}

export interface GenerationOptions {
  checkpoint?: GenerationCheckpoint;
  onCheckpoint?: (checkpoint: GenerationCheckpoint) => void;
  onProgress?: (progress: GenerationProgress) => void;
  signal?: AbortSignal;
}

export interface GenerationRuntime {
  readonly checkpoint: GenerationCheckpoint;
  getStage<T>(key: string): StageCheckpoint<T> | undefined;
  saveStage<T>(key: string, value: T, validated: boolean): void;
  invalidateStages(keys: string[]): void;
  requestJson<T>(prompt: string, phase: GenerationPhase, schema: Record<string, any>, temperature?: number, endpoint?: string): Promise<T>;
  progress(stage: string, message: string, completedCharacters?: number): void;
  assertActive(): void;
  pause(error: unknown): void;
  complete(story: StoryData): StoryData;
}
