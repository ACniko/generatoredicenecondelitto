import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { makeBible, makeCharacter, makeCanonical } from './generationFixtures.mjs';
const { outputFiles } = await build({ entryPoints: ['services/groqService.ts'], bundle: true, write: false, platform: 'browser', format: 'esm', plugins: [{ name: 'runtime', setup(build) { build.onResolve({filter: /generationRuntime/}, () => ({path:'runtime',namespace:'mock'})); build.onLoad({filter:/.*/, namespace:'mock'}, () => ({contents:'export const createGenerationRuntime = (...args) => globalThis.__generationRuntime(...args);',loader:'js'})); }}] });
const service = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

async function run(count=4, mutate=()=>{}, supplied) {
 const bible=makeBible(count), plan=makeCanonical(count), calls=[], saves=[];
 const stages=supplied??{};
 const runtime={checkpoint:{stages,status:'running'},getStage:k=>stages[k],saveStage:(k,v,validated)=>{stages[k]={value:structuredClone(v),validated};saves.push({k,validated,value:structuredClone(v)});},invalidateStages:keys=>keys.forEach(k=>delete stages[k]),progress(){},assertActive(){},pause(){},complete:s=>s,async requestJson(prompt,phase,schema){const data=JSON.parse(prompt.split('\nINPUT:\n')[1]);calls.push({phase,data,prompt});let result;
 if(phase==='canonical_plan') result=plan;
 else if(phase==='common_document') result=structuredClone(bible.commonDocument);
 else if(phase==='solution') result=structuredClone(bible.solution);
 else if(phase==='evidence_batch') result={evidence:data.selected.map(x=>({...bible.characterPlans.flatMap(c=>c.cluePlan).find(c=>c.id===x.id),recipients:[bible.characterPlans[Number(x.recipientId.slice(1))].name]}))};
 else if(phase==='character_batch') result={characters:data.selected.map(x=>({...makeCharacter(x.name,bible.characterPlans.map(c=>c.name)),isCulprit:x.id==='c0'}))};
 else if(phase==='story_verification') result={approved:true,summary:'OK',issues:[],warnings:[]};
 else if(phase==='field_repair') result={value:data.current};
 await mutate({phase,data,result,calls,stages,bible,plan,saves,schema});return result;
 }};
 globalThis.__generationRuntime=()=>runtime;
 try { const story=await service.generateMurderMysteryStory(count,'Villa');return {story,calls,saves,stages,bible}; } catch(error) { Object.assign(error,{calls,saves,stages,bible}); throw error; }
}
test('compact plan precedes separate prose, batched cards and evidence; checkpoints raw then validated',async()=>{const {story,calls,saves}=await run();assert.equal(calls[0].phase,'canonical_plan');assert.equal(story.characters.length,4);assert.equal(story.evidence.length,12);assert.equal(calls.filter(c=>c.phase==='character_batch').length,2);assert.equal(calls.filter(c=>c.phase==='evidence_batch').length,3);assert.ok(calls.filter(c=>c.phase==='character_batch').every(c=>!c.prompt.includes('commonDocument')));assert.ok(saves.some(s=>!s.validated));assert.ok(saves.some(s=>s.validated));});
test('accepted checkpoint stages are reused without requests',async()=>{const a=await run();const b=await run(4,()=>{},a.stages);assert.deepEqual(b.story,a.story);assert.equal(b.calls.length,0);});

