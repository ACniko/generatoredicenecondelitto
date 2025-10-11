export type GuideArticle = {
  id: string;
  title: string;
  readingTime: string;
  summary: string;
  body: string[];
};

export const guideArticles: GuideArticle[] = [
  {
    id: 'organizzare-cena-con-delitto',
    title: 'Come organizzare una cena con delitto perfetta',
    readingTime: '6 minuti',
    summary:
      'Pianificazione passo dopo passo, dalla scelta della location alla distribuzione delle schede personaggio, per offrire un mistero coinvolgente e privo di intoppi.',
    body: [
      'Una cena con delitto di successo nasce da una pianificazione accurata. Inizia definendo il numero di partecipanti e il livello di esperienza del gruppo con i giochi di ruolo: servirà per scegliere una trama equilibrata, né troppo complessa né troppo lineare. Scegli una location comoda, con spazi separati dove i giocatori possano parlare senza essere ascoltati. Illumina con luci soffuse e aggiungi elementi scenografici coerenti con l ambientazione (candele, valigie vintage, mappe, fotografie ingiallite). Ricorda che l atmosfera contribuisce almeno quanto la storia a immergere gli ospiti nel mistero.',
      'Stabilisci un timing chiaro per la serata. Prevedi un momento iniziale dedicato all accoglienza, quindi una presentazione delle regole e dei personaggi. Suddividi il gioco in round, con pause programmate per cenare e confrontarsi con calma. Comunica in anticipo la durata indicativa dell evento (di solito 2 ore e mezza - 3 ore) così ciascun ospite potrà organizzarsi. Se usi il nostro generatore, stampa o invia in digitale le schede, ma consegnale solo all inizio per alimentare il senso di attesa.',
      'Coinvolgi un aiutante di fiducia che ti supporti nel ruolo di moderatore: potrà gestire gli imprevisti, far avanzare la trama e garantire che tutti abbiano la possibilità di esprimersi. Prima dell evento leggi attentamente la soluzione e verifica che ogni indizio sia accessibile: se un passaggio ti sembra poco chiaro, integra un appunto personalizzato. Preparati anche un breve discorso finale per svelare il colpevole con ritmo e teatralità. Con queste attenzioni trasformerai la tua cena con delitto in un esperienza memorabile per ogni invitato.',
    ],
  },
  {
    id: 'ambientazioni-originali',
    title: 'Ambientazioni originali per il tuo mistero',
    readingTime: '5 minuti',
    summary:
      'Dal castello gotico alla stazione orbitante: come scegliere uno scenario creativo che resti coerente con la trama e facile da gestire.',
    body: [
      'Un ambientazione ben scelta dà colore alla tua cena con delitto e aiuta i partecipanti a immedesimarsi. I classici funzionano sempre: ville vittoriane, battelli fluviali, hotel di lusso. Tuttavia puoi stupire con scelte più insolite, purché rimangano credibili. Prova con un moderno centro di ricerca, un festival gastronomico itinerante, una nave scuola oppure un asta di beneficenza ambientata negli anni Settanta. Domandati quali elementi scenici possiedi già e quali potresti realizzare con semplicità: una buona coerenza visiva fa la differenza.',
      'Se opti per ambientazioni futuristiche o fantasy, esplicita ai giocatori le regole dell universo narrativo. Spiega in poche righe quali tecnologie sono disponibili, come funziona la giustizia o quali specie popolano il luogo. Questo evita domande improduttive e mantiene il focus sugli indizi. Ricorda che un ambientazione complessa richiede più tempo di preparazione, quindi valuta il livello del tuo gruppo. Puoi sempre combinare un contesto originale con dinamiche classiche di gelosie, rivalità professionali e segreti di famiglia.',
      'Sfrutta la musica per rinforzare l atmosfera. Una playlist jazz accompagna bene un noir anni Trenta, mentre brani elettronici minimalisti funzionano per thriller contemporanei. Aggiungi oggetti tematici al tavolo: menù stampati ad hoc, segnaposto con i nomi dei personaggi o gadget legati alla storia. Infine, falleci delle foto ricordo: chiederai ai partecipanti il permesso e potrai condividere una galleria privata dopo la serata, aggiungendo valore e alimentando il passaparola positivo.',
    ],
  },
  {
    id: 'ruolo-organizzatore',
    title: 'Il ruolo dell organizzatore: consigli pratici',
    readingTime: '7 minuti',
    summary:
      'Dalla gestione del ritmo alle tecniche di mediazione: tutto ciò che serve per condurre il gioco con sicurezza e fair play.',
    body: [
      'L organizzatore di una cena con delitto è il regista invisibile dell esperienza. La prima responsabilità consiste nel conoscere la storia meglio di chiunque altro. Leggi ogni documento con attenzione, annota le connessioni tra gli indizi e riscrivi con parole tue i passaggi chiave: questo ti permetterà di reagire con prontezza se i giocatori deviano dalla traccia. Pianifica un breve discorso di apertura in cui presenti l ambientazione, ricordi le regole base (non rivelare i documenti altrui, restare nel personaggio, segnalare eventuali disagi) e spieghi come funzionano i round.',
      'Per mantenere il ritmo alterna momenti di discussione collettiva a fasi più intime. Incoraggia gli ospiti a parlarsi a coppie o in piccoli gruppi: molti indizi funzionano proprio perché vengono scambiati in privato. Se noti qualcuno in difficoltà, avvicinati con un suggerimento o proponi una scena breve che coinvolga tutti. È importante anche gestire il tempo: imposta un timer (silenzioso) per ciascun round e avverti i partecipanti quando mancano pochi minuti. In questo modo il gioco scorre e l attenzione rimane alta.',
      'Prepara risposte alle domande frequenti: posso accusare subito?, devo dire la verità?, come presento la mia teoria?. Fornisci linee guida chiare ma lascia spazio alla creatività. A fine serata, cura la rivelazione della soluzione con ritmo narrativo: ricapitola gli indizi in ordine logico, cita le azioni dei sospettati e premia la squadra o il detective che ha indovinato. Un feedback finale, magari un questionario veloce o una conversazione informale, ti aiuterà a migliorare le prossime edizioni.',
    ],
  },
  {
    id: 'coinvolgere-partecipanti',
    title: 'Coinvolgere i partecipanti e gestire i caratteri timidi',
    readingTime: '5 minuti',
    summary:
      'Strategie per far sentire tutti protagonisti, anche chi non ha esperienza di giochi di ruolo o tende a restare in silenzio.',
    body: [
      'Non tutti i giocatori arrivano preparati allo stesso modo: alcuni sono entusiasti e pronti a improvvisare, altri temono di mettersi in mostra. Per aiutare i più riservati, invia qualche giorno prima un messaggio con suggerimenti pratici: non serve recitare, basta leggere la scheda e seguire gli obiettivi. All inizio del gioco, assegna a ognuno un azione semplice da compiere (presentati al gruppo con due dettagli sul tuo passato, fai una domanda a chi siede alla tua sinistra). Queste micro consegne sciolgono l imbarazzo e stimolano la conversazione.',
      'Organizza gli spazi in modo da evitare gruppi chiusi: cambia la disposizione dei posti tra un round e l altro oppure invita i giocatori a girare con indizi fisici (lettere, fotografie, appunti). Ricorda di celebrare ogni contributo, anche i dubbi o le teorie sbagliate: ringrazia chi parla, prendi nota su una lavagna visibile, sottolinea come ogni informazione stia ricostruendo il quadro. Se qualcuno domina la scena, intervieni con gentilezza e ridai la parola a chi non si è ancora espresso.',
      'Durante la rivelazione finale coinvolgi tutti: chiedi a ciascun personaggio di riassumere un indizio fondamentale prima di svelare la verità. Dopo l annuncio del colpevole, invita i partecipanti a condividere l azione preferita della serata o l indizio che li ha messi fuori strada. Questo momento di confronto aiuta a chiudere con un ricordo positivo e invoglia gli ospiti a partecipare a future cene con delitto.',
    ],
  },
  {
    id: 'checklist-pre-evento',
    title: 'Checklist completa prima dell evento',
    readingTime: '4 minuti',
    summary:
      'Una lista di controllo da stampare per non dimenticare nulla: materiali, tempistiche, comunicazioni ai partecipanti e backup digitali.',
    body: [
      'Per evitare imprevisti, prepara una checklist dettagliata almeno tre giorni prima. Assicurati di aver stampato tutte le schede personaggio in duplice copia, i documenti comuni, i materiali per gli indizi fisici (buste, oggetti di scena, eventuali codici da decifrare). Prepara una cartellina per ogni round con l occorrente già ordinato, così durante la serata dovrai solo distribuire gli elementi giusti.',
      'Controlla la tecnologia: se usi musica in streaming o vuoi proiettare immagini, verifica connessioni, casse e cavi di alimentazione. Tieni sempre un piano B offline (playlist scaricate, speaker portatile, stampe aggiuntive). Invia ai partecipanti un promemoria con data, orario, dress code e consigli su come calarsi nel personaggio, evitando spoiler. Specifica anche eventuali allergie alimentari da segnalare.',
      'Il giorno dell evento allestisci il tavolo con almeno 30 minuti di anticipo. Posiziona le schede rivolte verso il basso, aggiungi biglietti con i nomi dei personaggi e prepara il discorso introduttivo con un indice a punti. Respira, sorridi e goditi la serata: una buona preparazione ti permetterà di gestire con tranquillità qualsiasi imprevisto.',
    ],
  },
];
