import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Layers,
  PenTool,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import { authFetch } from '../utils/api-client';
import { aggregateDashboardUsage, FeatureBucket, vietnamDate } from '../../shared/activity';

export interface AdminAnalyticsDashboardProps { allUsers?: any[] }
export interface DayUsageStats { id: string; date?: string; requests?: number; totalDurationMinutes?: number; hourly?: Record<string, any>; featureDurations?: Record<string, number>; [key: string]: any }

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

const getInitials = (name?: string, email?: string) => {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return 'ND';
};

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
];

const getAvatarStyle = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};

const FEATURE_META: Array<{
  key: 'all' | FeatureBucket;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
  activeCard: string;
  badgeBg: string;
  barColor: string;
  textColor: string;
  accentGradient: string;
}> = [
  {
    key: 'all',
    label: 'Tất cả tính năng',
    shortLabel: 'Tất cả',
    icon: BarChart3,
    activeCard: 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20 shadow-sm',
    badgeBg: 'bg-indigo-100/90 text-indigo-700',
    barColor: 'bg-indigo-600',
    textColor: 'text-indigo-700',
    accentGradient: 'from-indigo-500 to-indigo-600',
  },
  {
    key: 'convert',
    label: 'Convert LaTeX',
    shortLabel: 'Convert',
    icon: FileCode2,
    activeCard: 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-sm',
    badgeBg: 'bg-blue-100/90 text-blue-700',
    barColor: 'bg-blue-500',
    textColor: 'text-blue-700',
    accentGradient: 'from-blue-500 to-blue-600',
  },
  {
    key: 'ai',
    label: 'Trợ lý AI',
    shortLabel: 'AI',
    icon: Sparkles,
    activeCard: 'border-violet-600 bg-violet-50/60 ring-2 ring-violet-500/20 shadow-sm',
    badgeBg: 'bg-violet-100/90 text-violet-700',
    barColor: 'bg-violet-500',
    textColor: 'text-violet-700',
    accentGradient: 'from-violet-500 to-violet-600',
  },
  {
    key: 'exam',
    label: 'Đề thi',
    shortLabel: 'Đề thi',
    icon: FileText,
    activeCard: 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20 shadow-sm',
    badgeBg: 'bg-amber-100/90 text-amber-700',
    barColor: 'bg-amber-500',
    textColor: 'text-amber-700',
    accentGradient: 'from-amber-500 to-amber-600',
  },
  {
    key: 'drawing',
    label: 'Vẽ hình',
    shortLabel: 'Vẽ hình',
    icon: PenTool,
    activeCard: 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-sm',
    badgeBg: 'bg-emerald-100/90 text-emerald-700',
    barColor: 'bg-emerald-500',
    textColor: 'text-emerald-700',
    accentGradient: 'from-emerald-500 to-emerald-600',
  },
  {
    key: 'markitdown',
    label: 'MarkItDown',
    shortLabel: 'MarkItDown',
    icon: FileSpreadsheet,
    activeCard: 'border-rose-600 bg-rose-50/60 ring-2 ring-rose-500/20 shadow-sm',
    badgeBg: 'bg-rose-100/90 text-rose-700',
    barColor: 'bg-rose-500',
    textColor: 'text-rose-700',
    accentGradient: 'from-rose-500 to-rose-600',
  },
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
  const [, setUpdated] = useState('');
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
    <section
      data-testid="analytics-dashboard"
      className="bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-sm rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 lg:p-7 space-y-4 sm:space-y-6 min-w-0"
    >
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-100 pb-4 sm:pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-100 shrink-0">
            <BarChart3 className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-extrabold text-base sm:text-xl text-slate-800 tracking-tight">
                Dashboard Phân Tích Sử Dụng
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live 7 ngày
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Chu kỳ: <strong>{formatDateDisplay(from)}</strong> — <strong>{formatDateDisplay(to)}</strong></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end shrink-0">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-700 transition shadow-2xs hover:border-slate-300 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            <span>{loading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
          <button
            type="button"
            onClick={exportLog}
            disabled={!data}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-700 transition shadow-2xs hover:border-slate-300 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Xuất JSON</span>
          </button>
        </div>
      </div>

      {/* Alerts & Notifications */}
      {error && (
        <div role="alert" className="flex items-center gap-3 bg-red-50/90 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs sm:text-sm">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span>{error}. {data ? 'Đang hiển thị bản đọc trước đó.' : 'Chưa có dữ liệu.'}</span>
        </div>
      )}
      {data?.warning && (
        <div role="status" className="bg-amber-50/90 border border-amber-200/80 text-amber-800 px-4 py-3 rounded-2xl text-xs flex items-center justify-between gap-3 shadow-2xs">
          <span className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
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
        <div role="alert" className="bg-amber-50/80 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-2xl text-xs">
          Số lượng sự kiện vượt quá 5.000 bản ghi trong 7 ngày qua. Đang hiển thị 5.000 hoạt động gần nhất.
        </div>
      )}

      {/* 2. 6 KPI Cards & Feature Filter Tabs */}
      <div>
        {feature !== 'all' && (
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => setFeature('all')}
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition"
            >
              <span>Xem tất cả ({activeFeatureMeta.shortLabel})</span>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex sm:grid overflow-x-auto sm:overflow-visible pb-1.5 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 snap-x">
          {FEATURE_META.map(item => {
            const Icon = item.icon;
            const isSelected = feature === item.key;
            const total7d = summary.totals[item.key] || 0;
            const totalAll = summary.totals.all || 0;
            const sharePct = totalAll > 0 && item.key !== 'all' ? Math.round((total7d / totalAll) * 100) : null;
            const dayCount = selectedDay ? (item.key === 'all' ? selectedDay.total : (selectedDay[item.key] || 0)) : 0;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFeature(item.key)}
                data-testid={`feature-filter-${item.key}`}
                className={`relative text-left rounded-2xl border p-3 sm:p-3.5 transition-all duration-200 cursor-pointer overflow-hidden min-w-[155px] sm:min-w-0 shrink-0 sm:shrink snap-start ${
                  isSelected
                    ? item.activeCard
                    : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
                }`}
              >
                {/* Active accent top bar */}
                {isSelected && (
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${item.accentGradient}`} />
                )}

                <div className="flex items-center justify-between gap-1.5">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl ${item.badgeBg}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  {sharePct !== null ? (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100/90 px-1.5 py-0.5 rounded-md">
                      {sharePct}%
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-400">7 ngày</span>
                  )}
                </div>

                <div className="mt-2.5">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <strong
                      className={`text-xl sm:text-2xl font-black tracking-tight ${item.textColor}`}
                      data-testid={item.key === 'all' ? 'analytics-success-count' : undefined}
                    >
                      {data ? total7d.toLocaleString('vi-VN') : '—'}
                    </strong>
                    <span className="text-xs font-bold text-slate-700 truncate">{item.label}</span>
                  </div>
                  
                  {/* Subtle day count badge */}
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="truncate">{formatShortDay(date)}:</span>
                    <strong className="text-slate-700 font-bold ml-1">{data ? dayCount : '—'}</strong>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Stacked Bar Chart Section (Lịch sử 7 ngày) */}
      <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/60 to-white p-3.5 sm:p-5 shadow-2xs">
        {/* 7 Columns Grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-3 items-end">
          {summary.days.map(d => {
            const isSelected = d.date === date;
            const heightPct = d.filteredTotal > 0 ? Math.max(14, Math.round((d.filteredTotal / maxDayCount) * 100)) : 4;
            const userCount = (summary.usersByDate[d.date] || []).length;

            return (
              <button
                key={d.date}
                type="button"
                onClick={() => {
                  setDate(d.date);
                  setExpandedUid(null);
                }}
                data-testid={`day-column-${d.date}`}
                className={`group flex flex-col items-center rounded-2xl p-1.5 sm:p-3 border transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'border-indigo-600 bg-white shadow-md ring-2 ring-indigo-500/20'
                    : 'border-transparent hover:border-slate-200 hover:bg-white/80'
                }`}
              >
                {/* Number on top */}
                <span className={`text-xs sm:text-sm font-black mb-1.5 sm:mb-2 transition-colors ${isSelected ? 'text-indigo-600 font-extrabold scale-105' : 'text-slate-700'}`}>
                  {d.filteredTotal}
                </span>

                {/* Column groove */}
                <div className="w-full h-28 sm:h-40 bg-slate-100/90 rounded-xl flex flex-col justify-end overflow-hidden p-0.5 sm:p-1 relative">
                  {d.filteredTotal === 0 ? (
                    <div className="w-full h-1.5 rounded-full bg-slate-300/80 my-auto" />
                  ) : feature !== 'all' ? (
                    <div
                      className={`w-full rounded-lg transition-all duration-300 ${activeFeatureMeta.barColor}`}
                      style={{ height: `${heightPct}%` }}
                    />
                  ) : (
                    <div
                      className="w-full rounded-lg overflow-hidden flex flex-col justify-end transition-all duration-300"
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
                            className={`w-full ${meta.barColor} transition-all`}
                            title={`${meta.label}: ${val} lượt`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Date Label */}
                <div className="mt-2 text-center w-full">
                  <span
                    className={`inline-block text-[10px] sm:text-xs font-bold leading-tight px-1.5 py-0.5 rounded-md ${
                      isSelected ? 'bg-indigo-50 text-indigo-700 font-extrabold' : 'text-slate-600'
                    }`}
                  >
                    {formatShortDay(d.date)}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 font-medium truncate">
                    {userCount} ng
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. User Activity Table & Micro-Timeline */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                  Chi tiết ngày {formatDayLabel(date)}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                  {dailyUsers.length} người dùng
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Phát sinh hạn mức{feature !== 'all' ? ` cho tính năng ${activeFeatureMeta.label.toLowerCase()}` : ' toàn hệ thống'}
              </p>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm tên, email hoặc UID..."
              aria-label="Tìm người dùng trong ngày"
              className="w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-8 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
          <table data-testid="activity-table" className="w-full min-w-[780px] text-sm text-left border-collapse">
            <thead className="bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Người dùng</th>
                <th className="py-3 px-3 text-center">Convert</th>
                <th className="py-3 px-3 text-center">AI</th>
                <th className="py-3 px-3 text-center">Đề thi</th>
                <th className="py-3 px-3 text-center">Vẽ hình</th>
                <th className="py-3 px-3 text-center">MarkItDown</th>
                <th className="py-3 px-3 text-center">Tổng lượt</th>
                <th className="py-3 px-4 text-right">Hoạt động cuối</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dailyUsers.map((u: any) => {
                const isExpanded = expandedUid === u.uid;
                const totalCount = feature === 'all' ? u.total : u.filteredTotal;
                const initials = getInitials(u.name, u.email);
                const avatarStyle = getAvatarStyle(u.uid || u.email || 'user');

                return (
                  <React.Fragment key={u.uid}>
                    <tr
                      onClick={() => setExpandedUid(isExpanded ? null : u.uid)}
                      data-testid={`user-usage-row-${u.uid}`}
                      className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                    >
                      {/* User Cell */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${isExpanded ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </span>
                          
                          {/* Avatar Badge */}
                          <div className={`w-8 h-8 rounded-xl border flex items-center justify-center text-xs font-black shrink-0 ${avatarStyle}`}>
                            {initials}
                          </div>

                          <div className="min-w-0">
                            <strong className="font-bold text-slate-800 text-xs sm:text-sm block truncate">
                              {u.name || 'Người dùng ẩn danh'}
                            </strong>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                              {u.email && <span>{u.email}</span>}
                              {u.email && <span className="text-slate-300">·</span>}
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-1 py-0.2 rounded">
                                {u.uid.slice(0, 10)}…
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Convert */}
                      <td className="py-3 px-3 text-center">
                        {u.convert ? (
                          <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                            {u.convert}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>

                      {/* AI */}
                      <td className="py-3 px-3 text-center">
                        {u.ai ? (
                          <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg text-xs font-bold bg-violet-50 text-violet-700 border border-violet-100">
                            {u.ai}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>

                      {/* Exam */}
                      <td className="py-3 px-3 text-center">
                        {u.exam ? (
                          <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                            {u.exam}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>

                      {/* Drawing */}
                      <td className="py-3 px-3 text-center">
                        {u.drawing ? (
                          <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            {u.drawing}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>

                      {/* MarkItDown */}
                      <td className="py-3 px-3 text-center">
                        {u.markitdown ? (
                          <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100">
                            {u.markitdown}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2.25rem] px-2.5 py-1 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-black shadow-2xs">
                          {totalCount}
                        </span>
                      </td>

                      {/* Last Active */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 font-mono bg-slate-50 px-2 py-0.5 rounded-md">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatTimeOnly(u.lastActiveAt)}
                        </span>
                      </td>
                    </tr>

                    {/* Expanded Micro-Timeline View */}
                    {isExpanded && (
                      <tr className="bg-slate-50/70 border-y border-slate-200/60">
                        <td colSpan={8} className="p-4 sm:p-5">
                          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs">
                            <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
                              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                <span>Lịch sử chi tiết ngày {formatDateDisplay(date)} của <strong>{u.name}</strong></span>
                              </span>
                              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                                {u.events.length} thao tác
                              </span>
                            </div>

                            {/* Event list formatted as clean micro-timeline */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                              {u.events.map((ev: any) => {
                                const meta = FEATURE_META.find(m => m.key === ev.bucket) || FEATURE_META[0];
                                const MetaIcon = meta.icon;
                                return (
                                  <div
                                    key={ev.id}
                                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 p-2.5 text-xs transition-colors"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${meta.badgeBg}`}>
                                        <MetaIcon className="w-3 h-3" />
                                      </span>
                                      <span className="font-semibold text-slate-700 truncate text-[11px]" title={ev.action}>
                                        {ev.action}
                                      </span>
                                    </div>
                                    <span className="font-mono text-[10px] text-slate-400 font-semibold bg-white border border-slate-200/70 px-1.5 py-0.5 rounded shrink-0">
                                      {formatTimeOnly(ev.occurredAt)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile User Card List (< md) */}
        <div className="md:hidden space-y-2.5">
          {dailyUsers.map((u: any) => {
            const isExpanded = expandedUid === u.uid;
            const totalCount = feature === 'all' ? u.total : u.filteredTotal;
            const initials = getInitials(u.name, u.email);
            const avatarStyle = getAvatarStyle(u.uid || u.email || 'user');
            const usedBuckets = BUCKET_KEYS.filter(k => (u[k] || 0) > 0);

            return (
              <div
                key={`mobile-${u.uid}`}
                onClick={() => setExpandedUid(isExpanded ? null : u.uid)}
                data-testid={`user-usage-card-${u.uid}`}
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-2xs overflow-hidden cursor-pointer ${
                  isExpanded ? 'border-indigo-400 ring-2 ring-indigo-500/15' : 'border-slate-200/90 active:bg-slate-50'
                }`}
              >
                {/* Header row: Avatar + Name + Total + Chevron */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs font-black shrink-0 ${avatarStyle}`}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <strong className="font-bold text-slate-800 text-xs sm:text-sm block truncate">
                        {u.name || 'Người dùng ẩn danh'}
                      </strong>
                      <div className="text-[11px] text-slate-400 truncate">
                        {u.email || u.uid}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-black shadow-2xs">
                      {totalCount} lượt
                    </span>
                    <span className="text-slate-400">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                  </div>
                </div>

                {/* Sub-row: Active feature tags + Last active */}
                <div className="px-3.5 pb-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 pt-2 text-[11px]">
                  <div className="flex flex-wrap gap-1 items-center">
                    {usedBuckets.length > 0 ? (
                      usedBuckets.map(k => {
                        const meta = FEATURE_META.find(m => m.key === k)!;
                        return (
                          <span
                            key={k}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] ${meta.badgeBg}`}
                          >
                            <span>{meta.shortLabel}:</span>
                            <span className="font-black">{u[k]}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-slate-400 text-[10px]">Chưa phát sinh lượt</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {formatTimeOnly(u.lastActiveAt)}
                  </span>
                </div>

                {/* Expanded Micro-Timeline on Mobile */}
                {isExpanded && (
                  <div className="bg-slate-50/80 border-t border-slate-200/70 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1 border-b border-slate-200/50">
                      <span>Lịch sử thao tác ({u.events.length} lượt)</span>
                    </div>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                      {u.events.map((ev: any) => {
                        const meta = FEATURE_META.find(m => m.key === ev.bucket) || FEATURE_META[0];
                        const MetaIcon = meta.icon;
                        return (
                          <div
                            key={ev.id}
                            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-white p-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${meta.badgeBg}`}>
                                <MetaIcon className="w-2.5 h-2.5" />
                              </span>
                              <span className="font-semibold text-slate-700 truncate text-[11px]">
                                {ev.action}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-400 font-semibold bg-slate-50 border border-slate-200/50 px-1.5 py-0.5 rounded shrink-0">
                              {formatTimeOnly(ev.occurredAt)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {!dailyUsers.length && (
          <div className="rounded-2xl border border-slate-200/90 bg-white text-center py-12 px-4 shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2.5">
              <Search className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-slate-700">Không tìm thấy người dùng</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Chưa có người dùng nào sử dụng tính năng ({activeFeatureMeta.label.toLowerCase()}) trên word2latex.io.vn trong ngày {formatDateDisplay(date)}.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
