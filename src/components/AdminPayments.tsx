import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import { Loader2, Banknote, Search, Sparkles, Gift, Filter, X, CheckCircle2, User } from "lucide-react";

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
    return { ...p, user, isAdminGrant };
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
    <div className="bg-white/72 backdrop-blur-lg border border-white/50 shadow-[0_10px_40px_rgba(120,120,180,.08)] rounded-[28px] p-4 md:p-6 lg:p-8 flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-white/50 rounded-xl flex items-center justify-center shrink-0 border border-white/50">
            <Banknote className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-800 font-sans">Quản lý thanh toán & Gói</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Lịch sử giao dịch PayOS và danh sách gói cấp qua quyền Admin.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3.5 py-2 flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">Doanh thu PayOS</span>
            <span className="text-base font-black text-indigo-700">
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalRevenue)}
            </span>
          </div>

          <div className="bg-purple-50 border border-purple-100 rounded-xl px-3.5 py-2 flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400">Gói Admin cấp</span>
            <span className="text-base font-black text-purple-700">
              {totalAdminGrants} lượt (0 ₫)
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowGrantModal(true);
              setGrantSuccessMsg("");
              setGrantErrorMsg("");
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Cấp gói thành viên
          </button>
        </div>
      </div>

      {/* Controls & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
            placeholder="Tìm theo Mã GD, Email, Tên hoặc Ghi chú..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0">
          <button
            type="button"
            onClick={() => { setFilterType("all"); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterType === "all" ? "bg-white text-slate-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tất cả ({payments.length})
          </button>
          <button
            type="button"
            onClick={() => { setFilterType("payos"); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterType === "payos" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            PayOS ({totalPayosOrders})
          </button>
          <button
            type="button"
            onClick={() => { setFilterType("admin"); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterType === "admin" ? "bg-white text-purple-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Admin cấp ({totalAdminGrants})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex-1 flex flex-col min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 w-[16%]">Mã Đơn / Kênh</th>
                <th className="py-3 px-4 w-[24%]">Khách hàng</th>
                <th className="py-3 px-4 w-[18%]">Gói / Giá trị</th>
                <th className="py-3 px-4 w-[20%]">Trạng thái gói hiện tại</th>
                <th className="py-3 px-4 text-right w-[22%]">Thời gian kích hoạt</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Đang tải dữ liệu thanh toán...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-rose-500">
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
                  <td colSpan={5} className="py-20 text-center text-slate-500">
                    <Banknote className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">Không tìm thấy giao dịch nào phù hợp.</p>
                  </td>
                </tr>
              ) : (
                currentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-semibold text-slate-700 flex items-center gap-1">
                        #{p.id}
                      </div>
                      <div className="mt-1">
                        {p.isAdminGrant ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            <Sparkles className="w-2.5 h-2.5" /> Admin cấp
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            PayOS QR
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {p.user ? (
                        <div className="flex items-center gap-2.5">
                          <img src={p.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.user.displayName || p.user.email || 'User')}&background=random`} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-700 truncate">{p.user.displayName || "Thành viên"}</div>
                            <div className="text-[10px] text-slate-500 truncate">{p.user.email}</div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="text-xs italic text-slate-400">UID: {p.uid}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getPlanColor(p.plan)}`}>
                          {p.plan || 'UNKNOWN'}
                        </span>
                        <span className="font-black text-slate-800 text-sm">
                          {p.isAdminGrant ? (
                            <span className="text-purple-700 font-bold">0 ₫ <span className="text-[10px] font-normal text-slate-400">(Miễn phí)</span></span>
                          ) : (
                            new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(p.amount) || 0)
                          )}
                        </span>
                        {p.note && (
                          <span className="text-[10px] text-slate-400 italic max-w-[150px] truncate" title={p.note}>
                            {p.note}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {p.user ? (
                        <div className="text-[11px]">
                          <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                            Gói hiện tại: <span className={`uppercase font-bold ${getPlanColor(p.user.planType).replace('bg-', 'text-').split(' ')[1]}`}>{p.user.planType || 'FREE'}</span>
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
                    <td className="py-3 px-4 text-right">
                      <div className="text-sm font-semibold text-slate-700">
                        {p.activatedAt ? new Date(p.activatedAt).toLocaleDateString('vi-VN') : "N/A"}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {p.activatedAt ? new Date(p.activatedAt).toLocaleTimeString('vi-VN') : ""}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      {!loading && !error && filteredPayments.length > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="text-xs font-medium text-slate-500">
            Hiển thị <span className="font-bold text-slate-700">{pageIndex * itemsPerPage + 1}</span> - <span className="font-bold text-slate-700">{Math.min((pageIndex + 1) * itemsPerPage, filteredPayments.length)}</span> trên tổng số <span className="font-bold text-slate-700">{filteredPayments.length}</span> giao dịch
          </div>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Trang trước
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Trang tiếp
            </button>
          </div>
        </div>
      )}

      {/* MODAL CẤP GÓI CHO NGƯỜI DÙNG */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-[24px] border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col p-6 gap-5">
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
        </div>
      )}
    </div>
  );
};
