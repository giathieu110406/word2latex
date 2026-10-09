import { requireAdmin, requireUser } from '../server/admin-request.js';
import { requestSource, writeActivity } from '../server/activity.js';
import { vietnamDate } from '../shared/activity.js';

const observations = new Set(['Xem tính năng','Chuyển đổi LaTeX','Áp dụng đề thi','Áp dụng tinh chỉnh AI','Vẽ hình: chỉnh sửa','Vẽ hình: áp dụng AI','Vẽ hình: hủy đề xuất','Kiểm thử analytics',
 ...['Tổng quan','Vẽ hình','Chuyển đổi LaTeX','Soạn đề thi (AI)','MarkItDown AI','Phân tích','Quản trị thành viên','Lịch sử thanh toán'].map(name=>'Xem tính năng: '+name)]);
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export default async function handler(req:any,res:any) {
  res.setHeader('Cache-Control','no-store');
  try {
    if (req.method === 'POST') {
      // Observations also cover manual tools before phone/AI entitlement verification.
      const context=await requireUser(req,res);if(!context)return;
      const {db,decodedToken,profile}=context;
      const user={uid:decodedToken.uid,role:profile.role,isOwner:decodedToken.email?.toLowerCase()==='giathieu110406@gmail.com'};
      if(user.role!=='admin' && (await db.collection('admins').doc(user.uid).get()).exists) user.role='admin';
      const {action,eventId} = req.body || {};
      if(action==='Kiểm thử analytics' && user.role!=='admin' && !user.isOwner) return res.status(403).json({error:'Chỉ quản trị viên kiểm tra ghi nhận hệ thống'});
      if (!observations.has(action) || typeof eventId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(eventId)) return res.status(400).json({error:'Sự kiện không hợp lệ'});
      // User reports are observations, never proof that a sensitive operation succeeded.
      const recorded = await writeActivity(db,{requestId:eventId,actorUid:user.uid,actorType:'user',
        action,source:requestSource(req,user),status:action === 'Vẽ hình: hủy đề xuất' ? 'cancelled' : 'observed',startedAtMs:Date.now()});
      return res.json({success:true,...recorded});
    }
    if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
    const context = await requireAdmin(req,res);
    if (!context) return;
    const today = vietnamDate();
    const from = String(req.query.from || vietnamDate(new Date(Date.now()-6*86400000)));
    const to = String(req.query.to || today);
    if (!validDate(from) || !validDate(to) || from > to || Date.parse(to)-Date.parse(from)>30*86400000) return res.status(400).json({error:'Khoảng ngày không hợp lệ (tối đa 31 ngày)'});
    const [snapshot, first, users, payments, legacy] = await Promise.all([
      context.db.collection('activity_events').where('date','>=',from).where('date','<=',to).orderBy('date').limit(5001).get(),
      context.db.collection('activity_events').orderBy('occurredAt').limit(1).get(),
      context.db.collection('users').get(),context.db.collection('payosPayments').get(),context.db.collection('api_usage_stats').get(),
    ]);
    const profiles = new Map(users.docs.map(doc=>[doc.id,doc.data()]));
    const events = snapshot.docs.slice(0,5000).map(doc=>{
      const event:any = {id:doc.id,...doc.data()};
      const profile = profiles.get(event.actorUid);
      return {...event,actorName:event.actorType === 'system' ? 'Hệ thống / PayOS' : profile?.displayName || profile?.email || event.actorUid,
        actorEmail:event.actorType === 'system' ? '' : profile?.email || ''};
    });
    return res.json({success:true,events,truncated:snapshot.size>5000,from,to,
      canonicalSince:first.docs[0]?.data().occurredAt || null,
      legacyDates:legacy.docs.map(doc=>doc.data().date || doc.id).sort(),
      usage:users.docs.map(doc=>{const p=doc.data();return{uid:doc.id,resetDay:p.lastLatexResetDate || '',latexCount:Number(p.latexCount)||0,examCount:Number(p.examCount)||0,promptCount:Number(p.promptCount)||0,markItDownCount:Number(p.markItDownCount)||0,queryCount:Number(p.queryCount)||0};}),
      payments:payments.docs.filter(doc=>{const at=doc.data().activatedAt;if(!Number.isFinite(at))return false;const day=vietnamDate(new Date(at));return day>=from&&day<=to;}).map(doc=>({id:doc.id,uid:doc.data().uid,amount:doc.data().amount,plan:doc.data().plan,activatedAt:doc.data().activatedAt})),
    });
  } catch { return res.status(503).json({error:'Không đọc/ghi được Firebase. Không thay bằng số liệu giả hoặc file local.'}); }
}
