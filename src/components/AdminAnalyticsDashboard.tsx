import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, Download, FileCode2, FileSpreadsheet, FileText, PenTool, RefreshCw, Search, Sparkles, Users } from 'lucide-react';
import { authFetch } from '../utils/api-client';
import { aggregateDashboardUsage, FeatureBucket, vietnamDate } from '../../shared/activity';

export interface AdminAnalyticsDashboardProps { allUsers?: any[] }
export interface DayUsageStats { id: string; date?: string; requests?: number; totalDurationMinutes?: number; hourly?: Record<string, any>; featureDurations?: Record<string, number>; [key: string]: any }

const formatDateTime = (value: string) =>
  value ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) : '—';

const formatTimeOnly = (value: string) =>
  value ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '—';

const formatShortDay = (dateStr: string) => {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
};

const formatDateDisplay = (dateStr: string) => {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatDayLabel = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'UTC' }).format(dt);
  return `${weekday}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};

const FEATURE_META: Array<{
  key: 'all' | FeatureBucket;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
  activeBg: string;
  badgeBg: string;
  barColor: string;
  textColor: string;
}> = [
  { key: 'all', label: 'Tất cả tính năng', shortLabel: 'Tất cả', icon: BarChart3, activeBg: 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500/20', badgeBg: 'bg-indigo-100 text-indigo-700', barColor: 'bg-indigo-600', textColor: 'text-indigo-700' },
  { key: 'convert', label: 'Convert LaTeX', shortLabel: 'Convert', icon: FileCode2, activeBg: 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20', badgeBg: 'bg-blue-100 text-blue-700', barColor: 'bg-blue-500', textColor: 'text-blue-700' },
  { key: 'ai', label: 'Trợ lý AI', shortLabel: 'AI', icon: Sparkles, activeBg: 'border-violet-600 bg-violet-50/80 ring-2 ring-violet-500/20', badgeBg: 'bg-violet-100 text-violet-700', barColor: 'bg-violet-500', textColor: 'text-violet-700' },
  { key: 'exam', label: 'Đề thi', shortLabel: 'Đề thi', icon: FileText, activeBg: 'border-amber-600 bg-amber-50/80 ring-2 ring-amber-500/20', badgeBg: 'bg-amber-100 text-amber-700', barColor: 'bg-amber-500', textColor: 'text-amber-700' },
  { key: 'drawing', label: 'Vẽ hình', shortLabel: 'Vẽ hình', icon: PenTool, activeBg: 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20', badgeBg: 'bg-emerald-100 text-emerald-700', barColor: 'bg-emerald-500', textColor: 'text-emerald-700' },
  { key: 'markitdown', label: 'MarkItDown', shortLabel: 'MarkItDown', icon: FileSpreadsheet, activeBg: 'border-rose-600 bg-rose-50/80 ring-2 ring-rose-500/20', badgeBg: 'bg-rose-100 text-rose-700', barColor: 'bg-rose-500', textColor: 'text-rose-700' },
];

const BUCKET_KEYS: FeatureBucket[] = ['convert', 'ai', 'exam', 'drawing', 'markitdown'];

export const AdminAnalyticsDashboard: React.FC<AdminAnalyticsDashboardProps> = () => {
  const to = useMemo(() => vietnamDate(), []);
  const from = useMemo(() => vietnamDate(new Date(Date.now() - 6 * 86400000)), []);
  const [feature, setFeature] = useState<'all' | FeatureBucket>('all');
  const [date, setDate] = useState(to);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState('');
  const readVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++readVersion.current;
    setLoading(true);
    try {
      const res = await authFetch(`/api/activity?from=${from}&to=${to}`);
      const body = await res.json();
      if (version !== readVersion.current) return;
      if (!res.ok) throw Error(body.error);
      setData(body);
      setError('');
      setUpdated(new Date().toISOString());
    } catch (e: any) {
      if (version === readVersion.current) setError(e.message);
    } finally {
      if (version === readVersion.current) setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    setData(null);
    void refresh();
    // Giảm tần suất tự động thăm dò từ 30 giây xuống 5 phút để bảo toàn hạn mức đọc Firebase
    const interval = setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => {
      ++readVersion.current;
      clearInterval(interval);
    };
  }, [refresh]);

  const summary = useMemo(
    () => aggregateDashboardUsage(data?.events || [], { from, to, feature }),
    [data, from, to, feature]
  );

  const selectedDay = useMemo(
    () => summary.days.find(d => d.date === date) || summary.days[summary.days.length - 1],
    [summary.days, date]
  );

  const dailyUsers = useMemo(() => {
    const raw = summary.usersByDate[date] || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return raw;
    return raw.filter(u =>
      String(u.name || '').toLowerCase().includes(q) ||
      String(u.email || '').toLowerCase().includes(q) ||
      String(u.uid || '').toLowerCase().includes(q)
    );
  }, [summary.usersByDate, date, searchQuery]);

  const maxDayCount = useMemo(
    () => Math.max(1, ...summary.days.map(d => d.filteredTotal)),
    [summary.days]
  );

  const exportLog = () => {
    const payload = {
      domain: 'word2latex.io.vn',
      from,
      to,
      featureFilter: feature,
      selectedDate: date,
      totals7Days: summary.totals,
      days: summary.days,
      usersOnSelectedDate: dailyUsers,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `word2latex-usage-${from}-${to}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeFeatureMeta = FEATURE_META.find(f => f.key === feature) || FEATURE_META[0];

  return (
    <section data-testid="analytics-dashboard" className="bg-white/85 backdrop-blur-lg border border-slate-200/80 shadow-sm rounded-3xl p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl text-slate-800 tracking-tight">Dashboard Phân Tích Sử Dụng</h2>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-700 transition disabled:opacity-50 active:scale-95 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            {loading ? 'Đang tải...' : 'Làm mới'}
          </button>
          <button
            type="button"
            onClick={exportLog}
            disabled={!data}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-700 transition disabled:opacity-50 active:scale-95 cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            Xuất báo cáo
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
          {error}. {data ? 'Đang giữ bản đọc trước đó.' : 'Chưa có số liệu.'}
        </p>
      )}
      {data?.warning && (
        <div role="status" className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-2xl text-xs flex items-center justify-between gap-3 shadow-2xs">
          <span className="flex items-center gap-2">
            <span className="text-sm">⚠️</span>
            <span>{data.warning}</span>
          </span>
          {data.isStale && (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full shrink-0">
              Bản lưu đệm
            </span>
          )}
        </div>
      )}
      {data?.truncated && (
        <p role="alert" className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-2xl text-xs">
          Có hơn 5.000 sự kiện trong 7 ngày qua. Số liệu hiển thị đang giới hạn ở 5.000 bản ghi gần nhất.
        </p>
      )}

      {/* 6 KPI Cards kiêm Bộ lọc Tính năng */}
      <div>
        <div className="flex items-center justify-between mb-2 sm:mb-2.5">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
            Tổng hạn mức toàn hệ thống (7 ngày) · Bấm vào thẻ để lọc theo tính năng
          </span>
          {feature !== 'all' && (
            <button
              type="button"
              onClick={() => setFeature('all')}
              className="text-[11px] sm:text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Xóa bộ lọc ({activeFeatureMeta.shortLabel})
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {FEATURE_META.map(item => {
            const Icon = item.icon;
            const isSelected = feature === item.key;
            const total7d = summary.totals[item.key];
            const dayCount = selectedDay ? (item.key === 'all' ? selectedDay.total : selectedDay[item.key]) : 0;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFeature(item.key)}
                data-testid={`feature-filter-${item.key}`}
                className={`text-left rounded-xl sm:rounded-2xl border p-2.5 sm:p-3.5 transition-all cursor-pointer ${
                  isSelected
                    ? item.activeBg
                    : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                  <span className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl ${item.badgeBg}`}>
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400">7 ngày</span>
                </div>
                <div className="mt-1.5 sm:mt-2.5">
                  <strong
                    className={`text-xl sm:text-2xl font-black tracking-tight ${item.textColor}`}
                    data-testid={item.key === 'all' ? 'analytics-success-count' : undefined}
                  >
                    {data ? total7d : '—'}
                  </strong>
                  <p className="text-xs font-bold text-slate-700 mt-0.5 truncate">{item.label}</p>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 truncate">
                    Ngày {date.slice(8, 10)}/{date.slice(5, 7)}: <strong className="text-slate-700">{data ? dayCount : '—'}</strong> lượt
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Biểu đồ cột lịch sử 7 ngày gần nhất */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-800">
              Lịch sử sử dụng 7 ngày gần nhất{feature !== 'all' ? ` (${activeFeatureMeta.label})` : ''}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Bấm vào cột ngày bất kỳ để xem chi tiết ở bảng dưới cùng
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-semibold text-slate-600">
            {FEATURE_META.filter(f => f.key !== 'all').map(f => (
              <span key={f.key} className="inline-flex items-center gap-1 sm:gap-1.5">
                <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-xs sm:rounded-sm ${f.barColor}`} />
                {f.shortLabel}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-3 items-end pt-2 sm:pt-4">
          {summary.days.map(d => {
            const isSelected = d.date === date;
            const heightPct = d.filteredTotal > 0 ? Math.max(12, Math.round((d.filteredTotal / maxDayCount) * 100)) : 4;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => {
                  setDate(d.date);
                  setExpandedUid(null);
                }}
                data-testid={`day-column-${d.date}`}
                className={`group flex flex-col items-center rounded-xl sm:rounded-2xl p-1 sm:p-3 border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-indigo-600 bg-white shadow-sm ring-2 ring-indigo-500/20'
                    : 'border-transparent hover:border-slate-200 hover:bg-white/70'
                }`}
              >
                <span className={`text-[11px] sm:text-sm font-black mb-1 sm:mb-1.5 ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                  {d.filteredTotal}
                </span>
                <div className="w-full h-24 sm:h-36 bg-slate-100 rounded-lg sm:rounded-xl flex flex-col justify-end overflow-hidden p-0.5 sm:p-1">
                  {d.filteredTotal === 0 ? (
                    <div className="w-full h-1 rounded-full bg-slate-200" />
                  ) : feature !== 'all' ? (
                    <div
                      className={`w-full rounded-md sm:rounded-lg transition-all duration-300 ${activeFeatureMeta.barColor}`}
                      style={{ height: `${heightPct}%` }}
                    />
                  ) : (
                    <div
                      className="w-full rounded-md sm:rounded-lg overflow-hidden flex flex-col justify-end transition-all duration-300"
                      style={{ height: `${heightPct}%` }}
                    >
                      {BUCKET_KEYS.map(k => {
                        const val = d[k];
                        if (!val) return null;
                        const segPct = (val / d.total) * 100;
                        const meta = FEATURE_META.find(m => m.key === k)!;
                        return (
                          <div
                            key={k}
                            style={{ height: `${segPct}%` }}
                            className={`w-full ${meta.barColor}`}
                            title={`${meta.label}: ${val} lượt`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
                <span className={`mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-bold text-center block w-full truncate leading-tight ${isSelected ? 'text-indigo-700' : 'text-slate-600'}`}>
                  {formatShortDay(d.date)}
                </span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">
                  {(summary.usersByDate[d.date] || []).length} người
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bảng số lượt sử dụng của từng người trong ngày được chọn */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                Ngày {formatDateDisplay(date)}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Có <strong className="text-slate-700">{dailyUsers.length}</strong> người dùng phát sinh hạn mức{feature !== 'all' ? ` (${activeFeatureMeta.label.toLowerCase()})` : ''} trên web
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm tên, email, UID..."
              aria-label="Tìm người dùng trong ngày"
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 sm:py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
          <table data-testid="activity-table" className="w-full min-w-[780px] text-sm text-left border-collapse">
            <thead className="bg-slate-50/90 text-xs font-bold uppercase text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="p-3.5">Người dùng</th>
                <th className="p-3.5 text-center">Convert</th>
                <th className="p-3.5 text-center">AI</th>
                <th className="p-3.5 text-center">Đề thi</th>
                <th className="p-3.5 text-center">Vẽ hình</th>
                <th className="p-3.5 text-center">MarkItDown</th>
                <th className="p-3.5 text-center">Tổng lượt</th>
                <th className="p-3.5 text-right">Hoạt động cuối</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dailyUsers.map((u: any) => {
                const isExpanded = expandedUid === u.uid;
                return (
                  <React.Fragment key={u.uid}>
                    <tr
                      onClick={() => setExpandedUid(isExpanded ? null : u.uid)}
                      data-testid={`user-usage-row-${u.uid}`}
                      className="hover:bg-indigo-50/40 transition cursor-pointer"
                    >
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-slate-400">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4" />}
                          </span>
                          <div>
                            <strong className="font-bold text-slate-800">{u.name}</strong>
                            <div className="text-xs text-slate-500">
                              {u.email ? `${u.email} · ` : ''}<span className="font-mono text-[11px] text-slate-400">{u.uid}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block min-w-[2rem] px-2 py-0.5 rounded-lg text-xs font-bold ${u.convert ? 'bg-blue-50 text-blue-700' : 'text-slate-300'}`}>
                          {u.convert}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block min-w-[2rem] px-2 py-0.5 rounded-lg text-xs font-bold ${u.ai ? 'bg-violet-50 text-violet-700' : 'text-slate-300'}`}>
                          {u.ai}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block min-w-[2rem] px-2 py-0.5 rounded-lg text-xs font-bold ${u.exam ? 'bg-amber-50 text-amber-700' : 'text-slate-300'}`}>
                          {u.exam}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block min-w-[2rem] px-2 py-0.5 rounded-lg text-xs font-bold ${u.drawing ? 'bg-emerald-50 text-emerald-700' : 'text-slate-300'}`}>
                          {u.drawing}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-block min-w-[2rem] px-2 py-0.5 rounded-lg text-xs font-bold ${u.markitdown ? 'bg-rose-50 text-rose-700' : 'text-slate-300'}`}>
                          {u.markitdown}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="inline-block min-w-[2.25rem] px-2.5 py-1 rounded-xl bg-indigo-600 text-white text-xs font-black">
                          {feature === 'all' ? u.total : u.filteredTotal}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap text-xs font-medium text-slate-600">
                        {formatTimeOnly(u.lastActiveAt)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={8} className="px-6 py-3.5">
                          <div className="text-xs font-bold text-slate-600 mb-2">
                            Chi tiết các lượt sử dụng trong ngày {date} của {u.name} ({u.events.length} lượt):
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {u.events.map((ev: any) => {
                              const meta = FEATURE_META.find(m => m.key === ev.bucket) || FEATURE_META[0];
                              return (
                                <div
                                  key={ev.id}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-2xs"
                                >
                                  <span className="font-mono font-semibold text-slate-500">{formatTimeOnly(ev.occurredAt)}</span>
                                  <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${meta.badgeBg}`}>
                                    {meta.shortLabel}
                                  </span>
                                  <span className="text-slate-700">{ev.action}</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {!dailyUsers.length && (
            <div className="text-center py-10 text-sm text-slate-500">
              Chưa có người dùng nào sử dụng tính năng ({activeFeatureMeta.label.toLowerCase()}) trên word2latex.io.vn trong ngày {date}.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

