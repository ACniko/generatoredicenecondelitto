
import React, { useState } from 'react';
import type { StoryData } from './types';
import { generateMurderMysteryStory } from './services/adapter';
import SetupForm from './components/SetupForm';
import LoadingSpinner from './components/LoadingSpinner';
import StoryDisplay from './components/StoryDisplay';
import { DetectiveIcon } from './components/icons';

const App: React.FC = () => {
  const [story, setStory] = useState<StoryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateStory = async (playerCount: number, theme: string) => {
    setIsLoading(true);
    setError(null);
    setStory(null);
    try {
      const generatedStory = await generateMurderMysteryStory(playerCount, theme);
      
      // Verifica che la storia generata sia valida e completa
      if (!generatedStory || !generatedStory.commonDocument || !generatedStory.characters || !generatedStory.solution) {
        throw new Error('La storia generata non è valida o è incompleta. Riprova.');
      }
      
      // Verifica che il numero di personaggi sia corretto
      if (generatedStory.characters.length !== playerCount) {
        throw new Error(`Sono stati generati ${generatedStory.characters.length} personaggi, ma ne erano richiesti ${playerCount}. Riprova.`);
      }
      
      setStory(generatedStory);
    } catch (err: any) {
      // Mostra il messaggio di errore specifico se disponibile
      setError(err.message || 'Si è verificato un errore durante la generazione della storia. Potrebbe essere un problema con la chiave API o una risposta inaspettata dal modello. Riprova.');
      console.error('Story generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleReset = () => {
    setStory(null);
    setError(null);
    setIsLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 p-4 sm:p-8 flex flex-col items-center">
      <header className="w-full max-w-5xl text-center mb-8">
        <div className="flex justify-center items-center gap-4 mb-2">
            <DetectiveIcon className="w-12 h-12 text-amber-300"/>
            <h1 className="text-4xl sm:text-5xl font-bold text-amber-200">Generatore di Cene con Delitto</h1>
        </div>
        <p className="text-lg text-gray-400 mb-4">Crea misteri avvincenti per serate indimenticabili.</p>
        <div className="bg-gray-800/70 p-4 rounded-lg text-left max-w-3xl mx-auto">
          <h2 className="text-xl font-semibold text-amber-300 mb-2">Cene con Delitto Gratis: Giochi di Ruolo per Serate Speciali</h2>
          <p className="text-gray-300 mb-3">
            Benvenuto nel miglior <strong>generatore di cene con delitto</strong> online e completamente gratuito! 
            Crea storie uniche per organizzare <strong>giochi con delitto</strong> e <strong>giochi da fare a cena</strong> con 
            i tuoi amici, senza costi e senza limiti.
          </p>
          <p className="text-gray-300">
            Le nostre <strong>cene con delitto</strong> sono perfette per chi ama i <strong>giochi di ruolo</strong> e vuole 
            vivere un'esperienza immersiva. Ogni storia è unica e generata con intelligenza artificiale, 
            pronta per essere scaricata e condivisa con tutti i partecipanti.
          </p>
        </div>
      </header>

      <main className="w-full max-w-5xl bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-2xl shadow-black/30 p-6 sm:p-8">
        {!story && !isLoading && <SetupForm onGenerate={handleGenerateStory} />}
        {isLoading && <LoadingSpinner />}
        {error && (
            <div className="text-center">
                <p className="text-red-400 text-xl mb-4">{error}</p>
                <button 
                    onClick={handleReset}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
                >
                    Torna Indietro
                </button>
            </div>
        )}
        {story && !isLoading && <StoryDisplay story={story} onReset={handleReset} />}
      </main>
      
      <footer className="text-center mt-8 text-gray-500 text-sm">
      </footer>
    </div>
  );
};

export default App;
