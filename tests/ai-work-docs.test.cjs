const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript'), vm = require('node:vm');
function load(file, requireFn, extra={}) { const ctx={exports:{},require:requireFn,...extra}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx); return ctx.exports; }
const patches=load('shared/ai-work.ts',()=>{});
let revision='r1', text='Hello', posts=0, failPost=false, lostPost=false, canEdit=true, lastBody;
const fetchMock=async (url,options)=> {
 if(url.includes(':batchUpdate')) {posts++;lastBody=JSON.parse(options.body); if(lostPost)throw new TypeError('network'); if(failPost)return {ok:false,status:500,json:async()=>({})};text='Hi';revision='r2';return {ok:true,json:async()=>({writeControl:{requiredRevisionId:'r2'}})};}
 if(url.includes('drive/v3'))return {ok:true,json:async()=>({capabilities:{canEdit}})};
 return {ok:true,json:async()=>({documentId:'doc',title:'Title',revisionId:revision,body:{content:[{startIndex:1,paragraph:{elements:[{startIndex:1,textRun:{content:text+'\n'}}]}}]}})};
};
const api=load('src/lib/ai-work-docs.ts',name=>name.includes('shared/ai-work')?patches:{readDriveSession:()=> 'test',clearDriveSession:()=>{}},{fetch:fetchMock,TypeError});
(async()=>{
 const snap=await api.readWorkDocument('doc','user'); const edits=[{blockId:'body:1',after:'Hi'}];
 revision='other';await assert.rejects(()=>api.applyWorkEdits(snap,edits,'user'),e=>e instanceof api.WorkConflict);assert.equal(posts,0);
 revision='r1';canEdit=false;await assert.rejects(()=>api.applyWorkEdits(snap,edits,'user'));assert.equal(posts,0);canEdit=true;
 failPost=true;await assert.rejects(()=>api.applyWorkEdits(snap,edits,'user'),e=>e instanceof api.WorkUncertain);assert.equal(posts,1);failPost=false;
 lostPost=true;await assert.rejects(()=>api.applyWorkEdits(snap,edits,'user'),e=>e instanceof api.WorkUncertain);assert.equal(posts,2);lostPost=false;
 const result=await api.applyWorkEdits(snap,edits,'user');assert.equal(result.after.revisionId,'r2');assert.equal(lastBody.writeControl.requiredRevisionId,'r1');assert.equal(result.inverse[0].after,'Hello');assert.equal(posts,3);
 revision='r3';await assert.rejects(()=>api.applyWorkEdits(result.undo,result.inverse,'user'),e=>e instanceof api.WorkConflict);assert.equal(posts,3);
 console.log('Docs stale revision, permissions, uncertain writes, locked batch and guarded undo OK');
})().catch(error=>{console.error(error);process.exit(1)});


