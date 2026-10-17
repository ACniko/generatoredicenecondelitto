export interface Opinion {
  characterName: string;
  opinion: string;
}

export interface Character {
  name: string;
  isCulprit: boolean;
  initialDescription: string;
  relationships: string;
  round1Info: string;
  round2Info: string;
  round3Info: string;
  secretsAndMotives: string;
  opinionsOnOthers: Opinion[];
}

export interface Solution {
  culprits: string[];
  motive: string;
  how: string;
  backstory: string;
  deductionChain: string[];
}

export interface EvidenceClue {
  id: string;
  title: string;
  round: 1 | 2 | 3;
  recipients: string[];
  type: 'decisive' | 'corroborating' | 'red-herring';
  content: string;
  solutionLink: string;
  organizerNote: string;
}

export interface CommonDocument {
  introduction: string;
  crimeSceneMapDescription: string;
  characterOverviews: string;
}

export interface StoryData {
  verificationWarning?: string;
  title: string;
  commonDocument: CommonDocument;
  characters: Character[];
  evidence: EvidenceClue[];
  solution: Solution;
}
