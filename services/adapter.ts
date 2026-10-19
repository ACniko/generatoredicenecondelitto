import type { GenerationOptions } from './generationTypes';
import type { StoryData } from '../types';
import { generateMurderMysteryStory as generateWithGroq } from './groqService';

/**
 * Adapter per mantenere l'interfaccia pubblica invariata
 * mentre si utilizza il servizio Groq al posto di Gemini
 */
export const generateMurderMysteryStory = async (playerCount: number, theme: string, options?: GenerationOptions): Promise<StoryData> => {
  return generateWithGroq(playerCount, theme, options);
};