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
}

export interface CommonDocument {
  introduction: string;
  crimeSceneMapDescription: string;
  characterOverviews: string;
}

export interface StoryData {
  title: string;
  commonDocument: CommonDocument;
  characters: Character[];
  solution: Solution;
}