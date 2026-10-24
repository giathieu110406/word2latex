import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import { X, Receipt, CheckCircle2, Clock, Calendar, AlertCircle, Loader2 } from "lucide-react";

interface UserPaymentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerToast?: (msg: string, success?: boolean) => void;
}

export const UserPaymentHistoryModal: React.FC<UserPaymentHistoryModalProps> = ({
  isOpen,
  onClose,
  triggerToast,
}) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchMyPayments = async () => {
      setLoading(true);
      setError("");
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          throw new Error("Phiên làm việc hết hạn. Vui lòng đăng nhập lại.");
        }

        const res = await fetch("/api/user-payments", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const contentType = res.headers.get("content-type") || "";
        if (!res.ok) {
          let errorMsg = `HTTP ${res.status}`;
          if (contentType.includes("application/json")) {
            const errData = await res.json().catch(() => ({}));
            errorMsg = errData.error || errorMsg;
          }
          throw new Error(errorMsg);
        }

        if (!contentType.includes("application/json")) {
          throw new Error("Phản hồi máy chủ không hợp lệ. Vui lòng thử lại sau.");
        }

        const data = await res.json();
        if (isMounted) {
          setPayments(Array.isArray(data) ? data : []);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Không thể tải lịch sử mua hàng.");
          if (triggerToast) triggerToast(err.message || "Lỗi tải lịch sử mua hàng", false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMyPayments();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formatPrice = (amount: number) => {
    if (!amount || amount === 0) return "0 đ";
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "—";
    return new Date(timestamp).toLocaleDateString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getPlanBadge = (plan?: string) => {
    const p = (plan || "").toLowerCase();
    switch (p) {
      case "pro":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-700 border border-purple-200 shadow-3xs uppercase">
            Gói PRO
          </span>
        );
      case "plus":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-700 border border-blue-200 shadow-3xs uppercase">
            Gói PLUS
          </span>
        );
      case "trial":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-3xs uppercase">
            Gói TRIAL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-3xs uppercase">
            {plan || "GÓI CƯỚC"}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-150 flex items-center justify-between bg-slate-50/70 select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-3xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                Lịch sử mua hàng
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Các gói cước và giao dịch đã thanh toán của tài khoản
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
              <span className="text-xs font-semibold">Đang tải lịch sử giao dịch...</span>
            </div>
          ) : error ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-2.5 text-rose-500">
              <AlertCircle className="w-8 h-8 text-rose-500/80" />
              <p className="text-xs font-bold">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setLoading(true);
                  // Trigger re-fetch
                  const token = auth.currentUser?.getIdToken();
                  if (token) {
                    token.then((t) =>
                      fetch("/api/user-payments", { headers: { Authorization: `Bearer ${t}` } })
                        .then((r) => r.json())
                        .then((d) => setPayments(Array.isArray(d) ? d : []))
                        .catch((err) => setError(err.message))
                        .finally(() => setLoading(false))
                    );
                  }
                }}
                className="mt-2 text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : payments.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-slate-400 select-none">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 border border-slate-200/60">
                <Receipt className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-700 mb-1">Chưa có giao dịch mua hàng</h4>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                Tài khoản của bạn chưa thực hiện đơn thanh toán nào qua cổng thanh toán PayOS hoặc hệ thống.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-1 pb-1">
                <span>Giao dịch ({payments.length})</span>
                <span>Trạng thái</span>
              </div>

              {payments.map((item, index) => {
                const isGrant = item.method === "admin_grant" || item.amount === 0;
                return (
                  <div
                    key={item.id || index}
                    className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-3xs"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-white border border-slate-200/70 text-slate-600 shadow-3xs shrink-0 mt-0.5">
                        <Receipt className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-800">
                            {getPlanBadge(item.plan)}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 font-mono">
                            #{item.id?.length > 18 ? item.id.slice(0, 14) + "..." : item.id}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1 font-medium">
                          <span className="flex items-center gap-1 text-[11px]">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatDate(item.activatedAt)}
                          </span>

                          {item.planExpiresAt && (
                            <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 font-semibold">
                              <Calendar className="w-3 h-3 text-amber-500" />
                              Hạn: {new Date(item.planExpiresAt).toLocaleDateString("vi-VN")}
                            </span>
                          )}

                          {isGrant && (
                            <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                              {item.note || "Đặc quyền Quản trị"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60 shrink-0 gap-1">
                      <span className="text-sm sm:text-base font-black text-slate-800">
                        {isGrant ? "Miễn phí" : formatPrice(item.amount)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                        Thành công
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>


      </div>
    </div>
  );
};
