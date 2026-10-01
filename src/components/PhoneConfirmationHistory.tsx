import { useEffect, useState } from 'react';
import { authFetch } from '../utils/api-client';

interface ConfirmationEvent {
  id: string;
  phoneNumber: string;
  email?: string;
  confirmedAt: string;
  method: string;
}

export function PhoneConfirmationHistory({ uid }: { uid: string }) {
  const [result, setResult] = useState<{ events: ConfirmationEvent[]; duplicatePhone: boolean } | null>(null);
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
        if (active) setResult({ events: Array.isArray(payload.events) ? payload.events : [], duplicatePhone: payload.duplicatePhone === true });
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
          {result.duplicatePhone && <p className="mb-2 rounded-lg bg-amber-50 p-2 text-amber-800">Số này cũng được khai báo ở tài khoản khác. Cần kiểm tra thêm; đây không phải kết luận gian lận.</p>}
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
