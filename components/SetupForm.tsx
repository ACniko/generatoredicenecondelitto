import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UserGroupIcon, BeakerIcon } from './icons';

interface SetupFormProps {
  onGenerate: (playerCount: number, theme: string) => void;
}

const FALLBACK_THEMES = [
  "Mistero in villa vittoriana",
  "Intrigo in una stazione spaziale futuristica",
  "Delitto sul red carpet di Hollywood",
  "Cospirazione in un ballo in maschera",
  "Segreti in un maniero inglese",
  "Enigma a bordo di un treno notturno"
];

const CUSTOM_THEME_VALUE = 'custom';
const THEMES_REQUESTED = 6;

const SetupForm: React.FC<SetupFormProps> = ({ onGenerate }) => {
  const [playerCount, setPlayerCount] = useState<number>(5);
  const [themes, setThemes] = useState<string[]>(FALLBACK_THEMES);
  const [themeSelection, setThemeSelection] = useState<string>(FALLBACK_THEMES[0]);
  const [customTheme, setCustomTheme] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [isFetchingThemes, setIsFetchingThemes] = useState<boolean>(false);
  const errorRef = useRef<HTMLParagraphElement | null>(null);

  const isCustomTheme = themeSelection === CUSTOM_THEME_VALUE;

  const sanitizeThemes = (rawThemes: unknown): string[] => {
    if (!Array.isArray(rawThemes)) {
      return [];
    }

    const cleaned = rawThemes
      .map((theme) => (typeof theme === 'string' ? theme : ''))
      .map((theme) => theme.replace(/\s+/g, ' ').trim())
      .filter((theme) => theme.length > 0)
      .filter((theme) => theme.split(' ').length <= 5);

    return Array.from(new Set(cleaned)).slice(0, THEMES_REQUESTED);
  };

  const refreshThemes = useCallback(async () => {
    setIsFetchingThemes(true);
    setThemeError(null);

    try {
      const prompt = `Genera ${THEMES_REQUESTED} temi sintetici per una cena con delitto.\n` +
        'Ogni tema deve essere in italiano, creativo, adatto a un pubblico generale e privo di contenuti vietati.\n' +
        'Scrivi frasi diverse fra loro, con massimo cinque parole ciascuna.\n' +
        'Restituisci solamente un JSON con la chiave "themes" contenente una lista di stringhe.';

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model: 'llama-3.1-8b-instant',
          temperature: 0.9,
          top_p: 0.9,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`Impossibile generare temi (HTTP ${response.status})`);
      }

      const { content } = await response.json();
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      const generatedThemes = sanitizeThemes(parsed?.themes);

      if (generatedThemes.length === 0) {
        throw new Error('Temi generati non validi. Uso fallback.');
      }

      const wasCustom = isCustomTheme;
      const previousSelection = themeSelection;

      setThemes(generatedThemes);

      if (!wasCustom) {
        const safeSelection = generatedThemes.includes(previousSelection)
          ? previousSelection
          : generatedThemes[0];
        setThemeSelection(safeSelection ?? FALLBACK_THEMES[0]);
      }
    } catch (error) {
      console.error('AI theme generation failed:', error);
      setThemes(FALLBACK_THEMES);
      setThemeSelection((prev) => (prev === CUSTOM_THEME_VALUE ? prev : FALLBACK_THEMES[0]));
      setThemeError('Temi AI non disponibili. Usati temi di base.');
    } finally {
      setIsFetchingThemes(false);
    }
  }, [isCustomTheme, themeSelection]);

  useEffect(() => {
    refreshThemes();
  }, [refreshThemes]);

  useEffect(() => {
    if (!isCustomTheme && !themes.includes(themeSelection)) {
      setThemeSelection(themes[0] ?? FALLBACK_THEMES[0] ?? CUSTOM_THEME_VALUE);
    }
  }, [themes, themeSelection, isCustomTheme]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const finalTheme = isCustomTheme ? customTheme.trim() : themeSelection;

    if (finalTheme.length < 5) {
      setFormError('Inserisci un tema descrittivo di almeno 5 caratteri.');
      requestAnimationFrame(() => {
        errorRef.current?.focus();
      });
      return;
    }

    setFormError(null);
    onGenerate(playerCount, finalTheme);
  };

  const handleThemeRefresh = () => {
    if (!isFetchingThemes) {
      refreshThemes();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-amber-300">Imposta la tua storia</h2>
        <p className="text-gray-400">
          Scegli il numero di partecipanti e un tema. Le storie sono controllate per rispettare le politiche sui contenuti.
        </p>
      </div>

      <div>
        <label htmlFor="playerCount" className="flex items-center gap-2 text-lg font-medium text-gray-300 mb-2">
          <UserGroupIcon className="w-6 h-6" aria-label="Icona del gruppo" />
          Numero di partecipanti
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            id="playerCount"
            min="4"
            max="12"
            value={playerCount}
            onChange={(event) => setPlayerCount(Number(event.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            aria-valuemin={4}
            aria-valuemax={12}
            aria-valuenow={playerCount}
          />
          <span className="text-xl font-bold text-amber-300 w-12 text-center bg-gray-700/50 rounded-md py-1" aria-live="polite">
            {playerCount}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="theme" className="flex items-center gap-2 text-lg font-medium text-gray-300">
            <BeakerIcon className="w-6 h-6" aria-label="Icona del tema" />
            Tema della serata
          </label>
          <button
            type="button"
            onClick={handleThemeRefresh}
            className="text-sm font-semibold text-amber-300 hover:text-amber-200 underline-offset-4 hover:underline disabled:opacity-50"
            disabled={isFetchingThemes}
          >
            {isFetchingThemes ? 'Generazione temi...' : "Genera nuovi temi con l'AI"}
          </button>
        </div>

        <select
          id="theme"
          value={themeSelection}
          onChange={(event) => setThemeSelection(event.target.value)}
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
          aria-busy={isFetchingThemes}
        >
          {themes.map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
          <option value={CUSTOM_THEME_VALUE}>Tema personalizzato...</option>
        </select>

        {themeError && (
          <p className="text-sm text-amber-300" role="status">
            {themeError}
          </p>
        )}

        {isCustomTheme && (
          <div className="mt-2 transition-all duration-300">
            <label htmlFor="customTheme" className="sr-only">
              Inserisci un tema personalizzato
            </label>
            <input
              id="customTheme"
              type="text"
              placeholder="Es: Mistero durante una missione artica"
              value={customTheme}
              onChange={(event) => setCustomTheme(event.target.value)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              aria-describedby={formError ? 'setup-form-error' : undefined}
            />
          </div>
        )}
      </div>

      {formError && (
        <p
          id="setup-form-error"
          ref={errorRef}
          className="text-red-400 bg-red-900/30 border border-red-600/40 rounded-md p-3"
          role="alert"
          tabIndex={-1}
        >
          {formError}
        </p>
      )}

      <div className="pt-4">
        <button
          type="submit"
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-amber-900/30"
        >
          Genera il mistero
        </button>
      </div>
    </form>
  );
};

export default SetupForm;
