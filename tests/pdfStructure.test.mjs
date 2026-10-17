import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentPath = path.join(projectRoot, 'components', 'StoryDisplay.tsx');
const compiled = await build({
  entryPoints: [componentPath],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  write: false,
});
const componentModule = new Module(componentPath);
componentModule.filename = componentPath;
componentModule.paths = Module._nodeModulePaths(path.dirname(componentPath));
componentModule._compile(compiled.outputFiles[0].text, componentPath);
const StoryDisplay = componentModule.exports.default;

function makeStory(count) {
  const names = Array.from({ length: count }, (_, i) => `Ospite ${i + 1}`);
  const detail = Array.from({ length: 45 }, (_, i) => `dettaglio${i + 1}`).join(' ');
  const characterOverviews = names.map((name, i) => `${name}: ritratto pubblico ${i + 1} con una relazione visibile. ${detail}`);
  const evidence = names.flatMap((name, i) => [1, 2, 3].map((round) => ({
    id: `prova-${i + 1}-${round}`,
    title: `Prova ${i + 1} round ${round}`,
    round,
    recipients: [name],
    type: 'corroborating',
    content: `Contenuto integrale della prova ${i + 1}-${round}. ${detail}`,
    solutionLink: `Collegamento unico ${i + 1}-${round}.`,
    organizerNote: `Nota riservata ${i + 1}-${round}.`,
  })));
  return {
    title: 'Il caso della villa',
    commonDocument: {
      introduction: 'Introduzione comune.',
      crimeSceneMapDescription: 'Scena del crimine.',
      characterOverviews: characterOverviews.join('\n\n'),
    },
    characters: names.map((name, i) => ({
      name,
      isCulprit: i === 0,
      initialDescription: `Profilo pubblico ${name}.`,
      relationships: `Relazioni di ${name}.`,
      opinionsOnOthers: names.filter((other) => other !== name).map((characterName) => ({ characterName, opinion: `Opinione di ${name} su ${characterName}.` })),
      secretsAndMotives: `Segreto di ${name}.`,
      round1Info: `Round uno di ${name}.`,
      round2Info: `Round due di ${name}.`,
      round3Info: `Round tre di ${name}.`,
    })),
    evidence,
    solution: { culprits: [names[0]], motive: 'Movente.', how: 'Metodo.', backstory: 'Retroscena.', deductionChain: Array.from({ length: 4 }, (_, i) => `Passaggio deduttivo ${i + 1}.`) },
  };
}

const pagesFrom = (markup) => [...markup.matchAll(/<section class="pdf-page"[^>]*>([\s\S]*?)<\/section>/g)].map((match) => match[1]);

for (const count of [4, 8, 12]) {
  test(`${count} guests retain six character pages and bounded common and clue pages`, () => {
    const story = makeStory(count);
    const pages = pagesFrom(renderToStaticMarkup(React.createElement(StoryDisplay, { story, onReset() {} })));
    const commonCount = 2 + Math.ceil(count / 4);
    const clueCount = Math.ceil(story.evidence.length / 2);
    const solutionStart = commonCount + 3;
    const characterStart = solutionStart + 3 + clueCount;
    assert.equal(pages.length, characterStart + count * 6);

    const overviewPages = pages.slice(2, commonCount);
    for (const page of overviewPages) {
      const entries = story.characters.filter(({ name }) => page.includes(`ritratto pubblico ${Number(name.split(' ')[1])} con`));
      assert.ok(entries.length > 0 && entries.length <= 4, `cast page contains ${entries.length} entries`);
    }
    for (const overview of story.commonDocument.characterOverviews.split('\n\n')) {
      assert.equal(overviewPages.filter((page) => page.includes(overview)).length, 1);
    }

    const cluePages = pages.slice(solutionStart + 3, characterStart);
    for (const page of cluePages) {
      assert.match(page, /SPOILER/);
      const cards = (page.match(/Nota organizzatore:/g) || []).length;
      assert.ok(cards > 0 && cards <= 2, `clue page contains ${cards} cards`);
    }
    const clueMarkup = cluePages.join('');
    for (const clue of story.evidence) {
      for (const value of [clue.title, clue.content, clue.recipients[0], clue.solutionLink, clue.organizerNote]) {
        assert.ok(clueMarkup.includes(value), `missing ${value}`);
      }
    }

    for (let i = 0; i < count; i += 1) {
      const packet = pages.slice(characterStart + i * 6, characterStart + (i + 1) * 6);
      assert.equal(packet.length, 6);
      assert.match(packet[0], /Descrizione pubblica/);
      assert.match(packet[1], /Le tue opinioni sugli altri/);
      assert.match(packet[2], /Segreti e motivazioni/);
      for (let round = 1; round <= 3; round += 1) assert.match(packet[round + 2], new RegExp(`Round ${round}`));
    }
  });
}
