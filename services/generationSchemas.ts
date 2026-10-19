export const clueSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    round: { type: 'integer', enum: [1, 2, 3] },
    type: { type: 'string', enum: ['decisive', 'corroborating', 'red-herring'] },
    content: { type: 'string' },
    solutionLink: { type: 'string' },
    organizerNote: { type: 'string' },
  },
  required: ['id', 'title', 'round', 'type', 'content', 'solutionLink', 'organizerNote'],
};

export const characterSchema = {
  type: 'object',
  properties: {
    characters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          isCulprit: { type: 'boolean' },
          initialDescription: { type: 'string' },
          relationships: { type: 'string' },
          round1Info: { type: 'string' },
          round2Info: { type: 'string' },
          round3Info: { type: 'string' },
          secretsAndMotives: { type: 'string' },
          opinionsOnOthers: {
            type: 'array',
            items: {
              type: 'object',
              properties: { characterName: { type: 'string' }, opinion: { type: 'string' } },
              required: ['characterName', 'opinion'],
            },
          },
        },
        required: ['name', 'isCulprit', 'initialDescription', 'relationships', 'round1Info', 'round2Info', 'round3Info', 'secretsAndMotives', 'opinionsOnOthers'],
      },
    },
  },
  required: ['characters'],
};

export const verificationSchema = {
  type: 'object',
  properties: {
    approved: { type: 'boolean' },
    summary: { type: 'string' },
    issues: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['approved', 'summary', 'issues', 'warnings'],
};
