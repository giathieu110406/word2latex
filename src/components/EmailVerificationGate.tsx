import { useEffect, useState } from 'react';
import { Loader2, Mail, RefreshCw, ShieldCheck, Smartphone, LogOut } from 'lucide-react';
import { authFetch } from '../utils/api-client';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface EmailVerificationGateProps {
  email: string;
  onVerified: (verifiedAt: string) => Promise<void> | void;
}

type Step = 'phone' | 'code';

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

export function EmailVerificationGate({ email, onVerified }: EmailVerificationGateProps) {
  const [step, setStep] = useState<Step>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds > 0]);

  const requestCode = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const response = await authFetch('/api/email-verification?action=send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        const cooldown = Number(payload.cooldownSeconds);
        if (Number.isFinite(cooldown) && cooldown > 0) setCooldownSeconds(cooldown);
        throw new Error(String(payload.error || 'Không thể gửi mã xác thực.'));
      }
      setCooldownSeconds(Number(payload.cooldownSeconds) || 60);
      setStep('code');
      setCode('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể gửi mã xác thực.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyCode = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const response = await authFetch('/api/email-verification?action=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(String(payload.error || 'Không thể xác thực mã.'));
      }
      await onVerified(String(payload.emailOtpVerifiedAt));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể xác thực mã.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 font-sans text-slate-800 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-3xl border border-indigo-100 bg-white p-6 sm:p-8 shadow-2xl shadow-indigo-900/10">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
          <ShieldCheck size={30} aria-hidden="true" />
        </div>
        <h1 className="text-center text-2xl font-black tracking-tight text-slate-900">Xác thực tài khoản</h1>
        <p className="mt-2 text-center text-sm leading-6 text-slate-600">
          Nhập số điện thoại và xác nhận mã gửi đến <strong className="break-all text-slate-800">{email}</strong> để tiếp tục dùng Word2LaTeX.
        </p>

        {step === 'phone' ? (
          <div className="mt-7 space-y-4">
            <label className="block text-sm font-bold text-slate-700" htmlFor="verification-phone">Số điện thoại Việt Nam</label>
            <div className="relative">
              <Smartphone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} aria-hidden="true" />
              <input
                id="verification-phone"
                type="tel"
                autoComplete="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="0901234567"
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
            </div>
            <p className="text-xs leading-5 text-slate-500">Số sẽ được lưu ở dạng +84. Hệ thống chỉ gửi mã về email, không gửi SMS.</p>
            <button type="button" onClick={requestCode} disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? <Loader2 className="animate-spin" size={19} /> : <Mail size={19} />}
              Gửi mã qua email
            </button>
          </div>
        ) : (
          <div className="mt-7 space-y-4">
            <label className="block text-sm font-bold text-slate-700" htmlFor="verification-code">Mã xác thực gồm 6 chữ số</label>
            <input
              id="verification-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-xl font-bold tracking-[0.35em] text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
            <p className="text-xs leading-5 text-slate-500">Nếu chưa thấy mã, hãy kiểm tra Hộp thư rác hoặc Spam.</p>
            <button type="button" onClick={verifyCode} disabled={isSubmitting || code.length !== 6} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? <Loader2 className="animate-spin" size={19} /> : <ShieldCheck size={19} />}
              Xác thực và tiếp tục
            </button>
            <button type="button" onClick={requestCode} disabled={isSubmitting || cooldownSeconds > 0} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
              <RefreshCw size={17} aria-hidden="true" />
              {cooldownSeconds > 0 ? `Gửi lại sau ${cooldownSeconds}s` : 'Gửi lại mã'}
            </button>
          </div>
        )}

        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-rose-600"
          >
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </section>
    </main>
  );
}
