import type { StoryData } from '../types';

if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY environment variable not set");
}

// Non inizializziamo direttamente il client Groq nel browser
// per evitare l'esposizione della chiave API

const ensureUniqueCharacterNames = (story: StoryData): StoryData => {
  if (!story?.characters || story.characters.length === 0) {
    return story;
  }

  const counts = new Map<string, number>();
  const queueMap = new Map<string, string[]>();

  const updatedCharacters = story.characters.map((character, index) => {
    const rawName = (character.name ?? '').trim();
    const fallbackName = rawName.length > 0 ? rawName : `Personaggio ${index + 1}`;
    const normalized = fallbackName.toLowerCase();
    const nextCount = (counts.get(normalized) ?? 0) + 1;
    counts.set(normalized, nextCount);
    const uniqueName = nextCount === 1 ? fallbackName : `${fallbackName} ${nextCount}`;
    const queue = queueMap.get(normalized) ?? [];
    queue.push(uniqueName);
    queueMap.set(normalized, queue);

    return {
      ...character,
      name: uniqueName,
    };
  });

  const usageMap = new Map<string, number>();
  const mapName = (name: string): string => {
    const normalized = (name ?? '').trim().toLowerCase();
    if (!normalized) {
      return name;
    }

    const queue = queueMap.get(normalized);
    if (!queue || queue.length === 0) {
      return name;
    }

    const usageCount = usageMap.get(normalized) ?? 0;
    const index = usageCount < queue.length ? usageCount : queue.length - 1;
    usageMap.set(normalized, usageCount + 1);
    return queue[index];
  };

  const updatedSolution = story.solution
    ? {
        ...story.solution,
        culprits: story.solution.culprits?.map(mapName) ?? story.solution.culprits,
      }
    : story.solution;

  return {
    ...story,
    characters: updatedCharacters,
    solution: updatedSolution,
  };
};
// Definizione dello schema per la storia
const storySchema = {
  type: "object",
  properties: {
    title: { type: "string", description: 'Titolo avvincente della storia delitto e mistero in italiano.' },
    commonDocument: {
      type: "object",
      description: 'Contiene le informazioni iniziali condivise con tutti i giocatori.',
      properties: {
        introduction: { type: "string", description: 'Introduzione generale alla storia che prepara la scena, in italiano.' },
        crimeSceneMapDescription: { type: "string", description: 'Descrizione testuale dettagliata e suggestiva della mappa della scena del crimine. Deve essere abbastanza chiara da permettere di visualizzare l\'ambiente e i punti di interesse principali (es. posizione del corpo, oggetti fuori posto, possibili vie di fuga). In italiano.' },
        characterOverviews: { type: "string", description: 'Una breve panoramica pubblica di tutti i personaggi e delle loro relazioni reciproche note all\'inizio del gioco. Questo testo verrÃƒÆ’Ã‚Â  letto da tutti. In italiano.' }
      },
      required: ['introduction', 'crimeSceneMapDescription', 'characterOverviews']
    },
    characters: {
      type: "array",
      description: 'Elenco dei personaggi coinvolti nella storia.',
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          isCulprit: { type: "boolean" },
          initialDescription: { type: "string", description: 'Descrizione pubblica iniziale del personaggio, in italiano.' },
          relationships: { type: "string", description: 'Descrizione delle relazioni del personaggio con gli altri, dal suo punto di vista privato. Potrebbe contenere dettagli non noti a tutti. In italiano.' },
          round1Info: { type: "string", description: 'Informazioni per il Round 1. Deve includere: 1) Cosa il personaggio sa e puÃƒÆ’Ã‚Â² rivelare. 2) Un obiettivo specifico per il round (es. "Parla con X per scoprire Y"). 3) Un\'osservazione o un sospetto su un altro personaggio. In italiano.' },
          round2Info: { type: "string", description: 'Informazioni per il Round 2. Nuovi segreti cruciali. Deve includere: 1) Nuove rivelazioni personali. 2) Un nuovo obiettivo piÃƒÆ’Ã‚Â¹ urgente. 3) Un segreto scoperto o un\'azione sospetta notata in un altro personaggio. In italiano.' },
          round3Info: { type: "string", description: 'Informazioni per il Round 3. Colpi di scena finali. Deve includere: 1) La rivelazione finale che possiede il personaggio. 2) L\'obiettivo finale (es. "Accusa X basandoti su Y"). 3) L\'elemento chiave che collega tutti gli indizi dal suo punto di vista. In italiano.' },
          secretsAndMotives: { type: "string", description: 'Segreti privati e potenziali moventi, anche se il personaggio ÃƒÆ’Ã‚Â¨ innocente. Utile per il giocatore per interpretare il suo ruolo, in italiano.' },
          opinionsOnOthers: {
            type: "array",
            description: "Una lista delle opinioni personali e private del personaggio sugli altri partecipanti. Queste opinioni devono essere soggettive, riflettere pregiudizi, sospetti o legami segreti. Non ÃƒÆ’Ã‚Â¨ necessario avere un'opinione su tutti.",
            items: {
              type: "object",
              properties: {
                characterName: { type: "string", description: "Il nome del personaggio su cui si esprime l'opinione." },
                opinion: { type: "string", description: "L'opinione privata, in italiano." }
              },
              required: ['characterName', 'opinion']
            }
          }
        },
        required: ['name', 'isCulprit', 'initialDescription', 'relationships', 'round1Info', 'round2Info', 'round3Info', 'secretsAndMotives', 'opinionsOnOthers']
      }
    },
    solution: {
      type: "object",
      properties: {
        culprits: {
          type: "array",
          items: { type: "string" }
        },
        motive: { type: "string", description: 'Il vero movente del/i colpevole/i, in italiano.' },
        how: { type: "string", description: 'Come ÃƒÆ’Ã‚Â¨ stato commesso il crimine, in dettaglio, in italiano.' },
        backstory: { type: "string", description: 'La storia completa e i retroscena che hanno portato al delitto, in italiano.' }
      },
      required: ['culprits', 'motive', 'how', 'backstory']
    }
  },
  required: ['title', 'commonDocument', 'characters', 'solution']
};

