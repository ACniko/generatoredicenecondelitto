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

      if (!generatedStory || !generatedStory.commonDocument || !generatedStory.characters || !generatedStory.solution) {
        throw new Error('La storia generata non è valida o è incompleta. Riprova.');
      }

      if (generatedStory.characters.length !== playerCount) {
        throw new Error(`Sono stati generati ${generatedStory.characters.length} personaggi, ma ne erano richiesti ${playerCount}. Riprova.`);
      }

      setStory(generatedStory);
    } catch (err: any) {
      setError(err.message || 'Si è verificato un errore durante la generazione della storia. Potrebbe essere un problema con la chiave API o una risposta inattesa dal modello. Riprova.');
      console.error('Story generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStory(null);
    setError(null);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 p-4 sm:p-8 flex flex-col items-center">
      <header className="w-full max-w-5xl text-center mb-8">
        <div className="flex justify-center items-center gap-4 mb-2">
          <DetectiveIcon className="w-12 h-12 text-amber-300" />
          <h1 className="text-4xl sm:text-5xl font-bold text-amber-200">Generatore di Cene con Delitto</h1>
        </div>
        <p className="text-lg text-gray-300 mb-4">Crea misteri coinvolgenti e adatti a tutto il pubblico per serate indimenticabili.</p>
        <div className="bg-gray-800/70 p-5 rounded-lg text-left max-w-3xl mx-auto space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">Cene con Delitto gratis e responsabili</h2>
          <p className="text-gray-300">
            Benvenuto nel miglior <strong>generatore di cene con delitto</strong> online e completamente gratuito.
            Crea storie di fiction per organizzare <strong>giochi con delitto</strong> e <strong>giochi da fare a cena</strong> con i tuoi amici, senza costi e senza limiti.
          </p>
          <p className="text-gray-300">
            Tutti gli scenari prodotti sono verificati per evitare linguaggio esplicito, scene violente grafiche o discriminazioni, così da rispettare le <strong>Norme sul contenuto di Google AdSense</strong> e offrire esperienze inclusive.
          </p>
        </div>
      </header>

      <main id="main-content" className="w-full max-w-5xl bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-2xl shadow-black/30 p-6 sm:p-8">
        {!story && !isLoading && <SetupForm onGenerate={handleGenerateStory} />}
        {isLoading && <LoadingSpinner />}
        {error && (
          <div className="text-center" role="alert" aria-live="assertive">
            <p className="text-red-400 text-xl mb-4">{error}</p>
            <button
              onClick={handleReset}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
            >
              Torna indietro
            </button>
          </div>
        )}
        {story && !isLoading && <StoryDisplay story={story} onReset={handleReset} />}
      </main>

      <footer className="w-full max-w-5xl text-center mt-8 text-gray-400 text-sm space-y-3">
        <nav aria-label="Informazioni legali e di supporto">
          <ul className="flex flex-wrap justify-center gap-4">
            <li><a className="hover:text-amber-300 underline-offset-4 hover:underline" href="/privacy-policy.html">Privacy Policy</a></li>
            <li><a className="hover:text-amber-300 underline-offset-4 hover:underline" href="/termini-e-condizioni.html">Termini di Servizio</a></li>
            <li><a className="hover:text-amber-300 underline-offset-4 hover:underline" href="/cookie-policy.html">Cookie Policy</a></li>
            <li><a className="hover:text-amber-300 underline-offset-4 hover:underline" href="mailto:catalangelo@icloud.com">Contattaci</a></li>
          </ul>
        </nav>
        <p className="text-xs text-gray-500">
          Le storie generate sono opere di fantasia e non promuovono violenza reale. Utilizzando il servizio accetti di condividere solo contenuti conformi alle nostre linee guida.
        </p>
      </footer>
    </div>
  );
};

export default App;

