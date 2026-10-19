import test from 'node:test';
import assert from 'node:assert/strict';
import {createGenerationRuntime, GenerationPausedError} from '../services/generationRuntime.ts';
import { build } from 'esbuild';
const {outputFiles} = await build({entryPoints:['services/generationStorage.ts'],bundle:true,write:false,platform:'browser',format:'esm'});
const {loadGeneration,saveGeneration,validateCheckpoint}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const schema={type:'object',properties:{ok:{type:'boolean'}},required:['ok']};
const reply=(status=200,extra={},headers={})=>new Response(JSON.stringify(status===200?{content:'{"ok":true}',...extra}:extra),{status,headers});
test('checkpoints preserve invalid drafts with immutable callback and stage snapshots',()=>{
 const seen=[];const runtime=createGenerationRuntime(8,'tema',{onCheckpoint: cp=>seen.push(cp)});
 const value={draft:['unfinished']};runtime.saveStage('plan',value,false);value.draft.push('changed');
 const stage=runtime.getStage('plan');stage.value.draft.push('changed');
 assert.deepEqual(runtime.getStage('plan').value,{draft:['unfinished']});
 assert.equal(seen[0].stages.plan,undefined);assert.equal(seen.at(-1).stages.plan.validated,false);
 const restored=loadGeneration({getItem:()=>JSON.stringify(runtime.checkpoint)});assert.deepEqual(restored.checkpoint.stages.plan.value,{draft:['unfinished']});
 assert.equal(validateCheckpoint({...runtime.checkpoint,pipelineVersion:'obsolete'}),false);
 assert.equal(loadGeneration({getItem:()=>'{bad'}).checkpoint,undefined);
 assert.match(saveGeneration(runtime.checkpoint,{setItem(){throw Error('quota')}}),/Salvataggio/);
});
test('all requests share maximum concurrency two; metadata and strict payload survive',async()=>{
 const previous=global.fetch;let active=0,max=0;const releases=[];const bodies=[];
 global.fetch=async (_url,options)=>{bodies.push(JSON.parse(options.body));active++;max=Math.max(max,active);await new Promise(resolve=>releases.push(resolve));active--;return reply(200,{metadata:{promptTokens:12,requestId:'r'}})};
 try{const runtime=createGenerationRuntime(8,'tema');const pending=Array.from({length:4},()=>runtime.requestJson('p','canonical_plan',schema));
 await new Promise(r=>setTimeout(r,5));assert.equal(releases.length,2);releases.splice(0).forEach(r=>r());
 await new Promise(r=>setTimeout(r,5));releases.splice(0).forEach(r=>r());await Promise.all(pending);
 assert.equal(max,2);assert.equal(runtime.checkpoint.metrics.length,4);assert.equal(runtime.checkpoint.metrics[0].promptTokens,12);
 assert.equal(bodies[0].response_format.json_schema.schema.additionalProperties,false);assert.equal(bodies[0].phase,'canonical_plan');assert.equal(bodies[0].model,'openai/gpt-oss-120b');
 }finally{global.fetch=previous}
});
test('long 429 pauses queue and resumes same checkpoint explicitly without losing successes',async()=>{
 const previous=global.fetch;let calls=0;
 global.fetch=async()=>{calls++;return reply(429,{}, {'Retry-After':'180'})};
 try{const runtime=createGenerationRuntime(8,'tema');runtime.saveStage('done',{ok:true},true);
 const outcomes=await Promise.allSettled(Array.from({length:4},()=>runtime.requestJson('p','character_batch',schema)));
 assert.equal(calls,2);assert.ok(outcomes.every(r=>r.status==='rejected' && r.reason instanceof GenerationPausedError));assert.equal(runtime.checkpoint.concurrency,1);assert.equal(runtime.checkpoint.status,'paused');assert.equal(runtime.checkpoint.metrics[0].totalTokens,undefined);
 global.fetch=async()=>reply();const cp=runtime.checkpoint;cp.retryAt=Date.now()-1;const resumed=createGenerationRuntime(8,'tema',{checkpoint:cp});assert.deepEqual(await resumed.requestJson('p','character_batch',schema),{ok:true});assert.ok(resumed.getStage('done').validated);
 }finally{global.fetch=previous}
});
test('abort interrupts cooldown and queued calls without extra requests',async()=>{
 const previous=global.fetch;let calls=0;const controller=new AbortController();
 global.fetch=async()=>{calls++;return reply(429,{}, {'Retry-After':'30'})};
 try{const runtime=createGenerationRuntime(8,'tema',{signal:controller.signal});const pending=Promise.allSettled(Array.from({length:3},()=>runtime.requestJson('p','character_batch',schema)));
 await new Promise(r=>setTimeout(r,10));controller.abort();const outcomes=await pending;assert.equal(calls,2);assert.ok(outcomes.every(r=>r.status==='rejected'&&r.reason.name==='AbortError'));
 }finally{global.fetch=previous}
});
test('short 429 gives queued requests one shared cooldown and serial concurrency',async()=>{
 const previous=global.fetch;let calls=0,active=0,maxAfter=0;let retryAt=0;
 global.fetch=async()=>{calls++;if(calls<=2)return reply(429,{}, {'Retry-After':'1'});assert.ok(Date.now()>=retryAt-10);active++;maxAfter=Math.max(maxAfter,active);await new Promise(r=>setTimeout(r,5));active--;return reply()};
 try{const runtime=createGenerationRuntime(8,'tema',{onCheckpoint(cp){if(cp.retryAt)retryAt=Math.max(retryAt,cp.retryAt)}});await Promise.all(Array.from({length:4},()=>runtime.requestJson('p','character_batch',schema)));assert.equal(calls,6);assert.equal(maxAfter,1);assert.equal(runtime.checkpoint.concurrency,1)}finally{global.fetch=previous}
});
test('transient 502 retries at most three attempts and records failures',async()=>{
 const previous=global.fetch;let calls=0;global.fetch=async()=>{calls++;return reply(502,{retryable:true})};
 try{const runtime=createGenerationRuntime(8,'tema');await assert.rejects(runtime.requestJson('p','solution',schema));assert.equal(calls,3);assert.equal(runtime.checkpoint.metrics.length,3);assert.ok(runtime.checkpoint.metrics.every(m=>m.status===502))}finally{global.fetch=previous}
});
test('concurrent failure does not erase successful stage; partial metadata stays unknown',async()=>{
 const previous=global.fetch;let calls=0;global.fetch=async()=>++calls===1?reply(500,{error:'temporaneo'}):reply(200,{metadata:{completionTokens:7}});
 try{const runtime=createGenerationRuntime(8,'tema');const outcomes=await Promise.allSettled([runtime.requestJson('p','common_document',schema),runtime.requestJson('p','solution',schema).then(result=>runtime.saveStage('solution',result,true))]);assert.equal(outcomes[0].status,'rejected');assert.deepEqual(runtime.getStage('solution').value,{ok:true});const metric=runtime.checkpoint.metrics.find(m=>m.status===200);assert.equal(metric.completionTokens,7);assert.equal(metric.promptTokens,undefined);assert.equal(metric.totalTokens,undefined)}finally{global.fetch=previous}
});
test('HTTP date retry header pauses using absolute timestamp and keeps concurrent successful work',async()=>{
 const previous=global.fetch;let calls=0;const target=new Date(Date.now()+180000).toUTCString();global.fetch=async()=>++calls===1?reply(429,{}, {'Retry-After':target}):reply();
 try{const runtime=createGenerationRuntime(8,'tema');await Promise.allSettled([runtime.requestJson('p','character_batch',schema),runtime.requestJson('p','solution',schema).then(result=>runtime.saveStage('solution',result,true))]);assert.equal(runtime.checkpoint.retryAt,Date.parse(target));assert.deepEqual(runtime.getStage('solution').value,{ok:true});assert.equal(runtime.checkpoint.status,'paused')}finally{global.fetch=previous}
});
test('unsafe complete saves and malicious envelope are rejected before UI restoration',()=>{
 const runtime=createGenerationRuntime(4,'tema');const cp=runtime.checkpoint;
 for(const mutation of [{input:{playerCount:100,theme:'tema'}},{input:{playerCount:4,theme:' '}},{stages:{draft:{validated:'yes',value:[]}}},{status:'complete',finalStory:{title:'Caso',characters:[{},{},{},{}],commonDocument:{},solution:{},evidence:[]}}]) assert.equal(validateCheckpoint({...cp,...mutation}),false);
 const raw=JSON.stringify({...cp,status:'complete',finalStory:{title:'Caso',characters:[{},{},{},{}],commonDocument:{},solution:{},evidence:[]}});assert.equal(loadGeneration({getItem:()=>raw}).checkpoint,undefined);
});
test('non-quota pause stops queued requests while preserving active worker result',async()=>{
 const previous=global.fetch;const releases=[];let calls=0;
 global.fetch=async()=>{calls++;await new Promise(resolve=>releases.push(resolve));return reply()};
 try{const runtime=createGenerationRuntime(8,'tema');const pending=Promise.allSettled(Array.from({length:3},()=>runtime.requestJson('p','character_batch',schema)));await new Promise(r=>setTimeout(r,5));runtime.pause(Error('bad stage'));releases.splice(0).forEach(r=>r());const outcomes=await pending;assert.equal(calls,2);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,2);assert.equal(outcomes.filter(r=>r.status==='rejected').length,1)}finally{global.fetch=previous}
});