export const generateMurderMysteryStory = async (playerCount: number, theme: string): Promise<StoryData> => {
  const generationPrompt = `
Sei un maestro narratore e creatore di giochi "cena con delitto". Il tuo compito ÃƒÆ’Ã‚Â¨ generare una storia completa, avvincente e complessa basata sul tema e sul numero di giocatori forniti.

Il numero di giocatori ÃƒÆ’Ã‚Â¨: ${playerCount}.
Il tema della storia ÃƒÆ’Ã‚Â¨: "${theme}".
Ogni personaggio deve avere nome e cognome distinti e nessun nome puÃ² ripetersi. Garantisce che i nomi siano realistici, italiani o facilmente pronunciabili.


La storia deve essere eccezionalmente avvincente e difficile da risolvere. Segui queste direttive con la massima precisione:

Vincoli di sicurezza e conformitÃƒÂ :
- Usa un linguaggio adatto a un pubblico generale, evitando descrizioni grafiche di violenza, dettagli macabri o contenuti sessuali espliciti.
- Non inserire discriminazioni, incitazioni all'odio o contenuti che possano violare le Norme del programma Google AdSense.
- Assicurati che il finale sia risolutivo e che i personaggi non glorifichino comportamenti illegali.

1.  **Documento Comune Iniziale**: Crea un documento comune per tutti i giocatori che includa:
    *   Un'introduzione suggestiva che definisca l'ambientazione e l'evento scatenante (il delitto).
    *   Una descrizione dettagliata della mappa della scena del crimine, che i giocatori possano usare come riferimento.
    *   Una panoramica generale e pubblica di tutti i personaggi e delle loro relazioni conosciute.

2.  **Personaggi Complessi**:
    *   **Colpevoli Nascosti**: Deve esserci almeno un colpevole. Se sono piÃƒÆ’Ã‚Â¹ di uno, la loro alleanza deve essere un segreto scioccante.
    *   **Segreti per Tutti**: OGNI personaggio, specialmente quelli innocenti, deve avere un segreto importante, un movente credibile o un comportamento sospetto che lo renda un potenziale colpevole. Le "piste false" (red herrings) sono fondamentali.
    *   **Relazioni Private**: La sezione "relationships" di ogni personaggio deve descrivere i suoi veri sentimenti e le interazioni segrete con gli altri, non solo le relazioni pubbliche.

3.  **Rivelazione a Round Interattiva**: Le informazioni per ciascun personaggio devono essere suddivise in tre round. ÃƒÆ’Ã‹â€  CRUCIALE che ogni round non contenga solo informazioni su se stessi, ma anche e soprattutto **indizi, osservazioni e segreti scoperti riguardo ad ALTRI personaggi**.
    *   **Round 1**: Informazioni di base, alibi e prime osservazioni sospette sugli altri. Assegna a ogni personaggio un piccolo obiettivo per iniziare le interazioni (es: "Chiedi a [Nome] del suo litigio con la vittima").
    *   **Round 2**: Rivelazioni piÃƒÆ’Ã‚Â¹ profonde, segreti che vengono a galla, e indizi piÃƒÆ’Ã‚Â¹ concreti. Gli obiettivi diventano piÃƒÆ’Ã‚Â¹ urgenti (es: "Confronta [Nome] riguardo alla bugia che ha detto nel Round 1").
    *   **Round 3**: Colpi di scena finali, l'indizio decisivo o la confessione parziale che permette di risolvere il caso. L'obiettivo ÃƒÆ’Ã‚Â¨ formulare un'accusa concreta.

4.  **Opinioni Private (Cruciale)**: Per ogni personaggio, includi una sezione \`opinionsOnOthers\`. Questa deve contenere una lista degli altri personaggi con una breve descrizione e un'opinione *dal punto di vista del personaggio a cui appartiene la scheda*. Queste opinioni devono essere soggettive, piene di pregiudizi, sospetti o affetto, e riflettere le loro relazioni segrete e la loro personalitÃƒÆ’Ã‚Â .

5.  **Coerenza Totale**: Assicurati che ogni elemento (moventi, alibi, indizi, relazioni, segreti, opinioni e la soluzione finale) sia perfettamente logico e coerente. La soluzione deve essere deducibile, sebbene difficile.

6. **STRUTTURA JSON OBBLIGATORIA**: ÃƒÆ’Ã‹â€  FONDAMENTALE che tu rispetti ESATTAMENTE questa struttura JSON:

Esempio di struttura:
{
  "title": "Titolo della Storia",
  "commonDocument": {
    "introduction": "Testo dell'introduzione...",
    "crimeSceneMapDescription": "Descrizione dettagliata della scena del crimine...",
    "characterOverviews": "Panoramica di tutti i personaggi..."
  },
  "characters": [
    {
      "name": "Nome Personaggio 1",
      "isCulprit": true/false,
      "initialDescription": "Descrizione iniziale...",
      "relationships": "Relazioni con gli altri personaggi...",
      "round1Info": "Informazioni per il round 1...",
      "round2Info": "Informazioni per il round 2...",
      "round3Info": "Informazioni per il round 3...",
      "secretsAndMotives": "Segreti e motivi...",
      "opinionsOnOthers": [
        {
          "characterName": "Nome Personaggio 2",
          "opinion": "Opinione su questo personaggio..."
        },
        // Ripeti per tutti gli altri personaggi
      ]
    },
    // Ripeti per tutti i personaggi (esattamente ${playerCount})
  ],
  "solution": {
    "culprits": ["Nome Colpevole 1", "Nome Colpevole 2"],
    "motive": "Motivo del delitto...",
    "how": "Come ÃƒÆ’Ã‚Â¨ stato commesso il delitto...",
    "backstory": "Storia completa dietro il delitto..."
  }
}

Genera l'output esclusivamente in formato JSON, in lingua italiana, seguendo ESATTAMENTE lo schema fornito sopra. 

ATTENZIONE: ÃƒÆ’Ã‹â€  ASSOLUTAMENTE CRITICO che tu generi ESATTAMENTE ${playerCount} personaggi, nÃƒÆ’Ã‚Â© uno di piÃƒÆ’Ã‚Â¹ nÃƒÆ’Ã‚Â© uno di meno. La lista "characters" DEVE contenere esattamente ${playerCount} elementi. Questo ÃƒÆ’Ã‚Â¨ un requisito non negoziabile.

Tutti i campi sono OBBLIGATORI e non devono essere omessi. Verifica attentamente il tuo output prima di finalizzarlo.
`;

  try {
    // --- 1. GENERATION STEP ---
    // Utilizziamo fetch per chiamare un'API serverless che gestisce la chiamata a Groq
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: generationPrompt,
        model: "openai/gpt-oss-120b",
        temperature: 0.7, // Riduco la temperatura per risultati piÃƒÆ’Ã‚Â¹ deterministici
        top_p: 0.95,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const result = await response.json();
    
    // Verifica se c'ÃƒÆ’Ã‚Â¨ un errore nella risposta
    if (result.error) {
      console.warn(`API error: ${result.error}`);
      throw new Error(`Error calling Groq API: ${result.error}`);
    }
    
    const jsonText = result.content.trim();
    
    // Verifica che il testo sia un JSON valido
    let storyData;
    try {
      storyData = JSON.parse(jsonText) as StoryData;
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      throw new Error('La risposta dell\'API non ÃƒÆ’Ã‚Â¨ in formato JSON valido.');
    }

    // Verifica che la struttura dei dati sia valida
    if (!storyData || !storyData.commonDocument || !storyData.characters || !storyData.solution) {
      throw new Error('La struttura dei dati generata non ÃƒÆ’Ã‚Â¨ valida. Mancano campi obbligatori.');
    }
    
    // Verifica e correggi il numero di personaggi se necessario
    if (storyData.characters.length !== playerCount) {
      console.warn(`Il modello ha generato ${storyData.characters.length} personaggi, ma ne erano richiesti ${playerCount}. Tentativo di correzione...`);
      
      // Se ci sono troppi personaggi, rimuovi quelli in eccesso
      if (storyData.characters.length > playerCount) {
        // Rimuovi i personaggi non colpevoli per primi, se possibile
        const nonCulprits = storyData.characters.filter(char => !char.isCulprit);
        const culprits = storyData.characters.filter(char => char.isCulprit);
        
        // Calcola quanti personaggi rimuovere
        const toRemove = storyData.characters.length - playerCount;
        
        if (nonCulprits.length >= toRemove) {
          // Possiamo rimuovere solo personaggi non colpevoli
          storyData.characters = [...culprits, ...nonCulprits.slice(0, nonCulprits.length - toRemove)];
        } else {
          // Dobbiamo rimuovere anche alcuni colpevoli
          throw new Error(`Il modello ha generato ${storyData.characters.length} personaggi, ma ne erano richiesti ${playerCount}. Impossibile correggere automaticamente.`);
        }
      } else {
        // Se ci sono troppo pochi personaggi, non possiamo correggerlo automaticamente
        throw new Error(`Il modello ha generato ${storyData.characters.length} personaggi, ma ne erano richiesti ${playerCount}. Impossibile correggere automaticamente.`);
      }
      
      // Verifica che la correzione abbia funzionato
      if (storyData.characters.length !== playerCount) {
        throw new Error(`Il modello ha generato ${storyData.characters.length} personaggi, ma ne erano richiesti ${playerCount}. La correzione automatica non ÃƒÆ’Ã‚Â¨ riuscita.`);
      }
      
      console.log(`Correzione riuscita: ora ci sono ${storyData.characters.length} personaggi.`);
    }

    // --- 2. VERIFICATION STEP ---
    const verificationPrompt = `
Sei un detective esperto e un maestro della logica con un'attenzione maniacale ai dettagli. Il tuo compito ÃƒÆ’Ã‚Â¨ revisionare meticolosamente la seguente storia "cena con delitto" per individuare e correggere OGNI possibile incongruenza, contraddizione o buco di trama. La storia DEVE essere difficile ma ASSOLUTAMENTE risolvibile attraverso la deduzione logica.

    storyData = ensureUniqueCharacterNames(storyData);
Ecco i dati della storia da esaminare:
${JSON.stringify(storyData, null, 2)}

Esegui i seguenti controlli APPROFONDITI:

1. **Coerenza Temporale**: Verifica che tutti gli eventi, gli alibi e le azioni dei personaggi siano temporalmente coerenti. Controlla che non ci siano sovrapposizioni impossibili o contraddizioni nelle tempistiche.

2. **Coerenza Narrativa**: Assicurati che le informazioni fornite nei vari round siano coerenti tra loro e con la soluzione finale. Ogni personaggio deve avere una storia coerente dall'inizio alla fine.

3. **Movente del Colpevole**: Il movente DEVE essere:
   - Credibile e sufficientemente forte per giustificare un omicidio
   - Chiaramente collegato al colpevole
   - Supportato da indizi distribuiti nella storia
   - Logicamente consistente con il carattere e la storia del personaggio

4. **RisolvibilitÃƒÆ’Ã‚Â  Garantita**: Il colpevole DEVE poter essere identificato unendo logicamente gli indizi sparsi tra le schede dei personaggi. Verifica che:
   - Esistano indizi sufficienti per identificare il colpevole
   - Gli indizi siano distribuiti in modo equilibrato tra i personaggi
   - La soluzione non si basi su informazioni che i giocatori non possono ottenere
   - Ci sia almeno un indizio cruciale che punti al colpevole in modo inequivocabile

5. **Piste False vs. Errori**: Gli indizi fuorvianti DEVONO essere distrazioni plausibili e non errori logici. Ogni pista falsa deve:
   - Sembrare inizialmente convincente
   - Essere logicamente spiegabile nel contesto della storia
   - Poter essere scartata attraverso un'analisi attenta degli altri indizi

6. **Controllo Incrociato delle Relazioni**: Verifica che le relazioni tra i personaggi siano coerenti in entrambe le direzioni. Se A odia B, questo deve riflettersi in qualche modo anche nella descrizione di B.

7. **Verifica delle Opinioni**: Controlla che le opinioni che ogni personaggio ha degli altri siano coerenti con le loro relazioni e con la trama generale.

Se la storia ÃƒÆ’Ã‚Â¨ perfettamente coerente, logica e risolvibile, restituisci l'oggetto JSON originale senza alcuna modifica.

Se trovi delle incongruenze, il tuo obiettivo ÃƒÆ’Ã‚Â¨ correggerle con la **minima modifica possibile**. Non riscrivere la storia. Apporta solo le modifiche necessarie per risolvere le contraddizioni e garantire la coerenza logica, mantenendo la complessitÃƒÆ’Ã‚Â  originale.

IMPORTANTE: Quando correggi la storia, segui queste linee guida:
1. Assicurati che ogni personaggio abbia un alibi chiaro e verificabile
2. Verifica che gli indizi siano distribuiti in modo equilibrato nei tre round
3. Controlla che ogni personaggio abbia un motivo plausibile per essere sospettato
4. Assicurati che il colpevole abbia lasciato tracce o indizi che possano essere scoperti
5. Verifica che non ci siano "salti logici" necessari per risolvere il caso
6. Controlla che tutti i dettagli della scena del crimine siano coerenti con il metodo dell'omicidio
7. Assicurati che le relazioni tra i personaggi siano realistiche e ben definite

ÃƒÆ’Ã‹â€  FONDAMENTALE che tu rispetti ESATTAMENTE questa struttura JSON:

Esempio di struttura:
{
  "title": "Titolo della Storia",
  "commonDocument": {
    "introduction": "Testo dell'introduzione...",
    "crimeSceneMapDescription": "Descrizione dettagliata della scena del crimine...",
    "characterOverviews": "Panoramica di tutti i personaggi..."
  },
  "characters": [
    {
      "name": "Nome Personaggio 1",
      "isCulprit": true/false,
      "initialDescription": "Descrizione iniziale...",
      "relationships": "Relazioni con gli altri personaggi...",
      "round1Info": "Informazioni per il round 1...",
      "round2Info": "Informazioni per il round 2...",
      "round3Info": "Informazioni per il round 3...",
      "secretsAndMotives": "Segreti e motivi...",
      "opinionsOnOthers": [
        {
          "characterName": "Nome Personaggio 2",
          "opinion": "Opinione su questo personaggio..."
        },
        // Ripeti per tutti gli altri personaggi
      ]
    },
    // Ripeti per tutti i personaggi (esattamente ${playerCount})
  ],
  "solution": {
    "culprits": ["Nome Colpevole 1", "Nome Colpevole 2"],
    "motive": "Motivo del delitto...",
    "how": "Come ÃƒÆ’Ã‚Â¨ stato commesso il delitto...",
    "backstory": "Storia completa dietro il delitto..."
  }
}

Restituisci la storia finale, verificata e logicamente solida, come un singolo oggetto JSON che rispetti rigorosamente lo schema fornito sopra. Tutti i campi sono OBBLIGATORI e non devono essere omessi. Non aggiungere commenti o spiegazioni al di fuori dell'oggetto JSON.
`;
    
    try {
      // Utilizziamo fetch per chiamare un'API serverless che gestisce la chiamata a Groq
      const verificationResponse = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: verificationPrompt,
          model: "openai/gpt-oss-120b",
          temperature: 0.1, // Temperatura ancora piÃƒÆ’Ã‚Â¹ bassa per risultati piÃƒÆ’Ã‚Â¹ deterministici
          response_format: { type: "json_object" }
        })
      });
      
      if (!verificationResponse.ok) {
        throw new Error(`API request failed with status ${verificationResponse.status}`);
      }
      
      const verificationResult = await verificationResponse.json();
      
      // Verifica se c'ÃƒÆ’Ã‚Â¨ un errore nella risposta di verifica
      if (verificationResult.error) {
        console.warn(`API verification error: ${verificationResult.error}`);
        return storyData; // Fallback alla storia originale
      }
      
      const verifiedJsonText = verificationResult.content.trim();
      
      // Verifica che il testo sia un JSON valido
      let verifiedStoryData;
      try {
        verifiedStoryData = JSON.parse(verifiedJsonText) as StoryData;
      } catch (error) {
        console.error('Failed to parse JSON verification response:', error);
        return storyData; // Fallback alla storia originale
      }

      // Verifica che la struttura dei dati sia valida
      if (!verifiedStoryData || !verifiedStoryData.commonDocument || !verifiedStoryData.characters || !verifiedStoryData.solution) {
        console.warn("La struttura dei dati verificata non ÃƒÆ’Ã‚Â¨ valida. Mancano campi obbligatori. VerrÃƒÆ’Ã‚Â  utilizzata la storia originale.");
        return storyData;
      }
      
      // Verifica che il numero di personaggi sia corretto
      if (verifiedStoryData.characters.length !== playerCount) {
        console.warn(`La verifica ha prodotto ${verifiedStoryData.characters.length} personaggi, ma ne erano richiesti ${playerCount}. VerrÃƒÆ’Ã‚Â  utilizzata la storia originale.`);
        return storyData;
      }
      
      // Verifica che ci sia almeno un colpevole nella soluzione
      if (!verifiedStoryData.solution.culprits || verifiedStoryData.solution.culprits.length === 0) {
        console.warn("La soluzione non contiene colpevoli. VerrÃƒÆ’Ã‚Â  utilizzata la storia originale.");
        return storyData;
      }
      
      // Verifica che i colpevoli esistano tra i personaggi
      const characterNames = verifiedStoryData.characters.map(c => c.name);
      const allCulpritsExist = verifiedStoryData.solution.culprits.every(culprit => 
        characterNames.includes(culprit)
      );
      
      if (!allCulpritsExist) {
        console.warn("Alcuni colpevoli nella soluzione non esistono tra i personaggi. VerrÃƒÆ’Ã‚Â  utilizzata la storia originale.");
        return storyData;
      }
      
      // Verifica che il flag isCulprit sia coerente con la lista dei colpevoli
      const culpritFlags = verifiedStoryData.characters.map(c => ({
        name: c.name,
        isCulprit: c.isCulprit
      }));
      
      const inconsistentCulprits = culpritFlags.filter(c => 
        (verifiedStoryData.solution.culprits.includes(c.name) && !c.isCulprit) || 
        (!verifiedStoryData.solution.culprits.includes(c.name) && c.isCulprit)
      );
      
      if (inconsistentCulprits.length > 0) {
        console.warn("Incoerenza tra i flag isCulprit e la lista dei colpevoli nella soluzione. Correzione automatica...");
        // Correggi l'incoerenza
        verifiedStoryData.characters = verifiedStoryData.characters.map(c => ({
          ...c,
          isCulprit: verifiedStoryData.solution.culprits.includes(c.name)
        }));
      }

      verifiedStoryData = ensureUniqueCharacterNames(verifiedStoryData);
      return verifiedStoryData;

    } catch (verificationError) {
      console.error("Errore durante il passaggio di verifica dell'IA:", verificationError);
      console.warn("A causa di un errore nella verifica, verrÃƒÆ’Ã‚Â  utilizzata la storia non verificata.");
      return storyData; // Fallback to the original story
    }

  } catch (error) {
    console.error("Error calling Groq API:", error);
    throw new Error("Failed to generate murder mystery story from API.");
  }
};



