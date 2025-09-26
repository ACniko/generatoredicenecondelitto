import type { StoryData } from '../types';

if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY environment variable not set");
}

// Non inizializziamo direttamente il client Groq nel browser
// per evitare l'esposizione della chiave API

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
        characterOverviews: { type: "string", description: 'Una breve panoramica pubblica di tutti i personaggi e delle loro relazioni reciproche note all\'inizio del gioco. Questo testo verrà letto da tutti. In italiano.' }
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
          round1Info: { type: "string", description: 'Informazioni per il Round 1. Deve includere: 1) Cosa il personaggio sa e può rivelare. 2) Un obiettivo specifico per il round (es. "Parla con X per scoprire Y"). 3) Un\'osservazione o un sospetto su un altro personaggio. In italiano.' },
          round2Info: { type: "string", description: 'Informazioni per il Round 2. Nuovi segreti cruciali. Deve includere: 1) Nuove rivelazioni personali. 2) Un nuovo obiettivo più urgente. 3) Un segreto scoperto o un\'azione sospetta notata in un altro personaggio. In italiano.' },
          round3Info: { type: "string", description: 'Informazioni per il Round 3. Colpi di scena finali. Deve includere: 1) La rivelazione finale che possiede il personaggio. 2) L\'obiettivo finale (es. "Accusa X basandoti su Y"). 3) L\'elemento chiave che collega tutti gli indizi dal suo punto di vista. In italiano.' },
          secretsAndMotives: { type: "string", description: 'Segreti privati e potenziali moventi, anche se il personaggio è innocente. Utile per il giocatore per interpretare il suo ruolo, in italiano.' },
          opinionsOnOthers: {
            type: "array",
            description: "Una lista delle opinioni personali e private del personaggio sugli altri partecipanti. Queste opinioni devono essere soggettive, riflettere pregiudizi, sospetti o legami segreti. Non è necessario avere un'opinione su tutti.",
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
        how: { type: "string", description: 'Come è stato commesso il crimine, in dettaglio, in italiano.' },
        backstory: { type: "string", description: 'La storia completa e i retroscena che hanno portato al delitto, in italiano.' }
      },
      required: ['culprits', 'motive', 'how', 'backstory']
    }
  },
  required: ['title', 'commonDocument', 'characters', 'solution']
};

