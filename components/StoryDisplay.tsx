import React, { useRef } from 'react';
import type { StoryData, Character } from '../types';
import { UserIcon, BookOpenIcon, KeyIcon, ArrowUturnLeftIcon, MapIcon } from './icons';

declare const jspdf: any;
declare const html2canvas: any;

interface StoryDisplayProps {
  story: StoryData;
  onReset: () => void;
}

interface EvidenceClue {
  id: string;
  title: string;
  round: number | string;
  recipients: string[];
  type: 'decisive' | 'corroborating' | 'red-herring';
  content: string;
  solutionLink: string;
  organizerNote: string;
}

type StoryWithOptionalEvidence = StoryData & {
  evidence?: EvidenceClue[];
  solution: StoryData['solution'] & { deductionChain?: string[] };
};

const A4_CSS_WIDTH = 794;
const A4_CSS_HEIGHT = 1123;
const PDF_OPTIONS = {
  scale: 2,
  useCORS: true,
  backgroundColor: '#ffffff',
  logging: false,
};

/** Render each semantic page separately so PDF pagination never cuts through a long page image. */
const generatePdf = async (element: HTMLElement, filename: string) => {
  if (!element || typeof html2canvas !== 'function' || !jspdf?.jsPDF) {
    throw new Error('Il generatore PDF non è disponibile in questo momento.');
  }

  const renderHost = element.parentElement;
  if (!renderHost) throw new Error('Impossibile preparare il documento PDF.');

  const originalStyles = {
    position: renderHost.style.position,
    left: renderHost.style.left,
    top: renderHost.style.top,
    zIndex: renderHost.style.zIndex,
  };

  try {
    // html2canvas cannot reliably capture content thousands of pixels off screen.
    renderHost.style.position = 'fixed';
    renderHost.style.left = '0';
    renderHost.style.top = '0';
    renderHost.style.zIndex = '-1';

    const pages = Array.from(element.querySelectorAll<HTMLElement>('.pdf-page'));
    const renderPages = pages.length ? pages : [element];
    const pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (let index = 0; index < renderPages.length; index += 1) {
      const page = renderPages[index];
      const canvas = await html2canvas(page, PDF_OPTIONS);
      if (index > 0) pdf.addPage('a4', 'portrait');
      const imageRatio = canvas.width / canvas.height;
      const imageWidth = Math.min(210, 297 * imageRatio);
      const imageHeight = imageWidth / imageRatio;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', (210 - imageWidth) / 2, 0, imageWidth, imageHeight, undefined, 'FAST');
      // Keep the folio outside the page image; page content is laid out with a bottom margin.
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text(`${index + 1} / ${renderPages.length}`, 105, 293, { align: 'center' });
    }
    pdf.save(filename);
  } finally {
    renderHost.style.position = originalStyles.position;
    renderHost.style.left = originalStyles.left;
    renderHost.style.top = originalStyles.top;
    renderHost.style.zIndex = originalStyles.zIndex;
  }
};

const pdfPageStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  width: `${A4_CSS_WIDTH}px`,
  minHeight: `${A4_CSS_HEIGHT}px`,
  padding: '58px 64px 78px',
  background: '#fff',
  color: '#111827',
  fontFamily: 'Arial, sans-serif',
  fontSize: '15px',
  lineHeight: 1.55,
};

const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="pdf-page" style={pdfPageStyle}>{children}</section>
);

const PageTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h1 style={{ fontSize: 30, lineHeight: 1.2, textAlign: 'center', margin: '0 0 26px' }}>{children}</h1>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{ fontSize: 20, borderBottom: '2px solid #9ca3af', paddingBottom: 6, margin: '18px 0 10px' }}>{children}</h2>
);

const Text: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <p style={{ whiteSpace: 'pre-wrap', margin: '0 0 14px' }}>{children || 'Informazione non disponibile'}</p>
);

const getEvidence = (story: StoryData): EvidenceClue[] =>
  ((story as StoryWithOptionalEvidence).evidence || []).filter((clue) => clue && Array.isArray(clue.recipients));

const roundLabel = (round: number | string) => {
  const match = String(round).match(/[1-3]/);
  return match ? `Round ${match[0]}` : String(round);
};

const clueTypeLabel = (type: EvidenceClue['type']) => ({
  decisive: 'Indizio decisivo',
  corroborating: 'Conferma',
  'red-herring': 'Pista fuorviante',
}[type] || 'Indizio');

