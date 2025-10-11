import React, { useState } from 'react';
import type { StoryData } from './types';
import { generateMurderMysteryStory } from './services/adapter';
import SetupForm from './components/SetupForm';
import LoadingSpinner from './components/LoadingSpinner';
import StoryDisplay from './components/StoryDisplay';
import ArticlesSection from './components/ArticlesSection';
import {
  DetectiveIcon,
  MapIcon,
  UserGroupIcon,
  BookOpenIcon,
  BeakerIcon,
  KeyIcon,
  HourGlassIcon,
} from './components/icons';

const heroShowcase = [
  {
    icon: <BeakerIcon className="w-6 h-6 text-amber-300" aria-hidden="true" />,
    title: 'Generazione immediata',
    description: "Temi sintetici diversi ad ogni visita, pronti per essere adattati al tuo gruppo."
  },
  {
    icon: <MapIcon className="w-6 h-6 text-amber-300" aria-hidden="true" />,
    title: 'Materiale completo',
    description: "PDF per round con schede personaggio, documento comune e soluzione già impaginati."
  },
  {
    icon: <UserGroupIcon className="w-6 h-6 text-amber-300" aria-hidden="true" />,
    title: 'Adatto a tutti',
    description: "Contenuti controllati e personalizzabili, conformi alle Norme del programma AdSense."
  }
];

const howItWorks = [
  {
    icon: <UserGroupIcon className="w-7 h-7 text-amber-300" aria-hidden="true" />,
    title: 'Configura la serata',
    description:
      "Scegli numero di partecipanti e tema. L'intelligenza artificiale propone rapidamente nuove idee sintetiche."
  },
  {
    icon: <MapIcon className="w-7 h-7 text-amber-300" aria-hidden="true" />,
    title: 'Scarica i materiali',
    description:
      'Documenti per round, schede personaggio e soluzione sono pronti da stampare o condividere in digitale.'
  },
  {
    icon: <BookOpenIcon className="w-7 h-7 text-amber-300" aria-hidden="true" />,
    title: 'Segui le checklist',
    description:
      'Guide pratiche, ambientazioni alternative e consigli per coinvolgere ogni ospite ti accompagnano passo dopo passo.'
  }
];

const qualityHighlights = [
  {
    icon: <KeyIcon className="w-6 h-6 text-amber-300" aria-hidden="true" />,
    title: 'Contenuti verificati',
    description:
      "Ogni storia elimina duplicati, linguaggio esplicito e materiale sensibile grazie a controlli automatici e fallback editoriali."
  },
  {
    icon: <BookOpenIcon className="w-6 h-6 text-amber-300" aria-hidden="true" />,
    title: 'Risorse editoriali',
    description:
      'Checklist stampabili, guide per l'organizzatore e suggerimenti narrativi ti aiutano a creare esperienze memorabili.'
  },
  {
    icon: <MapIcon className="w-6 h-6 text-amber-300" aria-hidden="true" />,
    title: 'Documentazione trasparente',
    description:
      "Policy, contatti e pagina di supporto sono sempre disponibili per garantire massima conformità alle norme."
  }
];