export const generateMurderMysteryStory = async (playerCount: number, theme: string): Promise<StoryData> => {
  const generationPrompt = `
Sei un maestro narratore e creatore di giochi "cena con delitto". Il tuo compito è generare una storia completa, avvincente e complessa basata sul tema e sul numero di giocatori forniti.

Il numero di giocatori è: ${playerCount}.
Il tema della storia è: "${theme}".

La storia deve essere eccezionalmente avvincente e difficile da risolvere. Segui queste direttive con la massima precisione:

1.  **Documento Comune Iniziale**: Crea un documento comune per tutti i giocatori che includa:
    *   Un'introduzione suggestiva che definisca l'ambientazione e l'evento scatenante (il delitto).
    *   Una descrizione dettagliata della mappa della scena del crimine, che i giocatori possano usare come riferimento.
    *   Una panoramica generale e pubblica di tutti i personaggi e delle loro relazioni conosciute.

2.  **Personaggi Complessi**:
    *   **Colpevoli Nascosti**: Deve esserci almeno un colpevole. Se sono più di uno, la loro alleanza deve essere un segreto scioccante.
    *   **Segreti per Tutti**: OGNI personaggio, specialmente quelli innocenti, deve avere un segreto importante, un movente credibile o un comportamento sospetto che lo renda un potenziale colpevole. Le "piste false" (red herrings) sono fondamentali.
    *   **Relazioni Private**: La sezione "relationships" di ogni personaggio deve descrivere i suoi veri sentimenti e le interazioni segrete con gli altri, non solo le relazioni pubbliche.

3.  **Rivelazione a Round Interattiva**: Le informazioni per ciascun personaggio devono essere suddivise in tre round. È CRUCIALE che ogni round non contenga solo informazioni su se stessi, ma anche e soprattutto **indizi, osservazioni e segreti scoperti riguardo ad ALTRI personaggi**.
    *   **Round 1**: Informazioni di base, alibi e prime osservazioni sospette sugli altri. Assegna a ogni personaggio un piccolo obiettivo per iniziare le interazioni (es: "Chiedi a [Nome] del suo litigio con la vittima").
    *   **Round 2**: Rivelazioni più profonde, segreti che vengono a galla, e indizi più concreti. Gli obiettivi diventano più urgenti (es: "Confronta [Nome] riguardo alla bugia che ha detto nel Round 1").
    *   **Round 3**: Colpi di scena finali, l'indizio decisivo o la confessione parziale che permette di risolvere il caso. L'obiettivo è formulare un'accusa concreta.

4.  **Opinioni Private (Cruciale)**: Per ogni personaggio, includi una sezione \`opinionsOnOthers\`. Questa deve contenere una lista degli altri personaggi con una breve descrizione e un'opinione *dal punto di vista del personaggio a cui appartiene la scheda*. Queste opinioni devono essere soggettive, piene di pregiudizi, sospetti o affetto, e riflettere le loro relazioni segrete e la loro personalità.

5.  **Coerenza Totale**: Assicurati che ogni elemento (moventi, alibi, indizi, relazioni, segreti, opinioni e la soluzione finale) sia perfettamente logico e coerente. La soluzione deve essere deducibile, sebbene difficile.

6. **STRUTTURA JSON OBBLIGATORIA**: È FONDAMENTALE che tu rispetti ESATTAMENTE questa struttura JSON:

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
    "how": "Come è stato commesso il delitto...",
    "backstory": "Storia completa dietro il delitto..."
  }
}

Genera l'output esclusivamente in formato JSON, in lingua italiana, seguendo ESATTAMENTE lo schema fornito sopra. Assicurati che il numero di personaggi generati corrisponda esattamente al numero di giocatori richiesto (${playerCount}). Tutti i campi sono OBBLIGATORI e non devono essere omessi.
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
        temperature: 1,
        top_p: 0.95,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const result = await response.json();
    
    // Verifica se c'è un errore nella risposta
    if (result.error) {
      throw new Error(`API error: ${result.error}`);
    }
    
    const jsonText = result.content.trim();
    
    // Verifica che il testo sia un JSON valido
    let storyData;
    try {
      storyData = JSON.parse(jsonText) as StoryData;
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      throw new Error('La risposta dell\'API non è in formato JSON valido.');
    }

    // Verifica che la struttura dei dati sia valida
    if (!storyData || !storyData.commonDocument || !storyData.characters || !storyData.solution) {
      throw new Error('La struttura dei dati generata non è valida. Mancano campi obbligatori.');
    }
    
    // Verifica che il numero di personaggi sia corretto
    if (storyData.characters.length !== playerCount) {
      throw new Error(`Il modello ha generato ${storyData.characters.length} personaggi, ma ne erano richiesti ${playerCount}.`);
    }

    // --- 2. VERIFICATION STEP ---
    const verificationPrompt = `
Sei un detective esperto e un maestro della logica. Il tuo compito è revisionare meticolosamente la seguente storia "cena con delitto" per individuare ogni possibile incongruenza, contraddizione o buco di trama. La storia deve essere difficile, ma **risolvibile attraverso la deduzione logica**.

Ecco i dati della storia da esaminare:
${JSON.stringify(storyData, null, 2)}

Esegui i seguenti controlli:
1.  **Coerenza**: Esistono contraddizioni negli alibi, nelle tempistiche, nelle relazioni o nei segreti dei personaggi?
2.  **Movente**: Il movente del colpevole è credibile e sufficientemente forte per giustificare un omicidio nel contesto della storia?
3.  **Risolvibilità**: Il colpevole può essere identificato unendo logicamente gli indizi sparsi tra le schede dei vari personaggi? La soluzione non deve basarsi su informazioni che i giocatori non possono ottenere.
4.  **Piste False vs. Errori**: Assicurati che gli indizi fuorvianti siano distrazioni plausibili e non errori logici che rendono la storia irrisolvibile.

Se la storia è perfettamente coerente, logica e risolvibile, restituisci l'oggetto JSON originale senza alcuna modifica.

Se trovi delle incongruenze, il tuo obiettivo è correggerle con la **minima modifica possibile**. Non riscrivere la storia. Apporta solo le modifiche necessarie per risolvere le contraddizioni e garantire la coerenza logica, mantenendo la complessità originale.

È FONDAMENTALE che tu rispetti ESATTAMENTE questa struttura JSON:

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
    "how": "Come è stato commesso il delitto...",
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
          temperature: 0.2, // Lower temperature for more deterministic, logical corrections
          response_format: { type: "json_object" }
        })
      });
      
      if (!verificationResponse.ok) {
        throw new Error(`API request failed with status ${verificationResponse.status}`);
      }
      
      const verificationResult = await verificationResponse.json();
      
      // Verifica se c'è un errore nella risposta di verifica
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
        console.warn("La struttura dei dati verificata non è valida. Mancano campi obbligatori. Verrà utilizzata la storia originale.");
        return storyData;
      }
      
      // Verifica che il numero di personaggi sia corretto
      if (verifiedStoryData.characters.length !== playerCount) {
        console.warn(`La verifica ha prodotto ${verifiedStoryData.characters.length} personaggi, ma ne erano richiesti ${playerCount}. Verrà utilizzata la storia originale.`);
        return storyData;
      }

      return verifiedStoryData;

    } catch (verificationError) {
      console.error("Errore durante il passaggio di verifica dell'IA:", verificationError);
      console.warn("A causa di un errore nella verifica, verrà utilizzata la storia non verificata.");
      return storyData; // Fallback to the original story
    }

  } catch (error) {
    console.error("Error calling Groq API:", error);
    throw new Error("Failed to generate murder mystery story from API.");
  }
};