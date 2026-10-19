import React, { useState, useEffect } from 'react';
import { HourGlassIcon } from './icons';
import type { GenerationProgress } from '../services/generationTypes';
const LoadingSpinner: React.FC<{ progress?: GenerationProgress }> = ({ progress }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.ceil(((progress?.retryAt ?? 0) - now) / 1000));
  return <div className="flex flex-col items-center justify-center p-8 space-y-4" role="status" aria-live="polite">
    <HourGlassIcon className="w-16 h-16 text-amber-400 animate-spin" />
    <h2 className="text-2xl font-bold text-amber-300">{progress?.status === 'waiting' ? 'Attesa del servizio AI' : 'Generazione in corso'}</h2>
    <p>{progress?.message ?? 'Preparazione della storia...'}</p>
    {progress && <p>Personaggi completati: {progress.completedCharacters} / {progress.totalCharacters}</p>}
    {seconds > 0 && <p>Nuovo tentativo tra {seconds} secondi</p>}
  </div>;
};
export default LoadingSpinner;
