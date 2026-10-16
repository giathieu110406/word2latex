import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateActivity, aggregateDashboardUsage, classifyFeatureBucket, vietnamDate, classifySource } from '../shared/activity';
import { writeActivity, withActivity, requestSource } from '../server/activity';
import { grantPlan } from '../server/admin-plan';

test('Vietnam calendar and strict word2latex.io.vn web source separation', () => {
  assert.equal(vietnamDate(new Date('2026-10-08T17:01:00Z')), '2026-10-09');
  assert.equal(classifySource({headers:{host:'localhost:3000'}}), 'localhost');
  assert.equal(classifySource({headers:{host:'[::1]:3000'}}), 'localhost');
  assert.equal(classifySource({headers:{host:'[2001:db8::1]:3000'}}), 'localhost');
  assert.equal(classifySource({headers:{host:'word2latex-preview.vercel.app'}}), 'localhost');
  assert.equal(classifySource({headers:{host:'word2latex.io.vn'}}), 'web');
  assert.equal(classifySource({headers:{host:'www.word2latex.io.vn:443'}}), 'web');
  assert.equal(classifySource({headers:{host:'internal.vercel.app','x-forwarded-host':'word2latex.io.vn'}}), 'web');
  assert.equal(classifySource({headers:{host:'word2latex.io.vn','x-activity-source':'localhost'}}), 'web');
  assert.equal(classifySource({headers:{host:'word2latex.io.vn','x-activity-source':'test'}}), 'test');
  const events = [
    {id:'a',date:'2026-10-09',hour:'00',actorUid:'alice',action:'AI Vẽ hình',source:'web',status:'success',durationMs:1200},
    {id:'b',date:'2026-10-09',hour:'01',actorUid:'bob',action:'AI Vẽ hình',source:'test',status:'error',durationMs:2200},
    {id:'c',date:'2026-10-09',hour:'02',actorUid:'bob',action:'Xem bảng vẽ',source:'localhost',status:'observed',durationMs:null},
  ];
  const web = aggregateActivity([...events,events[0]], {source:'web'});
  assert.equal(web[0].requests,1);
  assert.equal(web[0].totalDurationMinutes, .02);
  const all = aggregateActivity(events, {source:'all'});
  assert.equal(all[0].requests,1);
  assert.equal(all[0].errors,1);
  assert.equal(all[0].observations,1);
  assert.equal(aggregateActivity(events, {source:'all',uid:'bob'})[0].requests,0);
});

test('dashboard 5-feature quota aggregation filters web-only and groups per-user daily history', () => {
  assert.equal(classifyFeatureBucket({action:'Chuyển đổi LaTeX',status:'observed'}), 'convert');
  assert.equal(classifyFeatureBucket({action:'Áp dụng tinh chỉnh AI',status:'observed'}), 'ai');
  assert.equal(classifyFeatureBucket({action:'Áp dụng đề thi',status:'observed'}), 'exam');
  assert.equal(classifyFeatureBucket({action:'Soạn đề thi (AI)',status:'success'}), 'exam');
  assert.equal(classifyFeatureBucket({action:'AI Vẽ hình',status:'success'}), 'drawing');
  assert.equal(classifyFeatureBucket({action:'MarkItDown AI',status:'success'}), 'markitdown');
  assert.equal(classifyFeatureBucket({action:'Xem tính năng: Tổng quan',status:'observed'}), null);
  assert.equal(classifyFeatureBucket({action:'AI Vẽ hình',status:'error'}), null);

  const events = [
    {id:'1',date:'2026-10-15',occurredAt:'2026-10-15T08:00:00Z',actorUid:'u1',actorName:'Alice',actorEmail:'alice@example.com',action:'Chuyển đổi LaTeX',source:'web',status:'observed'},
    {id:'2',date:'2026-10-15',occurredAt:'2026-10-15T09:00:00Z',actorUid:'u1',actorName:'Alice',actorEmail:'alice@example.com',action:'AI Canvas',source:'web',status:'success'},
    {id:'3',date:'2026-10-15',occurredAt:'2026-10-15T09:00:02Z',actorUid:'u1',actorName:'Alice',actorEmail:'alice@example.com',action:'Áp dụng tinh chỉnh AI',source:'web',status:'observed'},
    {id:'4',date:'2026-10-15',occurredAt:'2026-10-15T10:00:00Z',actorUid:'u2',actorName:'Bob',actorEmail:'bob@example.com',action:'AI Vẽ hình',source:'web',status:'success'},
    {id:'5',date:'2026-10-15',occurredAt:'2026-10-15T10:05:00Z',actorUid:'u2',actorName:'Bob',actorEmail:'bob@example.com',action:'MarkItDown AI',source:'web',status:'success'},
    {id:'6',date:'2026-10-15',occurredAt:'2026-10-15T10:10:00Z',actorUid:'u2',actorName:'Bob',actorEmail:'bob@example.com',action:'Áp dụng đề thi',source:'web',status:'observed'},
    {id:'7',date:'2026-10-15',occurredAt:'2026-10-15T11:00:00Z',actorUid:'u1',actorName:'Alice',actorEmail:'alice@example.com',action:'Chuyển đổi LaTeX',source:'localhost',status:'observed'},
  ];

  const summary = aggregateDashboardUsage(events, {from:'2026-10-10',to:'2026-10-16',feature:'all'});
  assert.equal(summary.days.length, 7);
  assert.deepEqual(summary.totals, {all:5, convert:1, ai:1, exam:1, drawing:1, markitdown:1});
  const oct15Users = summary.usersByDate['2026-10-15'];
  assert.equal(oct15Users.length, 2);
  assert.equal(oct15Users[0].uid, 'u2');
  assert.equal(oct15Users[0].total, 3);
  assert.equal(oct15Users[1].uid, 'u1');
  assert.equal(oct15Users[1].total, 2);
  assert.equal(oct15Users[1].convert, 1);
  assert.equal(oct15Users[1].ai, 1);
  assert.equal(oct15Users[1].events.length, 2);

  const drawingOnly = aggregateDashboardUsage(events, {from:'2026-10-10',to:'2026-10-16',feature:'drawing'});
  assert.equal(drawingOnly.usersByDate['2026-10-15'].length, 1);
  assert.equal(drawingOnly.usersByDate['2026-10-15'][0].uid, 'u2');
  assert.equal(drawingOnly.usersByDate['2026-10-15'][0].filteredTotal, 1);
  assert.equal(drawingOnly.usersByDate['2026-10-15'][0].events.length, 1);
});

