import React, {useCallback,useEffect,useMemo,useState,useRef} from 'react';
import {authFetch} from '../utils/api-client';
import {aggregateActivity,vietnamDate} from '../../shared/activity';
export interface AdminAnalyticsDashboardProps {allUsers?:any[]}
export interface DayUsageStats {id:string;date?:string;requests?:number;totalDurationMinutes?:number;hourly?:Record<string,any>;featureDurations?:Record<string,number>;[key:string]:any}
const time=(value:string)=>value?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'medium'}).format(new Date(value)):'Chưa ghi nhận';
const sources:Record<string,string>={web:'Website',localhost:'Localhost',test:'Kiểm thử'};
const statuses:Record<string,string>={started:'Chưa nhận kết quả',success:'Server xác nhận thành công',error:'Lỗi',observed:'Client báo thao tác',cancelled:'Client báo hủy'};
export const AdminAnalyticsDashboard:React.FC<AdminAnalyticsDashboardProps>=()=>{
 const [from,setFrom]=useState(vietnamDate(new Date(Date.now()-6*86400000))),[to,setTo]=useState(vietnamDate());
 const [source,setSource]=useState('web'),[uid,setUid]=useState(''),[status,setStatus]=useState('all'),[date,setDate]=useState(vietnamDate());
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[updated,setUpdated]=useState('');
 const readVersion=useRef(0);
 const refresh=useCallback(async()=>{const version=++readVersion.current;setLoading(true);try{const res=await authFetch(`/api/activity?from=${from}&to=${to}`);const body=await res.json();if(version!==readVersion.current)return;if(!res.ok)throw Error(body.error);setData(body);setError('');setUpdated(new Date().toISOString());}catch(e:any){if(version===readVersion.current)setError(e.message);}finally{if(version===readVersion.current)setLoading(false);}},[from,to]);
 useEffect(()=>{setData(null);void refresh();const interval=setInterval(()=>void refresh(),30000);return()=>{++readVersion.current;clearInterval(interval);};},[refresh]);
 useEffect(()=>{if(date<from||date>to)setDate(to);},[from,to,date]);
 const events=useMemo(()=>(data?.events||[]).filter((e:any)=>(source==='all'||e.source===source)&&(!uid||e.actorUid===uid)&&(status==='all'||e.status===status)),[data,source,uid,status]);
 const stats=useMemo(()=>aggregateActivity(events,{source:'all'}),[events]);
 const day=stats.find(s=>s.date===date);
 const rows=events.filter((e:any)=>e.date===date).sort((a:any,b:any)=>b.occurredAt.localeCompare(a.occurredAt));
 const members=[...new Map((data?.events||[]).filter((e:any)=>e.actorUid).map((e:any)=>[e.actorUid,e])).values()] as any[];
 const days:string[]=[];for(let ms=Date.parse(from+'T00:00:00Z');ms<=Date.parse(to+'T00:00:00Z')&&days.length<32;ms+=86400000)days.push(new Date(ms).toISOString().slice(0,10));
 const exportLog=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({from,to,source,uid,status,events,truncated:data?.truncated},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`activity-${from}-${to}.json`;a.click();URL.revokeObjectURL(url);};
 const [checkNotice,setCheckNotice]=useState('');
 const checkRecording=async()=>{
  setLoading(true);setCheckNotice('');
  try {const eventId=crypto.randomUUID(),options={method:'POST',headers:{'Content-Type':'application/json','X-Activity-Source':'test'},body:JSON.stringify({action:'Kiểm thử analytics',eventId})};
   const first=await authFetch('/api/activity',options),firstBody=await first.json();if(!first.ok)throw Error(firstBody.error);
   const retry=await authFetch('/api/activity',options),retryBody=await retry.json();if(!retry.ok||!retryBody.duplicate||retryBody.id!==firstBody.id)throw Error('Chưa xác nhận chống ghi trùng');
   setCheckNotice('Đã ghi 1 hoạt động nguồn Kiểm thử và xác nhận gửi lại không tạo bản trùng.');setSource('test');setStatus('all');setUid('');setDate(vietnamDate());await refresh();
  }catch(e:any){setError(e.message);}finally{setLoading(false);}
 };
 const control='block rounded-xl border p-2 text-sm bg-white max-w-[240px]';
 return <section data-testid="analytics-dashboard" className="bg-white/80 border border-slate-200 rounded-3xl p-4 sm:p-6 space-y-5 min-w-0">
  <div className="flex flex-wrap justify-between items-center gap-3"><div><h2 className="font-black text-xl text-indigo-700">Phân tích sử dụng</h2><p className="text-xs text-slate-500">Firebase · Giờ Việt Nam (UTC+7) · cập nhật mỗi 30 giây</p></div><div className="flex gap-2"><button className={control} onClick={()=>void refresh()} disabled={loading}>{loading?'Đang tải':'Làm mới'}</button><button className={control} onClick={exportLog} disabled={!data}>Xuất nhật ký</button></div></div>
  <div className="flex flex-wrap gap-3 text-xs">
   <label>Từ ngày<input className={control} aria-label="Từ ngày" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
   <label>Đến ngày<input className={control} aria-label="Đến ngày" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
   <label>Nguồn<select className={control} aria-label="Nguồn hoạt động" value={source} onChange={e=>setSource(e.target.value)}><option value="web">Website (mặc định)</option><option value="localhost">Localhost</option><option value="test">Kiểm thử</option><option value="all">Tất cả nguồn</option></select></label>
   <label>Người thao tác<select className={control} aria-label="Người thao tác" value={uid} onChange={e=>setUid(e.target.value)}><option value="">Tất cả / hệ thống</option>{members.map(e=><option key={e.actorUid} value={e.actorUid}>{e.actorName}</option>)}</select></label>
   <label>Trạng thái<select className={control} aria-label="Trạng thái hoạt động" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Tất cả</option>{Object.entries(statuses).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
  </div>
  <div className="flex flex-wrap gap-3 items-center"><button className={control} disabled={loading} onClick={()=>void checkRecording()}>Kiểm tra ghi nhận</button><span className="text-xs text-slate-500">Ghi một thao tác có nhãn Kiểm thử; không dùng AI, quota hoặc thanh toán.</span></div>
  {checkNotice&&<p role="status" className="text-sm text-emerald-700">{checkNotice}</p>}
  {error&&<p role="alert" className="bg-red-50 text-red-700 p-3 rounded-xl">{error}. {data?'Đang giữ bản đọc trước đó.':'Chưa có số liệu.'}</p>}
  {data?.truncated&&<p role="alert" className="bg-amber-50 p-3 rounded-xl">Có hơn 5.000 sự kiện. Thu hẹp khoảng ngày; tổng hiện tại chưa đầy đủ.</p>}
  <p className="text-xs text-slate-500">Lần đọc: {time(updated)}. Nhật ký chuẩn bắt đầu: {time(data?.canonicalSince)}. Trước mốc này thiếu chi tiết ai làm gì/lúc nào. Dữ liệu cũ {data?.legacyDates?.length||0} ngày chưa rõ nguồn, không nhập vào tổng mới.</p>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[
   [stats.reduce((n,s)=>n+s.requests,0),'Hoạt động server thành công'],[events.filter((e:any)=>e.status==='error').length,'Lỗi đã ghi nhận'],[events.filter((e:any)=>['observed','cancelled'].includes(e.status)).length,'Thao tác client / hủy'],[events.filter((e:any)=>e.status==='started').length,'Chưa nhận kết quả'],
  ].map(([value,label])=><div key={label} className="bg-indigo-50 rounded-xl p-4"><strong className="text-2xl text-indigo-700" data-testid={label==='Hoạt động server thành công'?'analytics-success-count':undefined}>{data?value:'—'}</strong><p className="text-xs mt-1">{label}</p></div>)}</div>
  <div className="flex flex-wrap gap-2">{days.map(d=><button key={d} onClick={()=>setDate(d)} className={`rounded-xl border px-3 py-2 text-xs ${date===d?'bg-indigo-600 text-white':''}`}>{d} · {stats.find(s=>s.date===d)?.requests||0} thành công</button>)}</div>
  <div className="grid md:grid-cols-2 gap-4">
   <div className="border rounded-xl p-4"><h3 className="font-bold">Hoạt động thành công ngày {date}</h3><p className="text-sm mt-2">{day?.requests||0} hoạt động · {((day?.totalDurationMinutes||0)*60).toFixed(1)} giây xử lý server được đo</p>{Object.entries(day||{}).filter(([k,v])=>typeof v==='number'&&!['requests','totalDurationMinutes','errors','observations'].includes(k)).map(([k,v])=><p key={k} className="text-sm mt-2">{k}: <strong>{String(v)}</strong></p>)}<p className="text-xs text-slate-500 mt-3">Không suy thời lượng từ bộ đếm lượt hoặc thời gian mở trang.</p></div>
   <div className="border rounded-xl p-4"><h3 className="font-bold">Đối chiếu bản ghi đang có</h3><p className="text-sm mt-2">{(data?.payments||[]).filter((p:any)=>!uid||p.uid===uid).length} thanh toán đã kích hoạt trong khoảng ngày. Không dựng lại actor/nguồn cho thanh toán cũ thiếu sự kiện.</p><p className="text-xs text-slate-500 mt-2">Quota reset lúc 05:00; nhật ký theo ngày lịch 00:00. promptCount đã gồm MarkItDown/Vẽ hình, không cộng hai lần. Quota gồm mọi nguồn và không được dùng để bù nhật ký thiếu.</p><details className="mt-3 text-xs"><summary>Bộ đếm quota hiện tại (tất cả nguồn)</summary><div className="overflow-x-auto"><table className="w-full mt-2"><thead><tr><th>UID / ngày quota</th><th>LaTeX</th><th>Đề</th><th>Tinh chỉnh</th><th>MarkItDown</th></tr></thead><tbody>{(data?.usage||[]).filter((u:any)=>!uid||u.uid===uid).map((u:any)=><tr key={u.uid}><td className="py-2">{u.uid}<br/>{u.resetDay}</td><td>{u.latexCount}</td><td>{u.examCount}</td><td>{u.promptCount}</td><td>{u.markItDownCount}</td></tr>)}</tbody></table></div></details></div>
  </div>
  <h3 className="font-bold">Chi tiết hoạt động ngày {date}</h3><p className="text-xs text-slate-500">Tên/email từ hồ sơ Firebase theo quyền quản trị; UID là người xác thực. Thao tác client là báo cáo, không phải bằng chứng server thành công.</p>
  <div className="overflow-x-auto"><table data-testid="activity-table" className="w-full min-w-[750px] text-sm text-left"><thead className="bg-slate-50"><tr>{['Ngày / giờ Việt Nam','Người / UID','Hành động','Nguồn','Trạng thái'].map(t=><th key={t} className="p-3">{t}</th>)}</tr></thead><tbody>{rows.map((e:any)=><tr key={e.id} data-activity-id={e.id} className="border-b"><td className="p-3 whitespace-nowrap">{time(e.occurredAt)}</td><td className="p-3"><strong>{e.actorName}</strong><div className="text-xs text-slate-500">{e.actorEmail}<br/>{e.actorUid||'system'}{e.targetUid&&<><br/>Đối tượng: {e.targetUid}</>}</div></td><td className="p-3">{e.action}{e.referenceId&&<div className="text-xs">Mã: {e.referenceId}</div>}</td><td className="p-3">{sources[e.source]||'Chưa rõ'}</td><td className="p-3">{statuses[e.status]}{e.httpStatus&&<div className="text-xs">HTTP {e.httpStatus}</div>}</td></tr>)}</tbody></table></div>
  {!rows.length&&<p className="text-center py-8 text-sm text-slate-500">Chưa ghi nhận hoạt động phù hợp bộ lọc. Không đồng nghĩa chưa từng có hoạt động.</p>}
 </section>;
};
