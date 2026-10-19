export const makeBible = (playerCount) => {
  const names = Array.from({ length: playerCount }, (_, i) => `Personaggio ${i + 1} Rossi`);
  return {
    title: 'Il segreto della villa',
    victimName: 'Alberto Neri',
    commonDocument: {
      introduction: Array.from({ length: 30 }, (_, i) => `Introduzione della villa e del delitto ${i + 1}.`).join(' '),
      crimeSceneMapDescription: Array.from({ length: 30 }, (_, i) => `Descrizione verificabile della scena e degli ambienti ${i + 1}.`).join(' '),
      characterOverviews: names.map((name) => `${name}: ${Array.from({ length: 10 }, (_, i) => `ruolo pubblico relazione villa ${i + 1}.`).join(' ')}`).join('\n\n')
    },
    solution: {
      culprits: [names[0]],
      motive: Array.from({ length: 20 }, (_, i) => `Movente documentale credibile e personale ${i + 1}.`).join(' '),
      how: Array.from({ length: 20 }, (_, i) => `Metodo verificabile coerente con la scena e la cronologia ${i + 1}.`).join(' '),
      backstory: Array.from({ length: 25 }, (_, i) => `Retroscena dei rapporti tra gli ospiti e la vittima ${i + 1}.`).join(' '),
      deductionChain: [1, 2, 3, 4].map((step) => Array.from({ length: 3 }, (_, i) => `Passaggio deduttivo ${step} collega una prova concreta alla cronologia ${i + 1}.`).join(' '))
    },
    timeline: [
      { id: 't1', time: '20:00', location: 'sala da pranzo', event: 'Gli ospiti arrivano per la cena.', characters: names.slice(0, 3) },
      { id: 't2', time: '20:30', location: 'biblioteca', event: 'La vittima consulta il registro.', characters: names.slice(0, 2) },
      { id: 't3', time: '21:00', location: 'sala da pranzo', event: 'Si tiene il brindisi.', characters: names.slice(1, 4) },
      { id: 't4', time: '21:30', location: 'corridoio', event: 'Un ospite trova la vittima.', characters: names.slice(0, 2) }
    ],
    characterPlans: names.map((name, index) => ({
      name,
      publicRole: 'Ospite e responsabile di una parte dell’evento.',
      truth: 'Conosce un dettaglio verificabile della serata.',
      privateSecret: 'Nasconde un comportamento imbarazzante ma non il delitto.',
      motive: 'Ha avuto un conflitto personale con la vittima.',
      alibiTimeline: 'Tra le 21 e le 22 era nella sala principale.',
      relationshipFacts: names.filter((other) => other !== name).slice(0, 3).map((characterName) => ({ characterName, fact: 'Il loro rapporto è segnato da un debito, una promessa infranta e un interesse condiviso.' })),
      cluePlan: [1, 2, 3].map((round) => ({
        id: `clue-${index}-${round}`,
        title: `Prova del round ${round}`,
        round,
        type: index === round ? 'decisive' : index === 0 && round === 1 ? 'corroborating' : 'red-herring',
        content: 'Un documento originale colloca il registro nella biblioteca alle ventuno. Il segno d inchiostro coincide con la copia trovata vicino al calice. Confrontando le due date, gli ospiti possono verificare chi ha avuto accesso al mobile e quale alibi non coincide con gli orari annotati.',
        solutionLink: 'Questa prova collega l’orario del registro alla finestra del delitto e consente di dedurre chi poteva accedere alla biblioteca senza lasciare una traccia coerente.',
        organizerNote: 'Questa nota è riservata all’organizzatore e contiene il significato della prova.'
      }))
    }))
  };
};

export const makeCharacter = (name, allNames) => {
  const text = (word, count) => Array.from({ length: count }, () => word).join(' ');
  return {
    name,
    isCulprit: false,
    initialDescription: text('personalità', 105),
    relationships: text('relazione', 185),
    round1Info: `Fatti che conosci: ${text('rivelazione', 150)} Cosa puoi rivelare: ${text('brindisi', 4)} Obiettivo concreto: parla con ${allNames.find((other) => other !== name)} e chiedi dell alibi. Informazione nuova: ${text('registro', 10)}`,
    round2Info: `Fatti che conosci: ${text('confronto', 150)} Cosa puoi rivelare: ${text('biblioteca', 4)} Obiettivo concreto: confronta con ${allNames.find((other) => other !== name)} gli orari. Informazione nuova: ${text('chiave', 10)}`,
    round3Info: `Fatti che conosci: ${text('deduzione', 150)} Cosa puoi rivelare: ${text('calice', 4)} Obiettivo concreto: chiedi a ${allNames.find((other) => other !== name)} di spiegare la contraddizione. Informazione nuova: ${text('prova', 10)}`,
    secretsAndMotives: text('movente', 185),
    opinionsOnOthers: allNames.filter((other) => other !== name).map((characterName) => ({ characterName, opinion: text('giudizio', 45) }))
  };
};


export const makeCanonical = (playerCount) => { const b = makeBible(playerCount); return ({ title:b.title, victim:{id:'victim',name:b.victimName}, culpritId:'c0', setting:'Villa, cena e biblioteca', publicIntroductionFacts:['Cena nella villa, scoperta del corpo in corridoio dopo il brindisi'], publicSceneFacts:['Biblioteca con unico accesso dal corridoio e registro sul tavolo; calice vicino alla sedia'], motive:'Debito nascosto', method:'Veleno nel calice', backstory:'Registro falsificato', cast:b.characterPlans.map((c,i)=>({id:`c${i}`,name:c.name,publicRole:c.publicRole,publicFacts:['Ospite invitato alla cena con rapporti di lavoro con la vittima'],truth:c.truth,privateSecret:c.privateSecret,motive:c.motive,alibi:c.alibiTimeline,relationships:c.relationshipFacts.map(r=>({characterId:`c${b.characterPlans.findIndex(x=>x.name===r.characterName)}`,fact:r.fact})),knowledgeByRound:[1,2,3].map(round=>({round,facts:[`Fatto ${round}`]}))})), timeline:b.timeline.map(t=>({...t,characters:t.characters.map(n=>n===b.victimName?'victim':`c${b.characterPlans.findIndex(x=>x.name===n)}`)})), clues:b.characterPlans.flatMap((c,i)=>c.cluePlan.map(cl=>({id:cl.id,recipientId:`c${i}`,round:cl.round,type:cl.type,fact:cl.content,deduction:cl.solutionLink}))), deduction:[1,2,3,4].map((n)=>({fact:`Deduzione ${n}`,clueIds:[`clue-${Math.min(n,3)}-${Math.min(n,3)}`]})) }); };
