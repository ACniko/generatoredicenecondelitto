import React, { useState, useRef, useEffect } from 'react';
import type { GenerationCheckpoint, GenerationProgress } from './services/generationTypes';
import { loadGeneration, saveGeneration, deleteGeneration } from './services/generationStorage';
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
    title: 'Temi rapidi, storie complete',
    description: "Scegli un tema e crea una storia originale pensata per una partita di 2–3 ore."
  },
  {
    icon: <MapIcon className="w-6 h-6 text-amber-300" aria-hidden="true" />,
    title: 'Materiale completo',
    description: "PDF A4 con schede individuali, indizi distribuiti per round, guida e soluzione per l’organizzatore."
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
      "Scegli numero di partecipanti e tema. L'intelligenza artificiale prepara una storia completa, pensata per una serata intera."
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
      "Checklist stampabili, guide per l'organizzatore e suggerimenti narrativi ti aiutano a creare esperienze memorabili."
  },
  {
    icon: <MapIcon className="w-6 h-6 text-amber-300" aria-hidden="true" />,
    title: 'Documentazione trasparente',
    description:
      "Policy, contatti e pagina di supporto sono sempre disponibili per garantire massima conformità alle norme."
  }
];

const generatorTips = [
  "Aggiorna i temi con il pulsante AI finché non trovi l'ispirazione perfetta.",
  "Scarica i PDF per round appena generati per evitare spoiler ai partecipanti.",
  "Stampa la checklist pre-evento per non dimenticare materiali o indicazioni importanti."
];

const App: React.FC = () => {
  const [restored] = useState(() => loadGeneration());
  const [checkpoint, setCheckpoint] = useState<GenerationCheckpoint | undefined>(restored.checkpoint);
  const [warning, setWarning] = useState<string | undefined>(restored.warning);
  const [story, setStory] = useState<StoryData | null>(restored.checkpoint?.status === 'complete' ? restored.checkpoint.finalStory! : null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<GenerationProgress>();
  const [now, setNow] = useState(Date.now());
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => { clearInterval(timer); controller.current?.abort(); }; }, []);

  const handleGenerateStory = async (playerCount: number, theme: string, resume?: GenerationCheckpoint) => {
    if (running.current) return;
    running.current = true;
    setIsLoading(true); setError(null); setStory(null);
    const abort = new AbortController(); controller.current = abort;
    const execute = async () => {
      const generatedStory = await generateMurderMysteryStory(playerCount, theme, {
        checkpoint: resume, signal: abort.signal, onProgress: setProgress,
        onCheckpoint: value => { setCheckpoint(value); const issue = saveGeneration(value); if (issue) setWarning(issue); },
      });
      if (!abort.signal.aborted) setStory(generatedStory);
    };
    let leaseTimer: ReturnType<typeof setInterval> | undefined;
    const leaseKey = 'murder-mystery:generation:lease';
    const owner = globalThis.crypto?.randomUUID?.() ?? String(Math.random());
    let ownedLease = false;
    try {
      const locks = (navigator as any).locks;
      if (locks) {
        await locks.request('murder-mystery:generation', { ifAvailable: true }, async (lock: unknown) => {
          if (!lock) throw new Error('Una generazione è già attiva in un’altra scheda.');
          await execute();
        });
      } else {
        try {
          const old = JSON.parse(localStorage.getItem(leaseKey) || 'null');
          if (old?.expires > Date.now()) throw new Error('Una generazione è già attiva in un’altra scheda.');
          localStorage.setItem(leaseKey, JSON.stringify({ owner, expires: Date.now() + 15000 }));
          ownedLease = true;
          // Allow competing tabs to observe the lease before beginning any request.
          await new Promise(resolve => setTimeout(resolve, 100));
          if (JSON.parse(localStorage.getItem(leaseKey) || 'null')?.owner !== owner) throw new Error('Una generazione è già attiva in un’altra scheda.');
          leaseTimer = setInterval(() => {
            try {
              if (JSON.parse(localStorage.getItem(leaseKey) || 'null')?.owner !== owner) { abort.abort(); return; }
              localStorage.setItem(leaseKey, JSON.stringify({ owner, expires: Date.now() + 15000 }));
            } catch { abort.abort(); }
          }, 4000);
        } catch (issue) {
          if (issue instanceof Error && issue.message.includes('altra scheda')) throw issue;
          setWarning('Salvataggio locale non disponibile: i progressi restano in questa pagina. La protezione dalle generazioni duplicate è limitata a questa scheda.');
        }
        await execute();
      }
    } catch (err: any) {
      if (!abort.signal.aborted) setError(err.message || 'Generazione interrotta. Puoi riprendere i progressi salvati.');
    } finally {
      if (leaseTimer) clearInterval(leaseTimer);
      if (ownedLease) { try { if (JSON.parse(localStorage.getItem(leaseKey) || 'null')?.owner === owner) localStorage.removeItem(leaseKey); } catch {} }
      running.current = false; controller.current = null; setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (running.current) return;
    const issue = deleteGeneration(); setWarning(issue); setCheckpoint(undefined);
    setStory(null); setError(null); setProgress(undefined);
  };
  const retrySeconds = Math.max(0, Math.ceil(((checkpoint?.retryAt ?? 0) - now) / 1000));

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
                Organizza una cena con delitto pronta per una serata intera
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
                    Scegli un tema e il numero di partecipanti. L’AI prepara un caso completo con indizi e materiali da distribuire in tre round.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-amber-200">
                  <HourGlassIcon className="w-4 h-4" aria-hidden="true" /> partita consigliata: 2–3 ore
                </div>
              </div>

              {!story && !isLoading && !checkpoint && (
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

              {warning && <div role="status" className="rounded-lg border border-amber-400 p-4">{warning}<button className="ml-4 underline" onClick={handleReset} disabled={isLoading}>Nuova storia / elimina salvataggio</button></div>}
              {checkpoint && !story && !isLoading && <div className="space-y-3 rounded-lg border border-amber-400/40 p-4" role="status">
                <p>Storia salvata: {checkpoint.input.theme} · {checkpoint.input.playerCount} partecipanti</p>
                {retrySeconds > 0 && <p>Ripresa disponibile tra {retrySeconds} secondi.</p>}
                <button className="rounded bg-amber-500 px-4 py-2 text-slate-950 disabled:opacity-40" disabled={retrySeconds > 0} onClick={() => handleGenerateStory(checkpoint.input.playerCount, checkpoint.input.theme, checkpoint)}>Riprendi</button>
                <button className="ml-4 underline" onClick={handleReset}>Elimina / nuova storia</button>
              </div>}
              {isLoading && <><LoadingSpinner progress={progress} /><button className="underline" onClick={() => controller.current?.abort()}>Annulla e conserva i progressi</button></>}

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

              {story && !isLoading && (
                <>
                  {story.verificationWarning && (
                    <div className="mb-6 rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-amber-100" role="status">
                      {story.verificationWarning}
                    </div>
                  )}
                  <StoryDisplay story={story} onReset={handleReset} />
                </>
              )}
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