const generatorTips = [
  'Aggiorna i temi con il pulsante AI finché non trovi l'ispirazione perfetta.',
  "Scarica i PDF per round appena generati per evitare spoiler ai partecipanti.",
  "Stampa la checklist pre-evento per non dimenticare materiali o indicazioni importanti."
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
        throw new Error(Sono stati generati  personaggi, ma ne erano richiesti . Riprova.);
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
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.4),_transparent_55%)]" />

      <div className="relative w-full">
        <header className="w-full border-b border-slate-800/60 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
          <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 md:px-6">
            <a href="/" className="flex items-center gap-2 text-lg font-semibold text-amber-200">
              <DetectiveIcon className="w-6 h-6" aria-hidden="true" />
              Generatore di Cene con Delitto
            </a>
            <div className="md:hidden flex items-center gap-3">
              <a
                href="#generator"
                className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200"
              >
                Generatore
              </a>
            </div>
            <div className="hidden items-center gap-6 text-sm font-semibold text-slate-300 md:flex">
              <a className="hover:text-amber-200 transition-colors" href="#generator">Generatore</a>
              <a className="hover:text-amber-200 transition-colors" href="#guide-section">Guide</a>
              <a className="hover:text-amber-200 transition-colors" href="/about.html">Chi siamo</a>
              <a className="hover:text-amber-200 transition-colors" href="/contattaci.html">Contatti</a>
            </div>
            <a
              href="#generator"
              className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-400/30 transition-transform hover:-translate-y-0.5 hover:bg-amber-300"
            >
              Inizia ora
            </a>
          </nav>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 pb-16 pt-6 sm:gap-10 md:gap-16 md:px-8" id="main-content">
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center">
            <div className="space-y-6">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200">Esperienze investigative accessibili</p>
              <h1 className="text-4xl font-bold text-white md:text-5xl">
                Organizza una cena con delitto coinvolgente in pochi minuti
              </h1>
              <p className="text-base text-slate-300 md:text-lg">
                Genera storie originali verificate, scarica materiali pronti e segui le guide per gestire ogni fase della serata.
                Nessun costo, massimo controllo editoriale.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href="#generator"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-400/30 transition-transform hover:-translate-y-0.5 hover:bg-amber-300"
                >
                  <BeakerIcon className="w-4 h-4" aria-hidden="true" /> Genera una storia
                </a>
                <a
                  href="#guide-section"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-400/40 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-amber-200 transition-colors hover:bg-slate-900/80"
                >
                  <BookOpenIcon className="w-4 h-4" aria-hidden="true" /> Esplora le guide
                </a>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex gap-4 overflow-x-auto rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 sm:grid sm:grid-cols-1 sm:gap-4 md:grid-cols-2">
                {heroShowcase.map((item) => (
                  <div key={item.title} className="min-w-[220px] sm:min-w-0 rounded-xl border border-slate-800/60 bg-slate-950/60 p-4">
                    <div className="flex items-center gap-3 text-amber-300 mb-2">{item.icon}</div>
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-xs text-slate-300 leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="generator" className="scroll-mt-24 rounded-2xl border border-amber-400/30 bg-slate-900/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.45)] sm:p-8">
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200">Generatore rapido</p>
                  <h2 className="text-2xl font-semibold text-white md:text-3xl">Crea la tua storia subito</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Inserisci poche informazioni, lascia che l'AI proponga temi concisi e scarica i PDF per ogni round. Ideale anche su smartphone.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-amber-200">
                  <HourGlassIcon className="w-4 h-4" aria-hidden="true" /> tempo medio 5 minuti
                </div>
              </div>

              {!story && !isLoading && (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.85fr)]">
                  <div className="order-1">
                    <SetupForm onGenerate={handleGenerateStory} />
                  </div>
                  <aside className="order-2 flex flex-col gap-4 rounded-xl border border-amber-400/30 bg-amber-400/5 p-6">
                    <h3 className="text-base font-semibold text-amber-200 flex items-center gap-2">
                      <MapIcon className="w-5 h-5" aria-hidden="true" />
                      Suggerimenti rapidi
                    </h3>
                    <ul className="space-y-3 text-sm text-amber-100/90">
                      {generatorTips.map((tip, index) => (
                        <li key={index} className="flex gap-3">
                          <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300/40 text-xs font-semibold text-amber-200">
                            {index + 1}
                          </span>
                          <p className="leading-relaxed text-slate-200">{tip}</p>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-auto text-xs text-amber-100/80">
                      Consiglio: genera i PDF subito dopo aver scelto il tema per salvare una copia con i nomi personalizzati.
                    </p>
                  </aside>
                </div>
              )}

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
            </div>
          </section>

          <section className="grid gap-6 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-6 sm:p-8 md:grid-cols-3" id="come-funziona">
            <div className="space-y-3 md:col-span-1">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-200">Workflow</p>
              <h2 className="text-2xl font-semibold text-white md:text-3xl">Come funziona il generatore</h2>
              <p className="text-sm text-slate-300">
                Dalla scelta del tema alla rivelazione finale: trasformiamo pochi input in un'esperienza narrativa completa, pronta da giocare.
              </p>
            </div>
            <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
              {howItWorks.map((step) => (
                <div key={step.title} className="flex h-full flex-col gap-3 rounded-xl border border-slate-800/60 bg-slate-950/60 p-5">
                  <div className="flex items-center gap-3 text-amber-300">{step.icon}</div>
                  <h3 className="text-base font-semibold text-white">{step.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-6 sm:p-8 md:grid-cols-3">
            {qualityHighlights.map((item) => (
              <div key={item.title} className="flex h-full flex-col gap-3 rounded-xl border border-slate-800/60 bg-slate-950/60 p-5">
                <div className="flex items-center gap-3 text-amber-300">{item.icon}</div>
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </section>
        </main>

        <ArticlesSection />

        <section className="mx-auto mt-12 w-full max-w-6xl rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-amber-200">Hai bisogno di supporto immediato?</h2>
          <p className="mt-3 text-slate-300">
            Il nostro team editoriale è disponibile per verificare scenari personalizzati, adattare trame ad ambiti scolastici o creare
            materiale aggiuntivo. Scrivici a
            <a className="ml-2 text-amber-300 hover:text-amber-200 font-semibold" href="mailto:catalangelo@icloud.com">catalangelo@icloud.com</a>
            e riceverai risposta entro 48 ore lavorative.
          </p>
        </section>

        <footer className="mx-auto mt-12 w-full max-w-6xl border-t border-slate-800/60 py-8 text-center text-sm text-slate-400">
          <nav aria-label="Informazioni legali e di supporto">
            <ul className="flex flex-wrap justify-center gap-4">
              <li><a className="hover:text-amber-300 underline-offset-4 hover:underline" href="/about.html">Chi siamo</a></li>
              <li><a className="hover:text-amber-300 underline-offset-4 hover:underline" href="/privacy-policy.html">Privacy Policy</a></li>
              <li><a className="hover:text-amber-300 underline-offset-4 hover:underline" href="/termini-e-condizioni.html">Termini di Servizio</a></li>
              <li><a className="hover:text-amber-300 underline-offset-4 hover:underline" href="/cookie-policy.html">Cookie Policy</a></li>
              <li><a className="hover:text-amber-300 underline-offset-4 hover:underline" href="/contattaci.html">Contatti</a></li>
            </ul>
          </nav>
          <p className="mt-4 text-xs text-slate-500">
            Le storie generate sono opere di fantasia e non promuovono violenza reale. Utilizzando il servizio accetti di condividere
            solo contenuti conformi alle nostre linee guida.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default App;


