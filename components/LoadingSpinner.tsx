import React, { useState, useEffect } from 'react';
import { HourGlassIcon } from './icons';

const messages = [
  'Coordinando gli indizi...',
  'Controllando la coerenza della trama...',
  'Preparando i personaggi segreti...',
  'Rifinendo il colpo di scena finale...',
  'Allineando le timeline degli eventi...',
  'Revisionando gli alibi dei sospettati...',
  'Bilanciando difficoltà e suspense...',
  'Verificando che tutto rispetti le linee guida...'
];

const LoadingSpinner: React.FC = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, 3200);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4" role="status" aria-live="polite">
      <HourGlassIcon className="w-16 h-16 text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
      <h2 className="text-2xl font-bold text-amber-300">Generazione in corso...</h2>
      <p className="text-gray-400 text-lg transition-opacity duration-500">{messages[messageIndex]}</p>
    </div>
  );
};

export default LoadingSpinner;