const StoryDisplay: React.FC<StoryDisplayProps> = ({ story, onReset }) => {
  if (!story || !story.commonDocument || !story.characters || !story.solution) {
    return (
      <div className="text-center p-6 bg-red-800/50 rounded-lg">
        <h2 className="text-2xl font-bold text-white mb-4">Errore nella struttura della storia</h2>
        <p className="text-gray-200 mb-4">La storia generata non è valida o è incompleta. Riprova.</p>
        <button onClick={onReset} className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg">Torna indietro</button>
      </div>
    );
  }

  const commonDocRef = useRef<HTMLDivElement>(null);
  const rulesRef = useRef<HTMLDivElement>(null);
  const solutionRef = useRef<HTMLDivElement>(null);
  const characterRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleDownload = async (type: 'rules' | 'solution' | 'character' | 'common', index?: number) => {
    let element: HTMLElement | null = null;
    let filename = '';
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
      filename = `Personaggio_${story.characters[index].name.trim().replace(/\s+/g, '_')}.pdf`;
    }

    if (!element || !filename) return;
    try {
      await generatePdf(element, filename);
    } catch (error) {
      console.error('PDF generation failed', error);
      window.alert('Non è stato possibile creare il PDF. Riprova tra poco.');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-amber-300">{story.title}</h2>
        <p className="text-gray-400 mt-2 max-w-3xl mx-auto">{story.commonDocument.introduction}</p>
      </div>

      <div className="space-y-6 mb-8">
        <div className="bg-gray-700/50 p-6 rounded-lg">
          <h3 className="text-xl font-bold text-amber-400 mb-4 border-b border-amber-800 pb-2">Materiale comune (per tutti)</h3>
          <button onClick={() => handleDownload('common')} className="w-full flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg">
            <MapIcon className="w-6 h-6" /> Scarica mappa, introduzione e personaggi
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-700/50 p-6 rounded-lg">
            <h3 className="text-xl font-bold text-amber-400 mb-4 border-b border-amber-800 pb-2">Per l’organizzatore</h3>
            <div className="space-y-4">
              <button onClick={() => handleDownload('rules')} className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg">
                <BookOpenIcon className="w-6 h-6" /> Scarica regole e guida del gioco
              </button>
              <button onClick={() => handleDownload('solution')} className="w-full flex items-center justify-center gap-3 bg-red-700 hover:bg-red-800 text-white font-bold py-3 px-4 rounded-lg">
                <KeyIcon className="w-6 h-6" /> Scarica soluzione e indizi (SPOILER)
              </button>
            </div>
          </div>
          <div className="bg-gray-700/50 p-6 rounded-lg">
            <h3 className="text-xl font-bold text-amber-400 mb-4 border-b border-amber-800 pb-2">Schede personaggio (individuali)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {story.characters.map((char, index) => (
                <button key={`${char.name}-${index}`} onClick={() => handleDownload('character', index)} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-3 rounded-md">
                  <UserIcon className="w-5 h-5" /><span>{char.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="text-center mt-8">
        <button onClick={onReset} className="inline-flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">
          <ArrowUturnLeftIcon className="w-5 h-5" /> Crea un’altra storia
        </button>
      </div>

      <div aria-hidden="true" className="absolute -left-[9999px] top-0 text-gray-900" style={{ width: A4_CSS_WIDTH }}>
        <div ref={commonDocRef}><CommonPdfContent story={story} /></div>
        <div ref={rulesRef}><RulesPdfContent /></div>
        <div ref={solutionRef}><SolutionPdfContent story={story} /></div>
        {story.characters.map((char, index) => (
          <div key={`${char.name}-${index}`} ref={(el) => { characterRefs.current[index] = el; }}>
            <CharacterPdfContent character={char} story={story} />
          </div>
        ))}
      </div>
    </div>
  );
};

const CommonPdfContent: React.FC<{ story: StoryData }> = ({ story }) => (
  <>
    <Page>
      <PageTitle>{story.title}</PageTitle>
      <SectionTitle>Introduzione al mistero</SectionTitle>
      <Text>{story.commonDocument.introduction}</Text>
      <SectionTitle>La scena del crimine</SectionTitle>
      <Text>{story.commonDocument.crimeSceneMapDescription}</Text>
    </Page>
    <Page>
      <PageTitle>Personaggi e relazioni note</PageTitle>
      <Text>{story.commonDocument.characterOverviews}</Text>
      <p style={{ marginTop: 36, color: '#4b5563', fontStyle: 'italic' }}>Questo documento contiene solo informazioni pubbliche. Le schede individuali e gli indizi riservati vanno consegnati separatamente.</p>
    </Page>
  </>
);

const RulesPdfContent: React.FC = () => (
  <>
    <Page>
      <PageTitle>Guida dell’organizzatore</PageTitle>
      <SectionTitle>Obiettivo e preparazione</SectionTitle>
      <Text>L’obiettivo è ricostruire il delitto attraverso domande, interpretazione dei personaggi e confronto degli indizi. La partita completa dura circa 2 ore e 30 minuti; prevedi 2–3 ore con cena e pause.</Text>
      <ol style={{ paddingLeft: 24 }}>
        <li>Stampa una copia del documento comune e una scheda riservata per ciascun partecipante.</li>
        <li>Conserva per te la guida e la soluzione: contengono spoiler e collegamenti tra le prove.</li>
        <li>Separa le informazioni di ogni round e consegnale solo al momento indicato.</li>
        <li>Concorda che i giocatori possono proteggere i segreti del personaggio, ma non modificare i fatti riportati nelle prove.</li>
      </ol>
      <SectionTitle>Scansione consigliata</SectionTitle>
      <ul style={{ paddingLeft: 24 }}>
        <li><strong>Accoglienza e lettura comune — 15 minuti:</strong> presenta il caso, la scena e i personaggi.</li>
        <li><strong>Preparazione dei ruoli — 10 minuti:</strong> distribuisci le schede; ognuno legge in silenzio la parte pubblica e i propri obiettivi.</li>
        <li><strong>Round 1 — 30 minuti:</strong> presentazioni, relazioni e primi alibi. Incoraggia tutti a parlare con almeno tre persone.</li>
      </ul>
    </Page>
    <Page>
      <PageTitle>Conduzione dei round</PageTitle>
      <ul style={{ paddingLeft: 24 }}>
        <li><strong>Round 2 — 35 minuti:</strong> annuncia il round, poi consegna o fai leggere solo le nuove informazioni e gli indizi assegnati. Lascia tempo per interrogatori mirati.</li>
        <li><strong>Pausa — 10 minuti:</strong> i giocatori possono riordinare gli appunti; non anticipare le informazioni successive.</li>
        <li><strong>Round 3 — 35 minuti:</strong> distribuisci le ultime rivelazioni e gli indizi. Invita il gruppo a confrontare orari, moventi e prove.</li>
        <li><strong>Accuse e confronto — 20 minuti:</strong> ogni persona indica un sospetto e motiva l’accusa con almeno una prova. Concedi una breve replica ai sospettati.</li>
        <li><strong>Rivelazione — 15 minuti:</strong> leggi la soluzione e ricostruisci la catena di deduzioni, chiarendo anche i depistaggi.</li>
      </ul>
      <SectionTitle>Gestire gli indizi privati</SectionTitle>
      <Text>Le prove con destinatario specifico restano inizialmente private: il proprietario decide quando mostrarle o raccontarle, salvo che la scheda dica diversamente. Se la partita si blocca, invita i giocatori a condividere un fatto concreto invece di rivelare direttamente la conclusione. Controlla che nessun round venga distribuito in anticipo.</Text>
    </Page>
    <Page>
      <PageTitle>Consigli e chiusura</PageTitle>
      <SectionTitle>Aiutare il tavolo senza svelare il caso</SectionTitle>
      <ul style={{ paddingLeft: 24 }}>
        <li>Fai domande aperte ai giocatori rimasti in disparte e richiama l’attenzione su dettagli verificabili.</li>
        <li>Non confermare né smentire teorie prima delle accuse finali.</li>
        <li>Se emerge un’incoerenza nelle schede, privilegia gli indizi espliciti e annotala per la revisione della storia.</li>
        <li>Lascia ai giocatori libertà di interpretazione, senza imporre dialoghi o scene prestabilite.</li>
      </ul>
      <SectionTitle>Discussione finale</SectionTitle>
      <Text>Dopo la soluzione, chiedi quali indizi sono stati decisivi, quali sospetti erano plausibili e quali informazioni sono state comunicate troppo tardi o troppo presto. Il confronto aiuta a chiudere la storia e a migliorare le partite successive.</Text>
      <p style={{ marginTop: 38, borderTop: '1px solid #d1d5db', paddingTop: 14, color: '#4b5563' }}>Durata prevista senza cena: circa 170 minuti. Aggiungi il tempo del pasto e delle pause per una serata da 2–3 ore.</p>
    </Page>
  </>
);

const SolutionPdfContent: React.FC<{ story: StoryData }> = ({ story }) => {
  const extendedStory = story as StoryWithOptionalEvidence;
  const evidence = getEvidence(story);
  const deductionChain = extendedStory.solution.deductionChain || [];
  return (
    <>
      <Page>
        <PageTitle>Soluzione — {story.title}</PageTitle>
        <div style={{ border: '2px solid #b91c1c', padding: 16, marginBottom: 24, color: '#991b1b' }}><strong>SPOILER:</strong> riservato all’organizzatore. Non consegnare ai partecipanti prima della conclusione.</div>
        <SectionTitle>Il colpevole</SectionTitle>
        <Text>{story.solution.culprits?.join(' e ')}</Text>
        <SectionTitle>Movente</SectionTitle>
        <Text>{story.solution.motive}</Text>
        <SectionTitle>Come è stato commesso il delitto</SectionTitle>
        <Text>{story.solution.how}</Text>
      </Page>
      <Page>
        <PageTitle>Ricostruzione del caso</PageTitle>
        <SectionTitle>Retroscena completo</SectionTitle>
        <Text>{story.solution.backstory}</Text>
        {deductionChain.length > 0 && <>
          <SectionTitle>Catena di deduzioni</SectionTitle>
          <ol style={{ paddingLeft: 24 }}>{deductionChain.map((step, index) => <li key={`${index}-${step}`} style={{ marginBottom: 10 }}>{step}</li>)}</ol>
        </>}
      </Page>
      <Page>
        <PageTitle>Mappa degli indizi (SPOILER)</PageTitle>
        {evidence.length === 0 ? <Text>Questa storia non include ancora indizi strutturati.</Text> : evidence.map((clue) => (
          <div key={clue.id || clue.title} style={{ border: '1px solid #9ca3af', padding: 12, marginBottom: 12, breakInside: 'avoid' }}>
            <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>{clue.title || clue.id} · {roundLabel(clue.round)} · {clueTypeLabel(clue.type)}</h2>
            <p style={{ margin: '0 0 6px' }}><strong>Destinatari:</strong> {clue.recipients.join(', ')}</p>
            <Text>{clue.content}</Text>
            <p style={{ margin: '0 0 6px' }}><strong>Collegamento alla soluzione:</strong> {clue.solutionLink}</p>
            <p style={{ margin: 0 }}><strong>Nota organizzatore:</strong> {clue.organizerNote}</p>
          </div>
        ))}
      </Page>
    </>
  );
};

const CharacterPdfContent: React.FC<{ character: Character; story: StoryData }> = ({ character, story }) => {
  const receivedClues = getEvidence(story).filter((clue) => clue.recipients.includes(character.name));
  const roundClues = [1, 2, 3].map((round) => receivedClues.filter((clue) => roundLabel(clue.round) === `Round ${round}`));
  const opinions = character.opinionsOnOthers || [];
  const opinionSplit = Math.ceil(opinions.length / 2);
  return (
    <>
      <Page>
        <PageTitle>{character.name}</PageTitle>
        <p style={{ textAlign: 'center', color: '#4b5563', fontStyle: 'italic', marginTop: -15, marginBottom: 24 }}>Scheda riservata — non mostrare agli altri senza il tuo consenso.</p>
        <SectionTitle>Descrizione pubblica</SectionTitle>
        <Text>{character.initialDescription}</Text>
        <SectionTitle>Il tuo punto di vista</SectionTitle>
        <Text>{character.relationships}</Text>
      </Page>
      <Page>
        <PageTitle>Relazioni e opinioni</PageTitle>
        <SectionTitle>Le tue opinioni sugli altri</SectionTitle>
        {opinions.length ? opinions.slice(0, opinionSplit).map((op, index) => (
          <div key={`${op.characterName}-${index}`} style={{ marginBottom: 16, breakInside: 'avoid' }}>
            <strong>{op.characterName}</strong><Text>{op.opinion}</Text>
          </div>
        )) : <Text>Non hai ancora un’opinione particolare sugli altri personaggi.</Text>}
      </Page>
      <Page>
        <PageTitle>Motivazioni personali</PageTitle>
        {opinions.slice(opinionSplit).map((op, index) => (
          <div key={`${op.characterName}-${index + opinionSplit}`} style={{ marginBottom: 16, breakInside: 'avoid' }}>
            <strong>{op.characterName}</strong><Text>{op.opinion}</Text>
          </div>
        ))}
        <SectionTitle>Segreti e motivazioni</SectionTitle>
        <Text>{character.secretsAndMotives}</Text>
      </Page>
      {[1, 2, 3].map((round, index) => (
        <Page key={round}>
          <PageTitle>Informazioni riservate — Round {round}</PageTitle>
          <p style={{ color: '#4b5563', fontStyle: 'italic' }}>Leggi questa sezione soltanto quando l’organizzatore annuncia il round.</p>
          <Text>{[character.round1Info, character.round2Info, character.round3Info][index]}</Text>
          {roundClues[index].length > 0 && <>
            <SectionTitle>Indizi che possiedi</SectionTitle>
            {roundClues[index].map((clue) => (
              <div key={clue.id || clue.title} style={{ borderLeft: '4px solid #b45309', padding: '8px 12px', margin: '12px 0', background: '#fffbeb', breakInside: 'avoid' }}>
                <strong>{clue.title || 'Indizio'}</strong>
                <Text>{clue.content}</Text>
              </div>
            ))}
          </>}
        </Page>
      ))}
    </>
  );
};

export default StoryDisplay;
