import React, { useState } from 'react';
import { Smartphone, Loader2, LogOut, ShieldCheck } from 'lucide-react';

interface MandatoryPhoneGateProps {
  user: any;
  userDoc: any;
  onPhoneUpdated: (newPhone: string) => void;
  onLogout: () => void;
}

export function MandatoryPhoneGate({ user, userDoc, onPhoneUpdated, onLogout }: MandatoryPhoneGateProps) {
  const [phoneNumber, setPhoneNumber] = useState(userDoc?.phoneNumber || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const clean = phoneNumber.trim().replace(/[\s().-]/g, '');
    const local = clean.startsWith('+84') ? `0${clean.slice(3)}` : clean;

    if (!/^0[35789]\d{8}$/.test(local)) {
      setError('Số điện thoại không đúng định dạng di động Việt Nam (gồm 10 số, bắt đầu bằng 03, 05, 07, 08, 09).');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/user/update-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phoneNumber: local })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể cập nhật số điện thoại.');
      }

      onPhoneUpdated(local);
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi cập nhật số điện thoại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 font-sans text-slate-800 backdrop-blur-md">
      <section className="w-full max-w-md rounded-3xl border border-indigo-100 bg-white p-6 sm:p-8 shadow-2xl shadow-indigo-950/20">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Smartphone size={30} aria-hidden="true" />
        </div>
        <h1 className="text-center text-2xl font-black tracking-tight text-slate-900">
          Cập nhật số điện thoại
        </h1>
        <p className="mt-2 text-center text-xs leading-5 text-slate-600">
          Tài khoản của bạn (<strong className="text-slate-800">{user?.email}</strong>) đã được xác thực email. Để tiếp tục sử dụng hệ thống Word2LaTeX, vui lòng nhập số điện thoại liên hệ của bạn để lưu vào cài đặt cá nhân.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="mandatory-phone" className="block text-xs font-bold text-slate-700">
              Số điện thoại di động <span className="text-rose-500">*</span>
            </label>
            <input
              id="mandatory-phone"
              type="tel"
              required
              autoFocus
              placeholder="VD: 0912345678"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                if (error) setError('');
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
            />
            <p className="text-[11px] text-slate-400">
              Số này sẽ được lưu cố định vào hồ sơ. Bạn vẫn có thể cập nhật số mới trong mục Cài đặt cá nhân bất kỳ lúc nào.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-xs font-bold text-white shadow-md transition-all hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang lưu số điện thoại...
              </>
            ) : (
              'Lưu cài đặt & Tiếp tục dùng'
            )}
          </button>
        </form>

        <div className="mt-5 border-t border-slate-100 pt-4 text-center">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <LogOut size={14} />
            Đăng xuất tài khoản
          </button>
        </div>
      </section>
    </main>
  );
}
