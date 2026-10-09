import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateActivity, vietnamDate, classifySource } from '../shared/activity';
import { writeActivity, withActivity, requestSource } from '../server/activity';
import { grantPlan } from '../server/admin-plan';

test('Vietnam calendar and environment separation, no invented duration or duplicate events', () => {
  assert.equal(vietnamDate(new Date('2026-10-08T17:01:00Z')), '2026-10-09');
  assert.equal(classifySource({headers:{host:'localhost:3000'}}), 'localhost');
  assert.equal(classifySource({headers:{host:'[::1]:3000'}}), 'localhost');
  assert.equal(classifySource({headers:{host:'[2001:db8::1]:3000'}}), 'web');
  assert.equal(classifySource({headers:{host:'word2latex.com','x-activity-source':'localhost'}}), 'web');
  assert.equal(classifySource({headers:{host:'word2latex.com','x-activity-source':'test'}}), 'test');
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
