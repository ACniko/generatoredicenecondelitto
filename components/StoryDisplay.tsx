import React, { useRef } from 'react';
import type { StoryData, Character } from '../types';
import { UserIcon, BookOpenIcon, KeyIcon, ArrowUturnLeftIcon, MapIcon } from './icons';

declare const jspdf: any;
declare const html2canvas: any;

interface StoryDisplayProps {
  story: StoryData;
  onReset: () => void;
}

const PDF_OPTIONS = {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff' // Use white background for PDFs
};

const generatePdf = async (element: HTMLElement, filename: string) => {
    if (!element) return;

    // Temporarily make the element visible for rendering
    element.parentElement!.style.position = 'relative';
    element.parentElement!.style.left = '0';

    const canvas = await html2canvas(element, PDF_OPTIONS);
    
    // Hide the element again
    element.parentElement!.style.position = 'absolute';
    element.parentElement!.style.left = '-9999px';

    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jspdf.jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [canvas.width, canvas.height]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(filename);
};

const StoryDisplay: React.FC<{story: StoryData, onReset: () => void}> = ({ story, onReset }) => {
  // Verifica che la storia sia valida e completa
  if (!story || !story.commonDocument || !story.characters || !story.solution) {
    return (
      <div className="text-center p-6 bg-red-800/50 rounded-lg">
        <h2 className="text-2xl font-bold text-white mb-4">Errore nella struttura della storia</h2>
        <p className="text-gray-200 mb-4">La storia generata non è valida o è incompleta. Si prega di riprovare.</p>
        <button 
          onClick={onReset}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
        >
          Torna Indietro
        </button>
      </div>
    );
  }
  
  const commonDocRef = useRef<HTMLDivElement>(null);
  const rulesRef = useRef<HTMLDivElement>(null);
  const solutionRef = useRef<HTMLDivElement>(null);
  const characterRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleDownload = async (type: 'rules' | 'solution' | 'character' | 'common', index?: number) => {
    let element;
    let filename;
    if (type === 'rules') {
        element = rulesRef.current;
        filename = 'Regole_Cena_Con_Delitto.pdf';
    } else if (type === 'solution') {
        element = solutionRef.current;
        filename = 'Soluzione_Cena_Con_Delitto.pdf';
    } else if (type === 'common') {
        element = commonDocRef.current;
        filename = 'Documento_Comune_Cena_Con_Delitto.pdf';
    } else if (type === 'character' && index !== undefined) {
        element = characterRefs.current[index];
        filename = `Personaggio_${story.characters[index].name.replace(' ', '_')}.pdf`;
    }
    
    if (element && filename) {
        await generatePdf(element as HTMLElement, filename);
    }
  };

  return (
    <div className="animate-fade-in">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-amber-300">{story.title}</h2>
            <p className="text-gray-400 mt-2 max-w-3xl mx-auto">{story.commonDocument.introduction}</p>
        </div>

        {/* --- Download Sections --- */}
        <div className="space-y-6 mb-8">
            <div className="bg-gray-700/50 p-6 rounded-lg">
                <h3 className="text-xl font-bold text-amber-400 mb-4 border-b border-amber-800 pb-2">Materiale Comune (per tutti)</h3>
                <button onClick={() => handleDownload('common')} className="w-full flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300">
                    <MapIcon className="w-6 h-6"/>
                    Scarica Mappa, Intro e Personaggi
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-700/50 p-6 rounded-lg">
                    <h3 className="text-xl font-bold text-amber-400 mb-4 border-b border-amber-800 pb-2">Per l'Organizzatore</h3>
                    <div className="space-y-4">
                        <button onClick={() => handleDownload('rules')} className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300">
                            <BookOpenIcon className="w-6 h-6"/>
                            Scarica PDF Regole del Gioco
                        </button>
                        <button onClick={() => handleDownload('solution')} className="w-full flex items-center justify-center gap-3 bg-red-700 hover:bg-red-800 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300">
                            <KeyIcon className="w-6 h-6"/>
                            Scarica PDF Soluzione (SPOILER)
                        </button>
                    </div>
                </div>
                <div className="bg-gray-700/50 p-6 rounded-lg">
                    <h3 className="text-xl font-bold text-amber-400 mb-4 border-b border-amber-800 pb-2">Schede Personaggio (individuali)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {story.characters.map((char, index) => (
                            <button key={char.name} onClick={() => handleDownload('character', index)} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-3 rounded-md transition-colors duration-300">
                            <UserIcon className="w-5 h-5"/>
                            <span>{char.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
        
        <div className="text-center mt-8">
            <button onClick={onReset} className="inline-flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">
                <ArrowUturnLeftIcon className="w-5 h-5" />
                Crea un'altra storia
            </button>
        </div>

        {/* --- Hidden PDF Content --- */}
        <div className="absolute -left-[9999px] top-auto w-[800px] text-gray-900">
            <div ref={commonDocRef} className="p-10 bg-white"><CommonPdfContent story={story} /></div>
            <div ref={rulesRef} className="p-10 bg-white"><RulesPdfContent /></div>
            <div ref={solutionRef} className="p-10 bg-white"><SolutionPdfContent story={story} /></div>
            {story.characters.map((char, index) => (
                <div key={index} ref={el => characterRefs.current[index] = el} className="p-10 bg-white">
                    <CharacterPdfContent character={char} story={story} />
                </div>
            ))}
        </div>
    </div>
  );
};

// --- PDF Content Components ---

const PdfPageBreak = () => <div style={{ pageBreakAfter: 'always' }}></div>;

const CommonPdfContent: React.FC<{story: StoryData}> = ({ story }) => {
    // Verifica che i dati necessari siano presenti
    if (!story || !story.commonDocument) {
        return (
            <div className="space-y-6">
                <h1 className="text-4xl font-bold text-center mb-6">Errore nei dati</h1>
                <p>Impossibile generare il documento PDF a causa di dati mancanti.</p>
            </div>
        );
    }
    
    return (
    <div className="space-y-6">
        <h1 className="text-4xl font-bold text-center mb-6">{story.title || 'Titolo non disponibile'}</h1>
        <h2 className="text-2xl font-bold border-b-2 border-gray-300 pb-2">Introduzione al Mistero</h2>
        <p className="whitespace-pre-wrap">{story.commonDocument.introduction || 'Introduzione non disponibile'}</p>

        <PdfPageBreak />
        
        <h2 className="text-2xl font-bold border-b-2 border-gray-300 pb-2 pt-8">Descrizione della Scena del Crimine</h2>
        <div className="p-4 border-2 border-dashed border-gray-400 rounded-lg">
             <p className="whitespace-pre-wrap">{story.commonDocument.crimeSceneMapDescription || 'Descrizione della scena del crimine non disponibile'}</p>
        </div>
        <p className="text-sm text-gray-500 italic text-center">Usa questa descrizione per immaginare la disposizione dei luoghi e degli indizi.</p>

        <PdfPageBreak />

        <h2 className="text-2xl font-bold border-b-2 border-gray-300 pb-2 pt-8">Personaggi e Relazioni Note</h2>
        <p className="whitespace-pre-wrap">{story.commonDocument.characterOverviews || 'Panoramica dei personaggi non disponibile'}</p>
    </div>
    );
};

const RulesPdfContent: React.FC = () => (
    <div className="space-y-6">
        <h1 className="text-4xl font-bold text-center mb-6">Regole della Cena con Delitto</h1>
        <h2 className="text-2xl font-bold border-b-2 border-gray-300 pb-2">Obiettivo del Gioco</h2>
        <p>L'obiettivo è scoprire chi tra i presenti è il colpevole (o i colpevoli) dell'omicidio. I giocatori dovranno interrogarsi a vicenda, analizzare gli indizi e usare la logica per risolvere il mistero entro la fine della serata.</p>
        
        <h2 className="text-2xl font-bold border-b-2 border-gray-300 pb-2">Svolgimento del Gioco</h2>
        <p>Il gioco è diviso in 3 round. In ogni round, i giocatori ricevono nuove informazioni e obiettivi.</p>
        <ol className="list-decimal list-inside space-y-2 pl-4">
            <li><strong>Introduzione:</strong> L'organizzatore legge il "Documento Comune" a tutti i giocatori. Successivamente, ogni giocatore riceve la propria scheda personaggio e la legge attentamente in privato.</li>
            <li><strong>Round 1:</strong> I giocatori si presentano interpretando il proprio ruolo. Iniziano a parlare tra loro, ponendo domande e cercando di raggiungere i propri obiettivi del primo round.</li>
            <li><strong>Round 2:</strong> I giocatori leggono le informazioni del secondo round sulla loro scheda. Emergono nuovi segreti e indizi. Le conversazioni si fanno più intense e mirate.</li>
            <li><strong>Round 3:</strong> I giocatori leggono le informazioni finali. Questo round è cruciale per collegare tutti i punti e formulare un'accusa.</li>
            <li><strong>Accusa Finale:</strong> Al termine del terzo round, ogni giocatore dichiara pubblicamente chi accusa e perché.</li>
            <li><strong>Rivelazione:</strong> L'organizzatore legge la soluzione, svelando il colpevole, il movente e come ha agito.</li>
        </ol>

        <h2 className="text-2xl font-bold border-b-2 border-gray-300 pb-2">Consigli per i Giocatori</h2>
        <ul className="list-disc list-inside space-y-2 pl-4">
            <li><strong>Interpretare il ruolo:</strong> Non limitarti a leggere la scheda. Entra nel personaggio!</li>
            <li><strong>Non rivelare tutto subito:</strong> Le tue informazioni sono preziose. Rivelale strategicamente per raggiungere i tuoi obiettivi.</li>
            <li><strong>Mentire (se necessario):</strong> Se sei il colpevole, devi mentire. Se sei innocente ma hai un segreto, puoi mentire per proteggerlo.</li>
            <li><strong>Fare domande:</strong> Sii curioso. Chiedi a tutti del loro alibi, delle loro relazioni e dei loro segreti per scoprire la verità.</li>
        </ul>
    </div>
);

const SolutionPdfContent: React.FC<{story: StoryData}> = ({ story }) => {
    // Verifica che i dati necessari siano presenti
    if (!story || !story.solution) {
        return (
            <div className="space-y-6">
                <h1 className="text-4xl font-bold text-center mb-6">Errore nei dati</h1>
                <p>Impossibile generare il documento della soluzione a causa di dati mancanti.</p>
            </div>
        );
    }
    
    return (
    <div className="space-y-6">
        <h1 className="text-4xl font-bold text-center mb-6">La Soluzione - {story.title || 'Titolo non disponibile'}</h1>
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
            <p className="font-bold">ATTENZIONE: SPOILER!</p>
            <p>Questo documento contiene la soluzione completa del mistero. Leggere solo al termine del gioco.</p>
        </div>
        
        <h2 className="text-2xl font-bold">Il/I Colpevole/i</h2>
        <p className="text-xl font-semibold">{story.solution.culprits && story.solution.culprits.length > 0 ? story.solution.culprits.join(' e ') : 'Informazione non disponibile'}</p>
        
        <h2 className="text-2xl font-bold">Il Movente</h2>
        <p className="whitespace-pre-wrap">{story.solution.motive || 'Informazione non disponibile'}</p>
        
        <h2 className="text-2xl font-bold">Come è stato commesso il delitto</h2>
        <p className="whitespace-pre-wrap">{story.solution.how || 'Informazione non disponibile'}</p>

        <h2 className="text-2xl font-bold">Retroscena Completi</h2>
        <p className="whitespace-pre-wrap">{story.solution.backstory || 'Informazione non disponibile'}</p>
    </div>
    );
};

const CharacterPdfContent: React.FC<{character: Character, story: StoryData}> = ({ character, story }) => {
    // Verifica che i dati necessari siano presenti
    if (!character) {
        return (
            <div className="space-y-6">
                <h1 className="text-4xl font-bold text-center mb-6">Errore nei dati</h1>
                <p>Impossibile generare la scheda del personaggio a causa di dati mancanti.</p>
            </div>
        );
    }
    
    return (
    <div className="space-y-6">
        <h1 className="text-4xl font-bold text-center mb-2">{character.name || 'Nome non disponibile'}</h1>
        <p className="text-center text-lg italic text-gray-600 mb-6">{character.isCulprit !== undefined ? (character.isCulprit ? "Tu sei il colpevole." : "Tu sei innocente.") : "Ruolo non definito."}</p>

        <div className="p-4 bg-gray-100 rounded-lg">
            <h2 className="text-2xl font-bold mb-2">Descrizione Pubblica</h2>
            <p className="whitespace-pre-wrap">{character.initialDescription || 'Descrizione non disponibile'}</p>
        </div>

        <div className="p-4 bg-gray-100 rounded-lg">
            <h2 className="text-2xl font-bold mb-2">Le Tue Relazioni (dal tuo punto di vista)</h2>
            <p className="whitespace-pre-wrap">{character.relationships || 'Relazioni non disponibili'}</p>
        </div>
        
        {character.opinionsOnOthers && character.opinionsOnOthers.length > 0 && (
          <div className="p-4 bg-gray-100 rounded-lg">
            <h2 className="text-2xl font-bold mb-2">Le Tue Opinioni Sugli Altri</h2>
            <ul className="space-y-3">
              {character.opinionsOnOthers.map(op => (
                <li key={op.characterName || 'unknown'}>
                  <strong className="font-semibold">{op.characterName || 'Personaggio sconosciuto'}:</strong>
                  <p className="pl-2 whitespace-pre-wrap italic text-gray-700">{op.opinion || 'Opinione non disponibile'}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-4 bg-gray-100 rounded-lg">
            <h2 className="text-2xl font-bold mb-2">I Tuoi Segreti e Obiettivi Generali</h2>
            <p className="whitespace-pre-wrap">{character.secretsAndMotives || 'Segreti e motivi non disponibili'}</p>
            {character.isCulprit !== undefined && (
                character.isCulprit ? 
                <p className="font-bold mt-2">Il tuo obiettivo principale è sviare i sospetti e accusare qualcun altro in modo convincente!</p> :
                <p className="font-bold mt-2">Il tuo obiettivo principale è scoprire il vero colpevole e assicurarti di non essere accusato ingiustamente!</p>
            )}
        </div>

        <PdfPageBreak />

        <h1 className="text-3xl font-bold text-center pt-8">Informazioni Riservate</h1>
        <p className="text-center text-gray-600 mb-6">Leggi queste sezioni solo quando l'organizzatore annuncia l'inizio del round corrispondente.</p>
        
        <div className="border-4 border-dashed border-gray-400 p-4 rounded-lg">
            <h2 className="text-2xl font-bold mb-2">Round 1</h2>
            <p className="text-lg whitespace-pre-wrap">{character.round1Info || 'Informazioni del Round 1 non disponibili'}</p>
        </div>
        
        <PdfPageBreak />

        <div className="border-4 border-dashed border-gray-400 p-4 rounded-lg mt-6 pt-8">
            <h2 className="text-2xl font-bold mb-2">Round 2</h2>
            <p className="text-lg whitespace-pre-wrap">{character.round2Info || 'Informazioni del Round 2 non disponibili'}</p>
        </div>

        <PdfPageBreak />

        <div className="border-4 border-dashed border-gray-400 p-4 rounded-lg mt-6 pt-8">
            <h2 className="text-2xl font-bold mb-2">Round 3</h2>
            <p className="text-lg whitespace-pre-wrap">{character.round3Info || 'Informazioni del Round 3 non disponibili'}</p>
        </div>
    </div>
    );
};


export default StoryDisplay;