test('admin grant, payment history and actor audit are one transaction and replay does not extend plan',async()=>{
 const records=new Map<string,any>([['users/target',{planType:'free'}]]);
 const db:any={collection:(name:string)=>({doc:(id:string)=>({key:name+'/'+id})}),runTransaction:async(fn:any)=>fn({get:async(ref:any)=>({exists:records.has(ref.key),data:()=>records.get(ref.key)}),set:(ref:any,value:any)=>records.set(ref.key,value),update:(ref:any,value:any)=>records.set(ref.key,{...records.get(ref.key),...value})})};
 const first=await grantPlan(db,'verified-admin','test-grant-request',{targetUid:'target',plan:'pro'},'test');
 assert.deepEqual(await grantPlan(db,'verified-admin','test-grant-request',{targetUid:'target',plan:'pro'},'test'),first);
 assert.equal([...records.keys()].filter(k=>k.startsWith('activity_events/')).length,1);
 const event=[...records.entries()].find(([k])=>k.startsWith('activity_events/'))![1];
 assert.equal(event.actorUid,'verified-admin');assert.equal(event.targetUid,'target');assert.equal(event.source,'test');assert.equal(event.durationMs,null);
 await assert.rejects(grantPlan(db,'verified-admin','test-grant-request',{targetUid:'another',plan:'pro'},'test'));
});

test('server recorder rejects anonymous actors and duplicates without rerunning work, records failures honestly', async()=>{
 const records=new Map<string,any>();let terminalFail=false,calls=0;
 const db:any={collection:(name:string)=>({doc:(id:string)=>({key:name+'/'+id})}),runTransaction:async(fn:any)=>fn({get:async(ref:any)=>({exists:records.has(ref.key),data:()=>records.get(ref.key)}),set:(ref:any,value:any)=>{if(terminalFail&&value.status!=='started')throw Error('offline');records.set(ref.key,value);}})};
 const wrapper=withActivity(async(req:any,res:any)=>{calls++;return req.body.fail?res.status(400).json({error:'bad input'}):res.json({success:true});},()=> 'Test operation',{
  getDatabase:()=>db,authenticate:async(req:any)=>req.headers.authorization?{authorized:true,status:200,user:{uid:'verified-user',email:'',isOwner:false,status:'approved',role:'admin'}}:{authorized:false,status:401},
 });
 const invoke=async(id:string,body:any={},auth=true)=>{const res:any={statusCode:200,headers:{},setHeader(k:string,v:any){this.headers[k]=v;},status(n:number){this.statusCode=n;return this;},json(v:any){this.body=v;return this;}};await wrapper({method:'POST',headers:{host:'localhost:3000','x-activity-id':id,'x-activity-source':'test',...(auth?{authorization:'verified'}:{})},body:{actorUid:'spoofed',...body}},res);return res;};
 assert.equal((await invoke('anon-request',{},false)).statusCode,401);assert.equal(calls,0);
 assert.equal((await invoke('success-request')).statusCode,200);assert.equal((await invoke('success-request')).statusCode,409);assert.equal(calls,1);
 assert.equal((await invoke('error-request',{fail:true})).statusCode,400);
 assert.deepEqual([...records.values()].map(e=>[e.actorUid,e.status]),[['verified-user','success'],['verified-user','error']]);
 terminalFail=true;const result=await invoke('offline-request');assert.equal(result.headers['X-Activity-Recorded'],'false');assert.equal([...records.values()].at(-1).status,'started');
 assert.equal(requestSource({headers:{host:'localhost:3000','x-activity-source':'test'}},{role:'user'}),'localhost');
});

test('immutable terminal event is deduplicated by verified actor and request ID', async () => {
  const records = new Map<string,any>();
  const db:any = {collection:(name:string)=>({doc:(id:string)=>({key:name+'/'+id})}),runTransaction:async(fn:any)=>fn({
    get:async(ref:any)=>({exists:records.has(ref.key),data:()=>records.get(ref.key)}),
    set:(ref:any,value:any)=>records.set(ref.key,value),
  })};
  const event:any = {requestId:'one-request',actorUid:'alice',actorType:'user',action:'AI Vẽ hình',source:'test',status:'success',startedAtMs:Date.now()-1200,httpStatus:200};
  await writeActivity(db,event);
  await writeActivity(db,{...event,status:'error'});
  await writeActivity(db,{...event,actorUid:'bob'});
  assert.equal(records.size,2);
  assert.equal([...records.values()].filter(e=>e.status==='success').length,2);
  assert.ok([...records.values()].every(e=>e.occurredAt && e.date && !e.email));
});