function repairOriginal({data,result,bible,schema}) {
  if(data.targets) {
    for(const target of data.targets) {
      const single={value:null};
      repairOriginal({data:{...target,stage:data.stage},result:single,bible,schema:{properties:{value:schema.properties[target.key]}}});
      result[target.key]=single.value;
    }
    return;
  }
  const names=bible.characterPlans.map(c=>c.name);
  const card=name=>({...makeCharacter(name,names),isCulprit:name===names[0]});
  const clues=bible.characterPlans.flatMap(c=>c.cluePlan.map(cl=>({...cl,recipients:[c.name]})));
  const target=schema.properties.value;
  if(data.code==='missing_character') result.value=card(target.properties.name.enum[0]);
  else if(data.code==='missing_opinion') result.value={characterName:target.properties.characterName.enum[0],opinion:Array(45).fill('giudizio').join(' ')};
  else if(data.code==='missing_public_profile') {const name=target.properties.characterName.enum[0];result.value={characterName:name,description:bible.commonDocument.characterOverviews.split('\n\n')[names.indexOf(name)]};}
  else if(data.code==='missing_clue') result.value=clues.find(c=>c.id===target.properties.id.enum[0]);
  else {
    let root;
    if(data.stage==='common_document') root={...bible.commonDocument,publicProfiles:bible.commonDocument.characterOverviews.split('\n\n').map((description,i)=>({characterName:names[i],description}))};
    else if(data.stage==='solution') root=bible.solution;
    else if(data.stage==='canonical_plan') root=makeCanonical(names.length);
    else if(data.stage.startsWith('characters:')) root={characters:data.stage.slice(11).split(',').map(id=>card(names[Number(id.slice(1))]))};
    else root={evidence:data.stage.slice(9).split(',').map(id=>clues.find(c=>c.id===id))};
    result.value=data.path.reduce((v,key)=>v[key],root);
  }
}
test('only a short common introduction is patched; all accepted prose remains identical',async()=>{
 const baseline=await run(5);
 const fixed=await run(5,args=>{if(args.phase==='common_document')args.result.introduction='Breve';if(args.phase==='field_repair')repairOriginal(args);});
 assert.deepEqual(fixed.story,baseline.story);
 const repairs=fixed.calls.filter(c=>c.phase==='field_repair');assert.equal(repairs.length,1);assert.deepEqual(repairs[0].data.path,['introduction']);
 assert.equal(fixed.calls.filter(c=>c.phase==='canonical_plan').length,1);
 assert.ok(fixed.saves.find(s=>s.k==='common_document'&&!s.validated&&s.value.introduction==='Breve'));
});
test('a broken round repairs only that round and preserves every accepted sibling',async()=>{
 const baseline=await run();
 const fixed=await run(4,args=>{if(args.phase==='character_batch'&&args.data.selected[0].id==='c0')args.result.characters[0].round2Info='Breve';if(args.phase==='field_repair')repairOriginal(args);});
 assert.deepEqual(fixed.story,baseline.story);
 assert.deepEqual(fixed.calls.filter(c=>c.phase==='field_repair').map(c=>c.data.path),[['characters',0,'round2Info']]);
 assert.equal(fixed.calls.filter(c=>c.phase==='character_batch').length,2);
});
test('one missing opinion requests only that opinion, with no character regeneration',async()=>{
 const baseline=await run();
 const fixed=await run(4,args=>{if(args.phase==='character_batch'&&args.data.selected[0].id==='c0')args.result.characters[0].opinionsOnOthers.pop();if(args.phase==='field_repair')repairOriginal(args);});
 assert.deepEqual(fixed.story,baseline.story);
 assert.deepEqual(fixed.calls.filter(c=>c.phase==='field_repair').map(c=>({code:c.data.code,path:c.data.path})),[{code:'missing_opinion',path:['characters',0,'opinionsOnOthers',2]}]);
});
test('several absent opinions are independent patches with accepted opinions preserved',async()=>{
 const baseline=await run();
 const fixed=await run(4,args=>{if(args.phase==='character_batch'&&args.data.selected[0].id==='c0')args.result.characters[0].opinionsOnOthers.splice(1);if(args.phase==='field_repair')repairOriginal(args);});
 assert.deepEqual(fixed.story,baseline.story);assert.equal(fixed.calls.filter(c=>c.phase==='field_repair').length,2);
});
test('one missing character appends only that card and preserves its complete batch sibling',async()=>{
 const baseline=await run();
 const fixed=await run(4,args=>{if(args.phase==='character_batch'&&args.data.selected[0].id==='c0')args.result.characters.shift();if(args.phase==='field_repair')repairOriginal(args);});
 assert.deepEqual(fixed.story,baseline.story);
 assert.deepEqual(fixed.calls.filter(c=>c.phase==='field_repair').map(c=>c.data.code),['missing_character']);
});
test('one missing clue repairs only that evidence unit',async()=>{
 const baseline=await run();let removed=false;
 const fixed=await run(4,args=>{if(args.phase==='evidence_batch'&&!removed){args.result.evidence.pop();removed=true;}if(args.phase==='field_repair')repairOriginal(args);});
 assert.deepEqual(fixed.story,baseline.story);assert.deepEqual(fixed.calls.filter(c=>c.phase==='field_repair').map(c=>c.data.code),['missing_clue']);
});
test('bad clue round repairs only its scalar round with fixed clue identity and recipients',async()=>{
 const baseline=await run();let changed=false;
 const fixed=await run(4,args=>{if(args.phase==='evidence_batch'&&!changed){args.result.evidence[0].round=2;changed=true;}if(args.phase==='field_repair')repairOriginal(args);});
 assert.deepEqual(fixed.story,baseline.story);assert.deepEqual(fixed.calls.filter(c=>c.phase==='field_repair').map(c=>c.data.path),[['evidence',0,'round']]);
});
test('duplicate cards, clues and opinions are removed without regenerating accepted entries',async()=>{
 const baseline=await run();
 const fixed=await run(4,args=>{if(args.phase==='character_batch'){args.result.characters[0].opinionsOnOthers.push(structuredClone(args.result.characters[0].opinionsOnOthers[0]));args.result.characters.push(structuredClone(args.result.characters[0]));}if(args.phase==='evidence_batch')args.result.evidence.push(structuredClone(args.result.evidence[0]));});
 assert.deepEqual(fixed.story,baseline.story);assert.equal(fixed.calls.filter(c=>c.phase==='field_repair').length,0);
});
test('three unsuccessful field patches pause with a retained draft and resume the same target',async()=>{
 let failure;
 try{await run(4,args=>{if(args.phase==='common_document')args.result.introduction='Breve';});}catch(error){failure=error;}
 assert.ok(failure);assert.match(failure.message,/pausa/);assert.equal(failure.calls.filter(c=>c.phase==='field_repair').length,3);
 assert.equal(failure.stages.common_document.value.introduction,'Breve');assert.equal(failure.stages.common_document.validated,false);
 const fixed=await run(4,args=>{if(args.phase==='field_repair')repairOriginal(args);},failure.stages);
 assert.equal(fixed.calls.filter(c=>c.phase==='canonical_plan').length,0);assert.equal(fixed.calls.filter(c=>c.phase==='common_document').length,0);assert.equal(fixed.calls.filter(c=>c.phase==='field_repair').length,1);
});
test('canonical timeline is repaired before rendering and never triggers full plan regeneration',async()=>{
 const fixed=await run(4,args=>{if(args.phase==='canonical_plan')args.result.timeline[2].time='19:00';if(args.phase==='field_repair')repairOriginal(args);});
 assert.deepEqual(fixed.calls[1].data.path,['timeline',2,'time']);assert.equal(fixed.calls[1].phase,'field_repair');assert.equal(fixed.calls[2].phase,'common_document');assert.equal(fixed.calls.filter(c=>c.phase==='canonical_plan').length,1);
});
test('restored validated flags are checked again; corrupt prose is repaired',async()=>{
 const a=await run();a.stages['characters:c0,c1'].value.characters[0].round2Info='Breve';
 const fixed=await run(4,args=>{if(args.phase==='field_repair')repairOriginal(args);},a.stages);
 assert.deepEqual(fixed.calls.filter(c=>c.phase==='field_repair').map(c=>c.data.path),[['characters',0,'round2Info']]);assert.equal(fixed.calls.filter(c=>c.phase==='story_verification').length,1);
});
test('final verifier sees the full story and rejection or network failure retains every card',async()=>{
 const rejected=await run(4,args=>{if(args.phase==='story_verification'){assert.equal(args.data.story.characters.length,4);assert.equal(args.data.story.evidence.length,12);args.result.approved=false;args.result.issues=['Controllare cronologia'];}});
 assert.ok(rejected.story.verificationWarning);assert.equal(rejected.story.characters.length,4);
 const failed=await run(4,args=>{if(args.phase==='story_verification')throw new Error('Network');});assert.ok(failed.story.verificationWarning);
});
test('an abort in final verification propagates instead of completing with a warning',async()=>{
 await assert.rejects(()=>run(4,args=>{if(args.phase==='story_verification')throw new DOMException('Interrotto','AbortError');}),{name:'AbortError'});
});
test('public document receives canonical observed scene and introduction facts',async()=>{
 const {calls}=await run();const common=calls.find(c=>c.phase==='common_document');assert.ok(common.prompt.includes('publicSceneFacts'));assert.ok(common.prompt.includes('registro sul tavolo'));assert.ok(common.prompt.includes('publicIntroductionFacts'));assert.ok(!common.prompt.includes('privateSecret'));
});
test('on a worker failure no new task is dequeued and the already active successful sibling is saved',async()=>{
 let failure;
 try{await run(8,async args=>{if(args.phase==='character_batch'&&args.data.selected[0].id==='c0')throw new Error('Provider failure');if(args.phase==='character_batch')await new Promise(resolve=>setTimeout(resolve,10));});}catch(error){failure=error;}
 assert.ok(failure);assert.equal(failure.calls.filter(c=>c.phase==='character_batch').length,2);assert.equal(failure.calls.filter(c=>c.phase==='evidence_batch').length,0);assert.equal(failure.stages['characters:c2,c3'].validated,true);
});
test('a private canonical correction invalidates only dependent cards, preserving other rendered stages',async()=>{
 const baseline=await run(8), stages=structuredClone(baseline.stages);
 stages.canonical_plan.value.cast[0].knowledgeByRound=[];
 const fixed=await run(8,args=>{if(args.phase==='field_repair')repairOriginal(args);},stages);
 assert.deepEqual(fixed.story,baseline.story);
 assert.equal(fixed.calls.filter(c=>c.phase==='common_document').length,0);assert.equal(fixed.calls.filter(c=>c.phase==='solution').length,0);assert.equal(fixed.calls.filter(c=>c.phase==='evidence_batch').length,0);
 assert.deepEqual(fixed.calls.filter(c=>c.phase==='character_batch').map(c=>c.data.selected.map(p=>p.id)),[['c0','c1']]);
});
test('canonical repairs receive the established compact draft and exact cast and timeline',async()=>{
 const fixed=await run(4,args=>{if(args.phase==='canonical_plan')args.result.timeline[2].time='19:00';if(args.phase==='field_repair')repairOriginal(args);});
 const repair=fixed.calls.find(c=>c.phase==='field_repair');assert.ok(repair.prompt.includes('canonicalDraft'));assert.ok(repair.prompt.includes('Personaggio 1 Rossi'));assert.ok(repair.prompt.includes('20:30'));assert.ok(repair.prompt.includes('clue-1-1'));
});
test('a structural patch is accepted when it reveals an unchanged sibling semantic error',async()=>{
 const baseline=await run();
 const fixed=await run(4,args=>{if(args.phase==='character_batch'&&args.data.selected[0].id==='c0'){delete args.result.characters[0].relationships;args.result.characters[0].round2Info='Breve';}if(args.phase==='field_repair')repairOriginal(args);});
 assert.deepEqual(fixed.story,baseline.story);assert.deepEqual(fixed.calls.filter(c=>c.phase==='field_repair').map(c=>c.data.path),[['characters',0,'relationships'],['characters',0,'round2Info']]);
});
test('up to four invalid fields share a repair call; successful fields stay saved while only failed targets retry',async()=>{
 let firstRepair=true;
 const fixed=await run(4,args=>{
  if(args.phase==='common_document'){args.result.introduction='Breve';args.result.crimeSceneMapDescription='Breve';}
  if(args.phase==='field_repair'){
   if(firstRepair){assert.equal(args.data.targets.length,2);firstRepair=false;args.result.value0=args.bible.commonDocument.introduction;args.result.value1='Ancora breve';}
   else {assert.deepEqual(args.data.path,['crimeSceneMapDescription']);repairOriginal(args);}
  }
 });
 assert.equal(fixed.calls.filter(c=>c.phase==='field_repair').length,2);
 assert.ok(fixed.saves.some(s=>s.k==='common_document'&&!s.validated&&s.value.introduction===fixed.bible.commonDocument.introduction&&s.value.crimeSceneMapDescription==='Breve'));
});
test('one short public profile repairs only its description while all sibling profiles are byte identical',async()=>{
 const baseline=await run();
 const fixed=await run(4,args=>{if(args.phase==='common_document'){const entries=args.result.characterOverviews.split('\n\n');entries[1]='Personaggio 2 Rossi breve';args.result.characterOverviews=entries.join('\n\n');}if(args.phase==='field_repair')repairOriginal(args);});
 assert.deepEqual(fixed.story,baseline.story);assert.deepEqual(fixed.calls.filter(c=>c.phase==='field_repair').map(c=>c.data.path),[['publicProfiles',1,'description']]);
});
test('one missing public profile requests only that profile and preserves the supplied profiles',async()=>{
 const baseline=await run();
 const fixed=await run(4,args=>{if(args.phase==='common_document'){const entries=args.result.characterOverviews.split('\n\n');entries.splice(1,1);args.result.characterOverviews=entries.join('\n\n');}if(args.phase==='field_repair')repairOriginal(args);});
 assert.deepEqual(fixed.story,baseline.story);assert.deepEqual(fixed.calls.filter(c=>c.phase==='field_repair').map(c=>c.data.code),['missing_public_profile']);
});
test('missing appends to the same array are sequential when the first replacement is rejected',async()=>{
 let rejected=false;
 const baseline=await run();
 const fixed=await run(4,args=>{
  if(args.phase==='character_batch'&&args.data.selected[0].id==='c0')args.result.characters[0].opinionsOnOthers.splice(1);
  if(args.phase==='field_repair'){
   assert.ok(!args.data.targets,'same-array missing units must not be batched');
   if(!rejected){rejected=true;args.result.value={characterName:'Wrong identity',opinion:'Breve'};}else repairOriginal(args);
  }
 });
 assert.deepEqual(fixed.story,baseline.story);
 assert.deepEqual(fixed.calls.filter(c=>c.phase==='field_repair').map(c=>c.data.path),[['characters',0,'opinionsOnOthers',1],['characters',0,'opinionsOnOthers',1],['characters',0,'opinionsOnOthers',2]]);
 for(const saved of fixed.saves.filter(s=>s.k==='characters:c0,c1'))assert.ok(JSON.parse(JSON.stringify(saved.value)).characters.every(c=>c&&c.opinionsOnOthers.every(Boolean)));
});
test('JSON-roundtrip resume preserves accepted identities and repairs missing slots without collection regeneration',async()=>{
 const baseline=await run(), stages=JSON.parse(JSON.stringify(baseline.stages));
 stages['characters:c0,c1'].validated=false;
 stages['characters:c0,c1'].value.characters[0].opinionsOnOthers=[stages['characters:c0,c1'].value.characters[0].opinionsOnOthers[0],null];
 stages['characters:c0,c1'].value.characters=[null,stages['characters:c0,c1'].value.characters[0],stages['characters:c0,c1'].value.characters[1]];
 stages.common_document.validated=false;stages.common_document.value.publicProfiles[1]=null;
 const evidenceKey=Object.keys(stages).find(k=>k.startsWith('evidence:'));stages[evidenceKey].validated=false;stages[evidenceKey].value.evidence[1]=null;
 const fixed=await run(4,args=>{if(args.phase==='field_repair')repairOriginal(args);},stages);
 assert.deepEqual(fixed.story,baseline.story);
 assert.equal(fixed.calls.filter(c=>['canonical_plan','common_document','character_batch','evidence_batch'].includes(c.phase)).length,0);
 assert.ok(fixed.calls.filter(c=>c.phase==='field_repair').every(c=>!c.data.targets||c.data.targets.every(t=>t.path.length>1)));
});
test('array structural validation detects sparse holes as missing values',async()=>{
 const bundled=await build({entryPoints:['services/fieldRepair.ts'],bundle:true,write:false,platform:'browser',format:'esm'});
 const fields=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
 const values=Array(2);values[1]='preserved';
 const errors=fields.structure(values,fields.arraySchema(fields.stringSchema));
 assert.deepEqual(errors.map(e=>e.path),[[0]]);
});
