import React, { useState } from 'react';
import type { StoryData } from './types';
import { generateMurderMysteryStory } from './services/adapter';
import SetupForm from './components/SetupForm';
import LoadingSpinner from './components/LoadingSpinner';
import StoryDisplay from './components/StoryDisplay';
import ArticlesSection from './components/ArticlesSection';
import { DetectiveIcon, MapIcon, UserGroupIcon, BookOpenIcon } from './components/icons';

const qualityHighlights = [
  {
    title: 'Linee guida rispettate',
    description:
      'Ogni storia viene generata evitando linguaggio esplicito, discriminazioni e contenuti vietati. Il sistema applica controlli automatici e fallback manuali per garantire trame adatte a famiglie e contesti educativi.'
  },
  {
    title: 'Esperienza editoriale completa',
    description:
      'Guide dettagliate, checklist stampabili e suggerimenti professionali aiutano gli organizzatori a creare serate memorabili. Il generatore è solo l inizio di un ecosistema di risorse continuamente aggiornate.'
  },
  {
    title: 'Documentazione trasparente',
    description:
      'Policy, contatti e pagina di supporto sono sempre accessibili. Aggiorniamo le informazioni legali in base alle normative italiane ed europee e adottiamo un approccio proattivo alla protezione dei dati.'
  }
];

const howItWorks = [
  {
    icon: <UserGroupIcon className="w-7 h-7 text-amber-300" aria-hidden="true" />,
    title: 'Imposta il tuo gruppo',
    description:
      'Seleziona il numero di partecipanti, da quattro a dodici, e scegli uno dei temi proposti dall intelligenza artificiale. In alternativa inserisci un idea personalizzata in pochi secondi.'
  },
  {
    icon: <MapIcon className="w-7 h-7 text-amber-300" aria-hidden="true" />,
    title: 'Ricevi materiale completo',
    description:
      'Documenti comuni, schede dei personaggi e soluzione sono organizzati per round con PDF pronti da scaricare. Puoi aggiungere note personali e stampare solo ciò che ti serve.'
  },
  {
    icon: <BookOpenIcon className="w-7 h-7 text-amber-300" aria-hidden="true" />,
    title: 'Segui le guide pratiche',
    description:
      'Consulta gli approfondimenti inclusi nel sito: consigli per l organizzatore, ambientazioni alternative, strategie per coinvolgere ospiti timidi e checklist di qualità.'
  }
];

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
      setError(
        err.message ||
          'Si è verificato un errore durante la generazione della storia. Potrebbe essere un problema con la chiave API o una risposta inattesa dal modello. Riprova.'
      );
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
      <header className="w-full max-w-5xl text-center mb-10 space-y-6">
        <div className="flex justify-center items-center gap-4">
          <DetectiveIcon className="w-12 h-12 text-amber-300" />
          <h1 className="text-4xl sm:text-5xl font-bold text-amber-200">Generatore di Cene con Delitto</h1>
        </div>
        <p className="text-lg text-gray-300">
          Crea misteri coinvolgenti e adatti a tutto il pubblico per serate indimenticabili. Il nostro obiettivo è offrire uno
          strumento gratuito, sicuro e supportato da risorse editoriali di qualità.
        </p>
        <div className="bg-gray-800/70 p-6 rounded-lg text-left space-y-3">
          <h2 className="text-xl font-semibold text-amber-300">Sicurezza, narrativa e supporto continuo</h2>
          <p className="text-gray-300">
            Benvenuto nel miglior generatore online di cene con delitto in italiano. Ogni storia passa controlli automatici per
            rispettare le Norme del programma AdSense e proporre contenuti inclusivi. Accanto al generatore trovi guide pratiche,
            checklist stampabili e consigli per coinvolgere ogni invitato.
          </p>
        </div>
      </header>

      <main id="main-content" className="w-full max-w-5xl space-y-8">
        <section className="grid gap-6 sm:grid-cols-3">
          {qualityHighlights.map((item) => (
            <div key={item.title} className="bg-gray-800/60 border border-gray-700 rounded-lg p-5 space-y-3 shadow-lg shadow-black/20">
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </section>

        <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-6">
          <h2 className="text-2xl font-semibold text-amber-200 text-center">Come funziona il generatore</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {howItWorks.map((step) => (
              <div key={step.title} className="space-y-3 bg-gray-900/40 border border-gray-700 rounded-lg p-5">
                <div className="flex items-center gap-3 text-amber-300">{step.icon}<span className="sr-only">Icona</span></div>
                <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          {!story && !isLoading && <SetupForm onGenerate={handleGenerateStory} />}
          {isLoading && <LoadingSpinner />}
          {error && (
            <div className="text-center space-y-4" role="alert" aria-live="assertive">
              <p className="text-red-400 text-xl">{error}</p>
              <button
                onClick={handleReset}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
              >
                Torna indietro
              </button>
            </div>
          )}
          {story && !isLoading && <StoryDisplay story={story} onReset={handleReset} />}
        </section>
      </main>

      <ArticlesSection />

      <section className="w-full max-w-5xl mt-8 bg-gray-800/60 border border-gray-700 rounded-lg p-6 space-y-4">
        <h2 className="text-2xl font-semibold text-amber-200">Serve assistenza immediata?</h2>
        <p className="text-gray-300">
          Abbiamo predisposto un canale di supporto dedicato per segnalazioni e richieste di personalizzazione. Scrivici a
          <a className="text-amber-300 hover:text-amber-200 font-semibold ml-1" href="mailto:catalangelo@icloud.com">catalangelo@icloud.com</a>
          e ti aiuteremo a configurare la tua serata o a risolvere eventuali dubbi sulle norme dei contenuti.
        </p>
      </section>

      <footer className="w-full max-w-5xl text-center mt-10 text-gray-400 text-sm space-y-3">
        <nav aria-label="Informazioni legali e di supporto">
          <ul className="flex flex-wrap justify-center gap-4">
            <li><a className="hover:text-amber-300 underline-offset-4 hover:underline" href="/about.html">Chi siamo</a></li>
            <li><a className="hover:text-amber-300 underline-offset-4 hover:underline" href="/privacy-policy.html">Privacy Policy</a></li>
            <li><a className="hover:text-amber-300 underline-offset-4 hover:underline" href="/termini-e-condizioni.html">Termini di Servizio</a></li>
            <li><a className="hover:text-amber-300 underline-offset-4 hover:underline" href="/cookie-policy.html">Cookie Policy</a></li>
            <li><a className="hover:text-amber-300 underline-offset-4 hover:underline" href="/contattaci.html">Contatti</a></li>
          </ul>
        </nav>
        <p className="text-xs text-gray-500">
          Le storie generate sono opere di fantasia e non promuovono violenza reale. Utilizzando il servizio accetti di condividere
          solo contenuti conformi alle nostre linee guida.
        </p>
      </footer>
    </div>
  );
};

export default App;
