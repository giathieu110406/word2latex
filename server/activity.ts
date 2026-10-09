import { createHash, randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from './firebase-admin.js';
import { verifyAuthAndApproval } from './auth-guard.js';
import { classifySource, vietnamDate, vietnamHour } from '../shared/activity.js';

export function activityId(actorUid: string | null, requestId: string, action: string) {
  return createHash('sha256').update(JSON.stringify([actorUid,requestId,action])).digest('hex');
}
export function activityData(input:any, now=new Date()) {
 return {
  actorUid:input.actorUid,actorType:input.actorType,action:input.action,source:input.source,
  status:input.status,date:vietnamDate(now),hour:vietnamHour(now),occurredAt:now.toISOString(),
  recordedAt:FieldValue.serverTimestamp(),
  ...(Number.isFinite(input.startedAtMs)?{startedAt:new Date(input.startedAtMs).toISOString()}:{}),
  durationMs:['observed','cancelled','started'].includes(input.status)||!Number.isFinite(input.startedAtMs)?null:Math.max(0,now.getTime()-input.startedAtMs),
  httpStatus:input.httpStatus ?? null,
  ...(input.targetUid?{targetUid:input.targetUid}:{}),...(input.referenceId?{referenceId:input.referenceId}:{}),
 };
}
export async function writeActivity(db: any, input: any) {
  const now = new Date();
  const id = activityId(input.actorUid, input.requestId, input.action);
  const ref = db.collection('activity_events').doc(id);
  return db.runTransaction(async (tx: any) => {
    const existing = await tx.get(ref);
    if (existing.exists && existing.data().status !== 'started') return {id, duplicate:true};
    if (existing.exists && input.status === 'started') return {id, duplicate:true};
    const data = activityData(input,now);
    tx.set(ref,data);
    return {id,duplicate:false};
  });
}

export function requestSource(req: any, user: any) {
  // Only administrators/CI can label a request as test; a client cannot promote localhost to production.
  const source = classifySource({...req,headers:{...req.headers,'x-activity-source':user?.role === 'admin' || user?.isOwner ? req.headers?.['x-activity-source'] : undefined}});
  if (process.env.ACTIVITY_SOURCE === 'test') return 'test';
  return process.env.VERCEL_ENV && source !== 'test' ? 'web' : source;
}
export const AI_ACTIONS: Record<string,string> = {
  'parse-exam':'Soạn đề thi (AI)','smart-paste-parse':'Dán AI','fix-logic':'Chuyển đổi LaTeX',
  'gemini-canvas':'AI Canvas','shuffle-ai':'AI thay thế số liệu','chat-ai':'AI hỏi đáp',
  markitdown:'MarkItDown AI','extract-text':'Trích xuất văn bản',reconstruct:'AI Vẽ hình',
};

export function withActivity(handler: any, actionForRequest: (req:any)=>string | undefined,
  {authenticate = verifyAuthAndApproval, getDatabase = ()=>getFirebaseAdmin().db} = {}) {
  return async (req: any,res: any) => {
    const action = req.method === 'POST' ? actionForRequest(req) : undefined;
    if (!action) return handler(req,res);
    const auth = await authenticate(req);
    if (!auth.authorized) return res.status(auth.status).json({error:auth.error});
    req.verifiedActivityAuth = auth;
    const requestHeader = req.headers?.['x-activity-id'];
    const requestId = typeof requestHeader === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(requestHeader) ? requestHeader : randomUUID();
    const input = {requestId,actorUid:auth.user!.uid,actorType:'user',action,source:requestSource(req,auth.user),status:'started',startedAtMs:Date.now()};
    let db: any;
    try {
      db = getDatabase();
      const started = await writeActivity(db,input);
      if (started.duplicate) return res.status(409).json({error:'Yêu cầu đã được ghi nhận. Không tự thực hiện lại cùng mã yêu cầu.',activityId:started.id});
      res.setHeader('X-Activity-Id',started.id);
    } catch {
      return res.status(503).json({error:'Chưa thể ghi nhận hoạt động vào Firebase. Vui lòng thử lại sau.'});
    }
    const json = res.json.bind(res);
    res.json = async (body: any) => {
      const status = res.statusCode >= 400 || body?.success === false || body?.error ? 'error' : 'success';
      try {
        await writeActivity(db,{...input,status,httpStatus:res.statusCode || 200});
        res.setHeader('X-Activity-Recorded','true');
      } catch {
        // Business work has already completed. Do not retry it or invent a successful audit write.
        res.setHeader('X-Activity-Recorded','false');
        console.warn('[Activity] Terminal write failed; started event remains unresolved');
      }
      return json(body);
    };
    try { return await handler(req,res); }
    catch { return res.status(500).json({error:'Tác vụ không hoàn tất'}); }
  };
}
