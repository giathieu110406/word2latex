import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { auth } from "../firebase";
import { getActivePlan } from "../../shared/subscription-policy";
import { Loader2, Banknote, Search, Sparkles, Gift, X, CheckCircle2, Trash2, AlertTriangle, Info, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AdminPaymentsProps {
  allUsers: any[];
}

export const AdminPayments: React.FC<AdminPaymentsProps> = ({ allUsers }) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "payos" | "admin">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Chi tiết giao dịch được chọn khi bấm Avatar trên mobile
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<any | null>(null);
  const [detailCopied, setDetailCopied] = useState(false);

  // Swiped row id and delete states
  const [swipedPaymentId, setSwipedPaymentId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [mouseStartX, setMouseStartX] = useState<number | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Modal cấp gói
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantUserQuery, setGrantUserQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"trial" | "plus" | "pro">("plus");
  const [durationDays, setDurationDays] = useState<number>(30);
  const [grantNote, setGrantNote] = useState("Cấp bởi Quản trị viên");
  const [isSubmittingGrant, setIsSubmittingGrant] = useState(false);
  const [grantSuccessMsg, setGrantSuccessMsg] = useState("");
  const [grantErrorMsg, setGrantErrorMsg] = useState("");

  const fetchPayments = async () => {
    setLoading(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Chưa đăng nhập hoặc phiên làm việc hết hạn.");
      }
      const res = await fetch("/api/admin/payments", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Không thể kết nối API quản lý thanh toán (Server chưa nạp endpoint mới). Vui lòng khởi động lại server dev.");
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể tải dữ liệu thanh toán");
      }
      
      setPayments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleGrantPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setGrantErrorMsg("Vui lòng chọn một người dùng để cấp gói.");
      return;
    }
    setIsSubmittingGrant(true);
    setGrantErrorMsg("");
    setGrantSuccessMsg("");

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Chưa đăng nhập");

      const res = await fetch("/api/admin/grant-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUid: selectedUser.uid,
          plan: selectedPlan,
          durationDays: Number(durationDays),
          note: grantNote.trim() || "Cấp bởi Quản trị viên"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Có lỗi xảy ra khi cấp gói");
      }

      setGrantSuccessMsg(data.message || "Cấp gói thành công!");
      fetchPayments();
      setTimeout(() => {
        setShowGrantModal(false);
        setSelectedUser(null);
        setGrantSuccessMsg("");
        setGrantUserQuery("");
      }, 1200);
    } catch (err: any) {
      setGrantErrorMsg(err.message || "Không thể cấp gói cho người dùng");
    } finally {
      setIsSubmittingGrant(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    setIsDeleting(true);
    setDeleteError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Chưa đăng nhập");

      const res = await fetch(`/api/admin/payments?id=${encodeURIComponent(paymentId)}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể xóa giao dịch");
      }

      setSwipedPaymentId(null);
      setPaymentToDelete(null);
      fetchPayments();
    } catch (err: any) {
      setDeleteError(err.message || "Lỗi khi xóa giao dịch");
    } finally {
      setIsDeleting(false);
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan?.toLowerCase()) {
      case 'pro': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'plus': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'trial': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Enhance payment records with user info
  const enrichedPayments = payments.map(p => {
    const user = allUsers.find(u => u.uid === p.uid);
    const isAdminGrant = p.method === "admin_grant" || Number(p.amount) === 0;
    // Tính trạng thái gói hiện tại chuẩn xác theo thời gian thực (hết hạn -> free)
    const effectivePlan = user ? getActivePlan(user.planType, user.planExpiresAt) : (p.plan ? getActivePlan(p.plan, p.planExpiresAt) : 'free');
    const isExpired = Boolean(user?.planExpiresAt && Date.now() >= user.planExpiresAt && user.planType !== 'free');
    return { ...p, user, isAdminGrant, effectivePlan, isExpired };
  });

  // Filter
  const filteredPayments = enrichedPayments.filter(p => {
    if (filterType === "payos" && p.isAdminGrant) return false;
    if (filterType === "admin" && !p.isAdminGrant) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const email = p.user?.email?.toLowerCase() || "";
    const name = p.user?.displayName?.toLowerCase() || "";
    const id = (p.id || "").toLowerCase();
    const note = (p.note || "").toLowerCase();
    return email.includes(q) || name.includes(q) || id.includes(q) || note.includes(q);
  });

  // Pagination
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage) || 1;
  const pageIndex = Math.min(Math.max(currentPage, 1), totalPages) - 1;
  const currentPayments = filteredPayments.slice(pageIndex * itemsPerPage, (pageIndex + 1) * itemsPerPage);

  const totalRevenue = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalAdminGrants = payments.filter(p => p.method === "admin_grant" || Number(p.amount) === 0).length;
  const totalPayosOrders = payments.filter(p => Number(p.amount) > 0).length;

  const candidateUsers = allUsers.filter(u => {
    if (!grantUserQuery) return false;
    const q = grantUserQuery.toLowerCase();
    const email = (u.email || "").toLowerCase();
    const name = (u.displayName || "").toLowerCase();
    return email.includes(q) || name.includes(q);
  }).slice(0, 5);

  return (
    <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[22px] sm:rounded-[28px] p-3 sm:p-5 md:p-6 lg:p-8 flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3.5 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white/60 rounded-xl flex items-center justify-center shrink-0 border border-white/50 shadow-2xs">
            <Banknote className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-800 font-sans">Quản lý thanh toán & Gói</h2>
          </div>
        </div>
        
        {/* 3 Ô TRÊN CÙNG 1 HÀNG */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3 w-full md:w-auto shrink-0">
          <div className="bg-indigo-50 border border-indigo-100/90 rounded-xl p-2 sm:px-3.5 sm:py-2 flex flex-col items-center sm:items-end justify-center text-center sm:text-right shadow-3xs">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-indigo-500 truncate w-full">Doanh thu</span>
            <span className="text-xs sm:text-sm md:text-base font-black text-indigo-700 truncate w-full">
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalRevenue)}
            </span>
          </div>

          <div className="bg-purple-50 border border-purple-100/90 rounded-xl p-2 sm:px-3.5 sm:py-2 flex flex-col items-center sm:items-end justify-center text-center sm:text-right shadow-3xs">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-purple-500 truncate w-full">Admin cấp</span>
            <span className="text-xs sm:text-sm md:text-base font-black text-purple-700 truncate w-full">
              {totalAdminGrants} lượt
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowGrantModal(true);
              setGrantSuccessMsg("");
              setGrantErrorMsg("");
            }}
            className="p-1.5 sm:px-4 sm:py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="text-[10px] sm:text-xs truncate font-extrabold">Cấp gói</span>
          </button>
        </div>
      </div>

      {/* Controls & Filter */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 mb-3.5 sm:mb-5">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
            placeholder="Tìm theo Mã GD, Email, Tên hoặc Ghi chú..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>

        {/* 3 Ô FILTER BẰNG NHAU (GRID COLS 3) VỚI ANIMATE UI */}
        <div className="grid grid-cols-3 gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 shrink-0 w-full sm:w-auto relative select-none">
          <button
            type="button"
            onClick={() => { setFilterType("all"); setCurrentPage(1); }}
            className={`relative py-1.5 px-2 rounded-lg text-[11px] sm:text-xs font-bold transition-colors cursor-pointer text-center z-10 ${
              filterType === "all" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {filterType === "all" && (
              <motion.div
                layoutId="active-payment-filter-pill"
                className="absolute inset-0 bg-white rounded-lg shadow-xs -z-10"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <span className="truncate block">Tất cả ({payments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => { setFilterType("payos"); setCurrentPage(1); }}
            className={`relative py-1.5 px-2 rounded-lg text-[11px] sm:text-xs font-bold transition-colors cursor-pointer text-center z-10 ${
              filterType === "payos" ? "text-emerald-700" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {filterType === "payos" && (
              <motion.div
                layoutId="active-payment-filter-pill"
                className="absolute inset-0 bg-white rounded-lg shadow-xs -z-10"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <span className="truncate block">PayOS ({totalPayosOrders})</span>
          </button>

          <button
            type="button"
            onClick={() => { setFilterType("admin"); setCurrentPage(1); }}
            className={`relative py-1.5 px-2 rounded-lg text-[11px] sm:text-xs font-bold transition-colors cursor-pointer text-center z-10 ${
              filterType === "admin" ? "text-purple-700" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {filterType === "admin" && (
              <motion.div
                layoutId="active-payment-filter-pill"
                className="absolute inset-0 bg-white rounded-lg shadow-xs -z-10"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <span className="truncate block">Admin cấp ({totalAdminGrants})</span>
          </button>
        </div>
      </div>

      {/* Main List & Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex-1 flex flex-col min-h-[300px] md:min-h-[400px]">
        {/* GIAO DIỆN MOBILE: DANH SÁCH THÀNH VIÊN KHÔNG CẦN CUỘN NGANG */}
        <div className="md:hidden divide-y divide-slate-100 flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-2" />
              <p className="text-slate-500 text-xs font-medium">Đang tải dữ liệu...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center text-rose-500 px-4">
              <p className="font-semibold text-xs mb-2">{error}</p>
              <button
                onClick={fetchPayments}
                className="px-3 py-1 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold"
              >
                Thử lại
              </button>
            </div>
          ) : currentPayments.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Banknote className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs font-medium">Không tìm thấy giao dịch nào.</p>
            </div>
          ) : (
            currentPayments.map((p) => (
              <div
                key={p.id}
                className="p-2.5 grid grid-cols-12 gap-1.5 items-center hover:bg-slate-50/70 transition-colors"
              >
                {/* Cột 1: Khách hàng (Avatar + Tên/Email) */}
                <div className="col-span-5 sm:col-span-6 flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentDetail(p)}
                    className="relative shrink-0 rounded-full ring-2 ring-indigo-100/90 hover:ring-indigo-400 active:scale-95 transition-all cursor-pointer"
                    title="Bấm để xem Mã đơn & Thời gian kích hoạt"
                  >
                    <img
                      src={p.user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.user?.displayName || p.user?.email || 'User')}&background=random`}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-600 rounded-full flex items-center justify-center text-white ring-1 ring-white">
                      <Info className="w-2 h-2" />
                    </div>
                  </button>

                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setSelectedPaymentDetail(p)}>
                    <div className="font-bold text-slate-800 text-[11px] sm:text-xs truncate flex items-center gap-1">
                      <span className="truncate">{p.user?.displayName || "Thành viên"}</span>
                      {p.isAdminGrant ? (
                        <span className="text-[7.5px] font-black uppercase px-1 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                          Admin
                        </span>
                      ) : (
                        <span className="text-[7.5px] font-black uppercase px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          PayOS
                        </span>
                      )}
                    </div>
                    <div className="text-[9.5px] text-slate-400 truncate">{p.user?.email || `UID: ${p.uid}`}</div>
                  </div>
                </div>

                {/* Cột 2: Gói & Giá trị đứng thẳng một cột tách biệt */}
                <div className="col-span-4 sm:col-span-3 flex flex-col items-center justify-center text-center px-1">
                  <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded border uppercase leading-tight ${getPlanColor(p.plan)}`}>
                    {p.plan || 'UNKNOWN'}
                  </span>
                  <span className="font-black text-[11px] sm:text-xs text-slate-800 mt-0.5 leading-tight">
                    {p.isAdminGrant ? (
                      <span className="text-purple-700 font-bold">0 ₫</span>
                    ) : (
                      new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(p.amount) || 0)
                    )}
                  </span>
                </div>

                {/* Cột 3: Trạng thái gói hiện tại */}
                <div className="col-span-3 flex flex-col items-end justify-center text-right shrink-0">
                  <span className="text-[9px] text-slate-400 font-medium leading-none mb-0.5">Trạng thái:</span>
                  <span className={`uppercase font-extrabold text-[10px] leading-tight ${getPlanColor(p.effectivePlan).replace('bg-', 'text-').split(' ')[1]}`}>
                    {p.effectivePlan || 'FREE'}
                  </span>
                  {p.isExpired && (
                    <span className="text-[8px] font-bold text-rose-500 bg-rose-50 px-1 rounded border border-rose-100 mt-0.5">
                      Đã hết hạn
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* GIAO DIỆN DESKTOP / TABLET: BẢNG 4 CỘT (Ẩn cột Mã Đơn / Kênh, click Avatar xem mã đơn) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 w-[32%]">Khách hàng</th>
                <th className="py-3 px-4 w-[22%]">Gói / Giá trị</th>
                <th className="py-3 px-4 w-[24%]">Trạng thái gói hiện tại</th>
                <th className="py-3 px-4 text-right w-[22%]">Thời gian kích hoạt</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Đang tải dữ liệu thanh toán...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-rose-500">
                    <p className="font-semibold text-sm mb-3">{error}</p>
                    <button
                      onClick={fetchPayments}
                      className="px-4 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      Thử lại
                    </button>
                  </td>
                </tr>
              ) : currentPayments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-slate-500">
                    <Banknote className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">Không tìm thấy giao dịch nào phù hợp.</p>
                  </td>
                </tr>
              ) : (
                currentPayments.map((p) => {
                  const isSwiped = swipedPaymentId === p.id;
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/50 transition-colors relative"
                      onTouchStart={(e) => {
                        if (!p.isAdminGrant) return;
                        setTouchStartX(e.touches[0].clientX);
                      }}
                      onTouchEnd={(e) => {
                        if (!p.isAdminGrant || touchStartX === null) return;
                        const diff = touchStartX - e.changedTouches[0].clientX;
                        if (diff > 40) setSwipedPaymentId(p.id);
                        else if (diff < -40 && swipedPaymentId === p.id) setSwipedPaymentId(null);
                        setTouchStartX(null);
                      }}
                      onMouseDown={(e) => {
                        if (!p.isAdminGrant) return;
                        setMouseStartX(e.clientX);
                      }}
                      onMouseUp={(e) => {
                        if (!p.isAdminGrant || mouseStartX === null) return;
                        const diff = mouseStartX - e.clientX;
                        if (diff > 40) setSwipedPaymentId(p.id);
                        else if (diff < -40 && swipedPaymentId === p.id) setSwipedPaymentId(null);
                        setMouseStartX(null);
                      }}
                    >
                      {/* Col 1: Khách hàng (bấm avatar để xem popup Mã Đơn & Kênh) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentDetail(p)}
                            className="relative shrink-0 rounded-full ring-2 ring-indigo-100/90 hover:ring-indigo-400 active:scale-95 transition-all cursor-pointer"
                            title="Bấm để xem Mã đơn & Kênh thanh toán"
                          >
                            <img
                              src={p.user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.user?.displayName || p.user?.email || 'User')}&background=random`}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-600 rounded-full flex items-center justify-center text-white ring-1 ring-white">
                              <Info className="w-2 h-2" />
                            </div>
                          </button>

                          <div className="min-w-0 cursor-pointer" onClick={() => setSelectedPaymentDetail(p)}>
                            <div className="font-bold text-slate-700 truncate text-xs flex items-center gap-1.5">
                              <span className="truncate">{p.user?.displayName || "Thành viên"}</span>
                              {p.isAdminGrant ? (
                                <span className="inline-flex items-center gap-0.5 text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                                  <Sparkles className="w-2 h-2" /> Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                  PayOS
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">{p.user?.email || `UID: ${p.uid}`}</div>
                          </div>
                        </div>
                      </td>

                      {/* Col 2: Gói / Giá trị */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase shrink-0 leading-tight ${getPlanColor(p.plan)}`}>
                              {p.plan || 'UNKNOWN'}
                            </span>
                            <span className="font-black text-slate-800 text-sm leading-tight shrink-0">
                              {p.isAdminGrant ? (
                                <span className="text-purple-700 font-bold">0 ₫</span>
                              ) : (
                                new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(p.amount) || 0)
                              )}
                            </span>
                          </div>
                          {p.note && (
                            <span className="text-[10px] text-slate-400 italic max-w-[150px] truncate" title={p.note}>
                              {p.note}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Col 3: Trạng thái gói hiện tại */}
                      <td className="py-3 px-4">
                        {p.user ? (
                          <div className="text-[11px]">
                            <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                              Gói hiện tại:{" "}
                              <span className={`uppercase font-bold ${getPlanColor(p.effectivePlan).replace('bg-', 'text-').split(' ')[1]}`}>
                                {p.effectivePlan || 'FREE'}
                              </span>
                              {p.isExpired && (
                                <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                                  Đã hết hạn
                                </span>
                              )}
                            </div>
                            {p.user.planExpiresAt && p.user.planType !== 'free' && (
                              <div className="text-slate-500 mt-0.5 flex items-center gap-1">
                                Hết hạn: {new Date(p.user.planExpiresAt).toLocaleDateString('vi-VN')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Col 4: Thời gian kích hoạt & Kéo sang trái lộ thùng rác */}
                      <td className="py-3 px-4 text-right relative overflow-hidden">
                        <div className={`transition-transform duration-200 ${isSwiped ? "-translate-x-12" : "translate-x-0"}`}>
                          <div className="text-sm font-semibold text-slate-700">
                            {p.activatedAt ? new Date(p.activatedAt).toLocaleDateString('vi-VN') : "N/A"}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {p.activatedAt ? new Date(p.activatedAt).toLocaleTimeString('vi-VN') : ""}
                          </div>
                        </div>

                        {/* Thùng rác xuất hiện khi kéo sang trái */}
                        {p.isAdminGrant && (
                          <div
                            className={`absolute inset-y-0 right-0 flex items-center justify-center transition-all duration-200 ${
                              isSwiped ? "opacity-100 translate-x-0 pr-3" : "opacity-0 translate-x-full pointer-events-none"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentToDelete(p);
                              }}
                              className="w-8 h-8 rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-xs cursor-pointer transition-transform active:scale-90"
                              title="Xóa giao dịch này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer - Chỉ hiện khi có từ 2 trang trở lên */}
      {!loading && !error && totalPages > 1 && (
        <div className="mt-3 sm:mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="text-xs font-semibold text-slate-500">
            Trang <span className="font-extrabold text-indigo-600">{currentPage}</span> / <span className="font-bold text-slate-700">{totalPages}</span>
          </div>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Trang trước
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Trang tiếp
            </button>
          </div>
        </div>
      )}

      {/* MODAL CẤP GÓI CHO NGƯỜI DÙNG */}
      {showGrantModal && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] overflow-y-auto"
          onClick={() => setShowGrantModal(false)}
        >
          <div 
            className="bg-white rounded-[24px] border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col p-6 gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 font-sans">Cấp gói người dùng (0 ₫)</h3>
                  <p className="text-xs text-slate-400 font-medium">Ghi nhận vào lịch sử thanh toán không tính tiền.</p>
                </div>
              </div>
              <button
                onClick={() => setShowGrantModal(false)}
                className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGrantPlan} className="flex flex-col gap-4">
              {/* Chọn người dùng */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Chọn người dùng nhận gói</label>
                {selectedUser ? (
                  <div className="flex items-center justify-between p-3 bg-indigo-50/60 border border-indigo-200/80 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={selectedUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.displayName || selectedUser.email)}&background=random`} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-800 truncate">{selectedUser.displayName || "Thành viên"}</div>
                        <div className="text-[11px] text-slate-500 truncate">{selectedUser.email}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                    >
                      Đổi
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      placeholder="Nhập tên hoặc email người dùng để tìm..."
                      value={grantUserQuery}
                      onChange={(e) => setGrantUserQuery(e.target.value)}
                    />
                    {candidateUsers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden divide-y divide-slate-100">
                        {candidateUsers.map((u) => (
                          <div
                            key={u.uid}
                            onClick={() => {
                              setSelectedUser(u);
                              setGrantUserQuery("");
                            }}
                            className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-slate-800 truncate">{u.displayName || "Thành viên"}</div>
                              <div className="text-[10px] text-slate-500 truncate">{u.email}</div>
                            </div>
                            <span className="text-[9px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {u.planType || 'free'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chọn gói */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: "trial", name: "Trial", desc: "Dùng thử" },
                  { id: "plus", name: "Plus", desc: "Cơ bản" },
                  { id: "pro", name: "Pro", desc: "Chuyên nghiệp" }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedPlan(item.id as any)}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedPlan === item.id
                        ? "border-purple-600 bg-purple-50/70 text-purple-900 ring-2 ring-purple-600/20"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <div className="font-black text-sm uppercase">{item.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>

              {/* Thời hạn */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Thời hạn sử dụng</label>
                <select
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value={7}>7 ngày (Dùng thử tiêu chuẩn)</option>
                  <option value={30}>30 ngày (1 tháng)</option>
                  <option value={90}>90 ngày (3 tháng)</option>
                  <option value={180}>180 ngày (6 tháng)</option>
                  <option value={365}>365 ngày (1 năm)</option>
                  <option value={36500}>Vĩnh viễn</option>
                </select>
              </div>

              {/* Ghi chú */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Ghi chú giao dịch</label>
                <input
                  type="text"
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                  placeholder="VD: Cấp quà tặng, Khách VIP, Đối tác..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500"
                />
              </div>

              {grantErrorMsg && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {grantErrorMsg}
                </div>
              )}

              {grantSuccessMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {grantSuccessMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGrant || !selectedUser}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingGrant && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Xác nhận cấp gói (0 ₫)
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL XÁC NHẬN XÓA GIAO DỊCH ADMIN CẤP */}
      {paymentToDelete && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]"
          onClick={() => {
            setPaymentToDelete(null);
            setDeleteError("");
          }}
        >
          <div 
            className="bg-white rounded-[24px] border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden flex flex-col p-6 gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800 font-sans">Xác nhận xóa giao dịch</h3>
                <p className="text-xs text-slate-400 font-medium">Thao tác này sẽ xóa vĩnh viễn khỏi danh sách lịch sử.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-1.5 text-slate-600">
              <div><span className="font-semibold text-slate-700">Mã giao dịch:</span> #{paymentToDelete.id}</div>
              <div><span className="font-semibold text-slate-700">Khách hàng:</span> {paymentToDelete.user?.displayName || paymentToDelete.user?.email || paymentToDelete.uid}</div>
              <div><span className="font-semibold text-slate-700">Gói cấp:</span> <span className="uppercase font-bold text-purple-700">{paymentToDelete.plan}</span> (0 ₫)</div>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setPaymentToDelete(null);
                  setDeleteError("");
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeletePayment(paymentToDelete.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL CHI TIẾT GIAO DỊCH (MÃ ĐƠN & THỜI GIAN KÍCH HOẠT) KHI BẤM AVATAR TRÊN MOBILE */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {selectedPaymentDetail && (
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]"
              onClick={() => setSelectedPaymentDetail(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 10 }}
                transition={{ duration: 0.18 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-5 gap-3.5 relative"
              >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={selectedPaymentDetail.user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedPaymentDetail.user?.displayName || selectedPaymentDetail.user?.email || 'User')}&background=random`}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-slate-800 truncate">
                      {selectedPaymentDetail.user?.displayName || "Thành viên"}
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      {selectedPaymentDetail.user?.email || `UID: ${selectedPaymentDetail.uid}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPaymentDetail(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chi tiết Mã đơn & Thời gian */}
              <div className="flex flex-col gap-2.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 text-xs">
                {/* Mã đơn */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold">Mã đơn:</span>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    <span className="truncate max-w-[160px]">#{selectedPaymentDetail.id}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedPaymentDetail.id);
                        setDetailCopied(true);
                        setTimeout(() => setDetailCopied(false), 1500);
                      }}
                      className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                      title="Sao chép mã đơn"
                    >
                      {detailCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Kênh thanh toán */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Kênh giao dịch:</span>
                  <span className="font-bold">
                    {selectedPaymentDetail.isAdminGrant ? (
                      <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 text-[11px]">
                        Admin cấp quyền (0 ₫)
                      </span>
                    ) : (
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                        Cổng PayOS QR
                      </span>
                    )}
                  </span>
                </div>

                {/* Thời gian kích hoạt */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Kích hoạt lúc:</span>
                  <span className="font-bold text-slate-800 text-[11px]">
                    {selectedPaymentDetail.activatedAt
                      ? `${new Date(selectedPaymentDetail.activatedAt).toLocaleTimeString('vi-VN')}, ${new Date(selectedPaymentDetail.activatedAt).toLocaleDateString('vi-VN')}`
                      : "N/A"}
                  </span>
                </div>

                {/* Gói & Giá trị */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Gói đăng ký:</span>
                  <span className="font-extrabold uppercase text-indigo-700">
                    {selectedPaymentDetail.plan} ({selectedPaymentDetail.isAdminGrant ? "0 ₫" : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(selectedPaymentDetail.amount) || 0)})
                  </span>
                </div>

                {selectedPaymentDetail.note && (
                  <div className="flex flex-col gap-0.5 pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 font-semibold">Ghi chú:</span>
                    <span className="text-slate-600 italic">{selectedPaymentDetail.note}</span>
                  </div>
                )}
              </div>

              {/* Action nút xóa (chỉ áp dụng cho giao dịch Admin cấp) */}
              {selectedPaymentDetail.isAdminGrant && (
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentToDelete(selectedPaymentDetail);
                      setSelectedPaymentDetail(null);
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors border border-rose-200/60 shadow-2xs active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa giao dịch này</span>
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </div>
  );
};
