import React, { useState, useRef } from 'react';
import { UserGroupIcon, BeakerIcon } from './icons';

interface SetupFormProps {
  onGenerate: (playerCount: number, theme: string) => void;
}

const themes = [
  "Mistero in villa vittoriana",
  "Intrigo in una stazione spaziale futuristica",
  "Delitto sul red carpet di Hollywood",
  "Cospirazione durante un ballo in maschera veneziano",
  "Segreti in un maniero di campagna inglese",
  "Enigma a bordo di un treno notturno"
];

const CUSTOM_THEME_VALUE = 'custom';

const SetupForm: React.FC<SetupFormProps> = ({ onGenerate }) => {
  const [playerCount, setPlayerCount] = useState<number>(5);
  const [themeSelection, setThemeSelection] = useState<string>(themes[0]);
  const [customTheme, setCustomTheme] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement | null>(null);

  const isCustomTheme = themeSelection === CUSTOM_THEME_VALUE;

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

      <div>
        <label htmlFor="theme" className="flex items-center gap-2 text-lg font-medium text-gray-300 mb-2">
          <BeakerIcon className="w-6 h-6" aria-label="Icona del tema" />
          Tema della serata
        </label>
        <select
          id="theme"
          value={themeSelection}
          onChange={(event) => setThemeSelection(event.target.value)}
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
        >
          {themes.map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
          <option value={CUSTOM_THEME_VALUE}>Tema personalizzato…</option>
        </select>

        {isCustomTheme && (
          <div className="mt-4 transition-all duration-300">
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
