import { activityData, activityId } from './activity.js';

export async function grantPlan(db:any, actorUid:string, requestId:string, input:any, source:string) {
 const action='Quản trị: cấp gói';
 const id=activityId(actorUid,requestId,action),orderCode='ADMIN_'+id.slice(0,24);
 const eventRef=db.collection('activity_events').doc(id),paymentRef=db.collection('payosPayments').doc(orderCode),userRef=db.collection('users').doc(input.targetUid);
 return db.runTransaction(async(tx:any)=>{
  const previous=await tx.get(paymentRef);
  if(previous.exists){if(previous.data().uid!==input.targetUid||previous.data().plan!==input.plan)throw Error('Mã yêu cầu đã dùng cho thao tác khác');return {orderCode,planExpiresAt:previous.data().planExpiresAt};}
  const user=await tx.get(userRef);if(!user.exists)throw Error('Không tìm thấy người dùng');
  const now=Date.now(),days=Number(input.durationDays)||(input.plan==='trial'?7:30);
  if(!Number.isFinite(days)||days<=0||days>3650)throw Error('Số ngày không hợp lệ');
  const planExpiresAt=input.plan==='free'?null:now+days*86400000;
  tx.update(userRef,{planType:input.plan,pricingPlan:input.plan,planExpiresAt,status:'approved',updatedAt:new Date(now).toISOString()});
  tx.set(paymentRef,{uid:input.targetUid,amount:0,plan:input.plan,activatedAt:now,method:'admin_grant',grantedBy:actorUid,note:typeof input.note==='string'?input.note.slice(0,1000):'Cấp bởi Quản trị viên',planExpiresAt});
  tx.set(eventRef,activityData({actorUid,actorType:'user',action,source,status:'success',targetUid:input.targetUid,referenceId:orderCode},new Date(now)));
  return {orderCode,planExpiresAt};
 });
}
