import { useEffect, useState } from 'react';
import { authFetch } from '../utils/api-client';

interface ConfirmationEvent {
  id: string;
  phoneNumber: string;
  email?: string;
  confirmedAt: string;
  method: string;
}

interface DuplicateAccount {
  uid: string;
  email: string;
  displayName: string;
}

export function PhoneConfirmationHistory({ uid }: { uid: string }) {
  const [result, setResult] = useState<{ events: ConfirmationEvent[]; duplicatePhone: boolean; duplicateAccounts?: DuplicateAccount[] } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    setError('');
    (async () => {
      try {
        const response = await authFetch('/api/email-verification?action=history', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUid: uid }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Không tải được lịch sử xác nhận.');
        if (active) {
          setResult({ 
            events: Array.isArray(payload.events) ? payload.events : [], 
            duplicatePhone: payload.duplicatePhone === true,
            duplicateAccounts: Array.isArray(payload.duplicateAccounts) ? payload.duplicateAccounts : []
          });
        }
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : 'Không tải được lịch sử xác nhận.');
      }
    })();
    return () => { active = false; };
  }, [uid, retry]);
  return (
    <section className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs">
      <h4 className="mb-2 font-bold text-slate-700">Lịch sử xác nhận số liên hệ qua email</h4>
      {error ? <div role="alert" className="text-rose-600">{error} <button type="button" onClick={() => setRetry(value => value + 1)} className="font-bold underline">Thử lại</button></div>
        : !result ? <p role="status" className="text-slate-500">Đang tải lịch sử…</p>
        : <>
          {result.duplicatePhone && (
            <div className="mb-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 p-2.5 text-amber-900 shadow-2xs">
              <p className="font-bold text-[11px] mb-1">
                Số này cũng được khai báo ở tài khoản khác ({result.duplicateAccounts?.length || 1} tài khoản):
              </p>
              {result.duplicateAccounts && result.duplicateAccounts.length > 0 ? (
                <div className="space-y-1 my-1.5 pl-1.5 border-l-2 border-amber-400">
                  {result.duplicateAccounts.map(acc => (
                    <div key={acc.uid} className="text-[11px] font-medium text-slate-800 flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-amber-950">{acc.displayName || 'Thành viên'}:</span>
                      <span className="text-indigo-700 font-semibold">{acc.email || `UID: ${acc.uid}`}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="text-[10px] text-amber-700 italic">Cần kiểm tra thêm; đây không phải kết luận gian lận.</p>
            </div>
          )}
          {result.events.length === 0 ? <p className="text-slate-500">Chưa có lần xác nhận theo chính sách mới.</p>
            : <ul className="max-h-40 space-y-2 overflow-y-auto" aria-label="Các lần xác nhận số liên hệ">
              {result.events.map(event => <li key={event.id} className="border-b border-slate-100 pb-2 last:border-0">
                <p className="font-semibold text-slate-800">{event.phoneNumber}</p>
                <p className="text-slate-500">{new Date(event.confirmedAt).toLocaleString('vi-VN')} · OTP email</p>
                {event.email && <p className="break-all text-slate-500">{event.email}</p>}
              </li>)}
            </ul>}
          <p className="mt-2 text-[10px] text-slate-400">Tối đa 100 lần gần nhất. Xác nhận qua email không chứng minh quyền sở hữu số.</p>
        </>}
    </section>
  );
}
