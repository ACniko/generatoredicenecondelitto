
import React, { useState } from 'react';
import { UserGroupIcon, BeakerIcon } from './icons';

interface SetupFormProps {
  onGenerate: (playerCount: number, theme: string) => void;
}

const themes = [
  "Mistero in Villa Vittoriana",
  "Omicidio in uno Speakeasy Anni '20",
  "Delitto sul Red Carpet di Hollywood",
  "Intrigo in un Maniero di Campagna Inglese",
  "Complotto in una Stazione Spaziale Futurisica",
  "Veleno a un Ballo in Maschera Veneziano"
];

const CUSTOM_THEME_VALUE = "custom";

const SetupForm: React.FC<SetupFormProps> = ({ onGenerate }) => {
  const [playerCount, setPlayerCount] = useState<number>(5);
  const [themeSelection, setThemeSelection] = useState<string>(themes[0]);
  const [customTheme, setCustomTheme] = useState<string>("");

  const isCustomTheme = themeSelection === CUSTOM_THEME_VALUE;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTheme = isCustomTheme ? customTheme : themeSelection;
    if (finalTheme.trim() === "") {
        alert("Il tema personalizzato non può essere vuoto.");
        return;
    }
    onGenerate(playerCount, finalTheme);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-amber-300">Imposta la tua storia</h2>
        <p className="text-gray-400">Scegli i dettagli per generare un'avventura unica.</p>
      </div>

      <div>
        <label htmlFor="playerCount" className="flex items-center gap-2 text-lg font-medium text-gray-300 mb-2">
            <UserGroupIcon className="w-6 h-6" />
            Numero di Partecipanti
        </label>
        <div className="flex items-center gap-4">
            <input
                type="range"
                id="playerCount"
                min="4"
                max="12"
                value={playerCount}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <span className="text-xl font-bold text-amber-300 w-12 text-center bg-gray-700/50 rounded-md py-1">{playerCount}</span>
        </div>
      </div>

      <div>
        <label htmlFor="theme" className="flex items-center gap-2 text-lg font-medium text-gray-300 mb-2">
            <BeakerIcon className="w-6 h-6" />
            Tema della Serata
        </label>
        <select
          id="theme"
          value={themeSelection}
          onChange={(e) => setThemeSelection(e.target.value)}
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
        >
          {themes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
          <option value={CUSTOM_THEME_VALUE}>Tema Personalizzato...</option>
        </select>
        
        {isCustomTheme && (
            <div className="mt-4 transition-all duration-300">
                <input
                    type="text"
                    placeholder="Es: Mistero su un sottomarino artico"
                    value={customTheme}
                    onChange={(e) => setCustomTheme(e.target.value)}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                    required
                    aria-label="Tema personalizzato"
                />
            </div>
        )}
      </div>

      <div className="pt-4">
        <button
          type="submit"
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-amber-900/30"
        >
          Genera il Mistero
        </button>
      </div>
    </form>
  );
};

export default SetupForm;
