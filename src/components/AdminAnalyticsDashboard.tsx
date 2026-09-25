import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Clock,
  Zap,
  TrendingUp,
  Calendar,
  Download,
  RefreshCw,
  Sparkles,
  Layers,
  ChevronRight,
  Sun,
  Moon,
  Sunset,
  Sunrise,
  CheckCircle2,
  FileSpreadsheet,
  FileCode,
  Flame,
  Activity,
  ArrowUpRight,
  CloudUpload
} from 'lucide-react';
import { authFetch } from '../utils/api-client';
import { db, auth } from '../firebase';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { DEFAULT_SEED_STATS } from '../utils/seed-stats';

export interface DayUsageStats {
  id: string;
  date?: string;
  timestamp?: string;
  requests?: number;
  totalDurationMinutes?: number;
  hourly?: Record<string, { requests: number; durationMinutes: number }>;
  featureDurations?: Record<string, number>;
  [key: string]: any;
}

const FEATURE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  "Chuyển đổi LaTeX": { bg: "bg-blue-50 text-blue-700 border-blue-200", text: "text-blue-600", bar: "bg-blue-500" },
  "Soạn đề thi (AI)": { bg: "bg-purple-50 text-purple-700 border-purple-200", text: "text-purple-600", bar: "bg-purple-500" },
  "MarkItDown AI": { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "text-emerald-600", bar: "bg-emerald-500" },
  "AI canvas": { bg: "bg-amber-50 text-amber-700 border-amber-200", text: "text-amber-600", bar: "bg-amber-500" },
  "AI Canvas": { bg: "bg-amber-50 text-amber-700 border-amber-200", text: "text-amber-600", bar: "bg-amber-500" },
  "Dán AI": { bg: "bg-indigo-50 text-indigo-700 border-indigo-200", text: "text-indigo-600", bar: "bg-indigo-500" },
  "AI hỏi đáp": { bg: "bg-rose-50 text-rose-700 border-rose-200", text: "text-rose-600", bar: "bg-rose-500" },
  "AI thay thế số liệu": { bg: "bg-teal-50 text-teal-700 border-teal-200", text: "text-teal-600", bar: "bg-teal-500" },
  "Trích xuất văn bản": { bg: "bg-cyan-50 text-cyan-700 border-cyan-200", text: "text-cyan-600", bar: "bg-cyan-500" }
};

const DEFAULT_COLOR = { bg: "bg-slate-50 text-slate-700 border-slate-200", text: "text-slate-600", bar: "bg-slate-500" };

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0 phút";
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}p` : `${hours} giờ`;
}

function getPeriodIcon(hour: number) {
  if (hour >= 0 && hour < 6) return <Moon className="w-3 h-3 text-indigo-400" />;
  if (hour >= 6 && hour < 12) return <Sunrise className="w-3 h-3 text-amber-500" />;
  if (hour >= 12 && hour < 18) return <Sun className="w-3 h-3 text-yellow-500" />;
  return <Sunset className="w-3 h-3 text-purple-400" />;
}

export const AdminAnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<DayUsageStats[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [chartMetric, setChartMetric] = useState<'requests' | 'duration'>('requests');
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);

  // Fetch usage stats
  const fetchStats = async (forceSyncToCloud = false) => {
    try {
      setLoading(true);

      // 1. Khởi tạo 7 ngày gần nhất (theo múi giờ Việt Nam)
      const sevenDaysMap = new Map<string, DayUsageStats>();
      const now = new Date();

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(d);

        const hourly: Record<string, { requests: number; durationMinutes: number }> = {};
        for (let h = 0; h < 24; h++) {
          hourly[String(h).padStart(2, '0')] = { requests: 0, durationMinutes: 0 };
        }

        // Ưu tiên nạp dữ liệu từ Seed data đã tích lũy (đảm bảo không bao giờ bị rỗng 0)
        const seedItem = (DEFAULT_SEED_STATS as any)[dateStr];

        sevenDaysMap.set(dateStr, {
          id: dateStr,
          date: dateStr,
          timestamp: seedItem?.timestamp || d.toISOString(),
          requests: seedItem?.requests || 0,
          totalDurationMinutes: seedItem?.totalDurationMinutes || 0,
          hourly: seedItem?.hourly ? { ...hourly, ...seedItem.hourly } : hourly,
          featureDurations: seedItem?.featureDurations || {}
        });
      }

      // 2. Truy vấn trực tiếp từ Firebase Cloud Firestore Client SDK
      let hasCloudData = false;
      if (db) {
        try {
          const statsCol = collection(db, 'api_usage_stats');
          const snapshot = await getDocs(statsCol);
          if (!snapshot.empty) {
            snapshot.docs.forEach(docSnap => {
              const item = docSnap.data() as any;
              const key = item.date || docSnap.id;
              if (sevenDaysMap.has(key)) {
                hasCloudData = true;
                const existing = sevenDaysMap.get(key)!;
                sevenDaysMap.set(key, {
                  ...existing,
                  ...item,
                  requests: item.requests !== undefined ? Number(item.requests) : existing.requests,
                  totalDurationMinutes: item.totalDurationMinutes !== undefined ? Number(item.totalDurationMinutes) : existing.totalDurationMinutes,
                  hourly: {
                    ...existing.hourly,
                    ...(item.hourly || {})
                  },
                  featureDurations: {
                    ...existing.featureDurations,
                    ...(item.featureDurations || {})
                  }
                });
              }
            });
          }
        } catch (fsErr) {
          console.warn("[Dashboard] Lỗi khi truy vấn Firestore trực tiếp:", fsErr);
        }
      }

      // 3. Fallback thêm từ API backend nếu có
      try {
        const res = await authFetch('/api/ai?action=get-usage-stats', {
          method: 'POST'
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.stats) && data.stats.length > 0) {
            data.stats.forEach((item: any) => {
              const key = item.date || item.id;
              if (sevenDaysMap.has(key)) {
                const existing = sevenDaysMap.get(key)!;
                sevenDaysMap.set(key, {
                  ...existing,
                  ...item,
                  requests: Math.max(Number(item.requests) || 0, existing.requests || 0),
                  totalDurationMinutes: Math.max(Number(item.totalDurationMinutes) || 0, existing.totalDurationMinutes || 0),
                  hourly: {
                    ...existing.hourly,
                    ...(item.hourly || {})
                  },
                  featureDurations: {
                    ...existing.featureDurations,
                    ...(item.featureDurations || {})
                  }
                });
              }
            });
          }
        }
      } catch (apiErr) {
        // bỏ qua fallback api
      }

      // 4. Tự động đồng bộ lên Firebase Cloud Firestore nếu là Admin/Owner và chưa có trên Cloud (hoặc được yêu cầu)
      const currentUserEmail = auth?.currentUser?.email?.toLowerCase().trim();
      const isOwner = currentUserEmail === "giathieu110406@gmail.com";
      if (isOwner && db && (!hasCloudData || forceSyncToCloud)) {
        try {
          setIsSyncingCloud(true);
          for (const [dateStr, dayData] of sevenDaysMap.entries()) {
            if (dayData.requests > 0) {
              const docRef = doc(db, 'api_usage_stats', dateStr);
              await setDoc(docRef, dayData, { merge: true });
            }
          }
          if (forceSyncToCloud) {
            setExportNotice("Đã đồng bộ toàn bộ dữ liệu 7 ngày lên Cloud Firestore thành công!");
            setTimeout(() => setExportNotice(null), 4000);
          }
        } catch (syncErr) {
          console.warn("[Dashboard] Lỗi khi đồng bộ Firestore:", syncErr);
        } finally {
          setIsSyncingCloud(false);
        }
      }

      const sortedStats = Array.from(sevenDaysMap.values());
      sortedStats.sort((a, b) => (a.date || a.id).localeCompare(b.date || b.id));
      setStats(sortedStats);

      // Chọn ngày cuối cùng (hôm nay)
      if (sortedStats.length > 0) {
        const todayStr = sortedStats[sortedStats.length - 1].date || sortedStats[sortedStats.length - 1].id;
        setSelectedDate(prev => prev || todayStr);
      }
    } catch (err) {
      console.error("Failed to load usage stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Currently selected day stats
  const activeDayStats = useMemo(() => {
    if (!stats.length) return null;
    return stats.find(s => (s.date || s.id) === selectedDate) || stats[stats.length - 1];
  }, [stats, selectedDate]);

  // Overall calculations for the selected day
  const metrics = useMemo(() => {
    if (!activeDayStats) {
      return {
        totalRequests: 0,
        totalDuration: 0,
        peakHourStr: '--',
        peakHourRequests: 0,
        topFeatureName: 'Chưa có',
        topFeatureCount: 0,
        featureBreakdown: []
      };
    }

    const hourly = activeDayStats.hourly || {};
    let peakH = 0;
    let maxHourlyVal = 0;

    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      const val = chartMetric === 'requests'
        ? (hourly[hh]?.requests || 0)
        : (hourly[hh]?.durationMinutes || 0);

      if (val > maxHourlyVal) {
        maxHourlyVal = val;
        peakH = h;
      }
    }

    // Top features
    const featureMap: Record<string, { requests: number; duration: number }> = {};
    const excludedKeys = new Set(['id', 'date', 'timestamp', 'requests', 'totalDurationMinutes', 'hourly', 'featureDurations']);

    // Check direct feature keys
    Object.keys(activeDayStats).forEach(k => {
      if (!excludedKeys.has(k) && typeof activeDayStats[k] === 'number') {
        if (!featureMap[k]) featureMap[k] = { requests: 0, duration: 0 };
        featureMap[k].requests += activeDayStats[k];
      }
    });

    // Check featureDurations map
    if (activeDayStats.featureDurations) {
      Object.keys(activeDayStats.featureDurations).forEach(k => {
        if (!featureMap[k]) featureMap[k] = { requests: 0, duration: 0 };
        featureMap[k].duration += activeDayStats.featureDurations[k] || 0;
      });
    }

    const featureList = Object.keys(featureMap).map(name => ({
      name,
      requests: featureMap[name].requests,
      duration: featureMap[name].duration
    })).filter(f => f.requests > 0 || f.duration > 0);

    featureList.sort((a, b) => b.requests - a.requests || b.duration - a.duration);

    const topFeature = featureList[0];

    return {
      totalRequests: activeDayStats.requests || 0,
      totalDuration: activeDayStats.totalDurationMinutes || 0,
      peakHourStr: maxHourlyVal > 0 ? `${String(peakH).padStart(2, '0')}:00 - ${String(peakH + 1).padStart(2, '0')}:00` : 'Không có lưu lượng',
      peakHourRequests: maxHourlyVal,
      topFeatureName: topFeature ? topFeature.name : 'Chưa có',
      topFeatureCount: topFeature ? topFeature.requests : 0,
      featureBreakdown: featureList
    };
  }, [activeDayStats, chartMetric]);

  // Hourly max value for scaling chart
  const maxHourlyInDay = useMemo(() => {
    if (!activeDayStats || !activeDayStats.hourly) return 1;
    let max = 1;
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      const val = chartMetric === 'requests'
        ? (activeDayStats.hourly[hh]?.requests || 0)
        : (activeDayStats.hourly[hh]?.durationMinutes || 0);
      if (val > max) max = val;
    }
    return max;
  }, [activeDayStats, chartMetric]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!stats.length) return;
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Ngày,Tổng lượt sử dụng,Tổng thời gian (phút),Khung giờ,Lượt giờ này,Thời lượng giờ này (phút)\n';

    stats.forEach(day => {
      const d = day.date || day.id;
      const totalReq = day.requests || 0;
      const totalDur = day.totalDurationMinutes || 0;
      for (let h = 0; h < 24; h++) {
        const hh = String(h).padStart(2, '0');
        const hData = day.hourly ? day.hourly[hh] : null;
        const req = hData ? hData.requests : 0;
        const dur = hData ? hData.durationMinutes : 0;
        csvContent += `"${d}",${totalReq},${totalDur},"${hh}:00",${req},${dur}\n`;
      }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `word2latex_usage_stats_7days_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportNotice('Đã xuất tệp CSV báo cáo 7 ngày thành công!');
    setTimeout(() => setExportNotice(null), 3500);
  };

  // Export to JSON
  const handleExportJSON = () => {
    if (!stats.length) return;
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(stats, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `word2latex_usage_stats_7days_${selectedDate}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportNotice('Đã xuất tệp JSON cấu trúc dữ liệu thành công!');
    setTimeout(() => setExportNotice(null), 3500);
  };

  return (
    <div className="bg-white/75 backdrop-blur-xl border border-white/60 shadow-[0_12px_45px_rgba(120,120,180,.08)] rounded-[28px] p-4 sm:p-6 lg:p-8 flex-1 flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-indigo-200 text-white">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-800 font-sans">
                Dashboard Phân Tích Sử Dụng
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                0h - 24h & 7 Ngày
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Phân tích khung giờ cao điểm trong ngày và lưu trữ lịch sử sử dụng các tính năng hệ thống.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {exportNotice && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{exportNotice}</span>
            </div>
          )}

          <button
            onClick={() => fetchStats(false)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="Làm mới số liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={() => fetchStats(true)}
            disabled={loading || isSyncingCloud}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="Đồng bộ lưu trữ dữ liệu 7 ngày lên Firebase Cloud Firestore vĩnh viễn"
          >
            <CloudUpload className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-bounce text-amber-600' : 'text-amber-600'}`} />
            <span>{isSyncingCloud ? 'Đang lưu...' : 'Lưu Cloud Firestore'}</span>
          </button>

          <div className="flex items-center bg-white border border-slate-200/80 rounded-xl p-0.5 shadow-xs">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
              title="Xuất bảng dữ liệu CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất CSV</span>
            </button>
            <div className="w-px h-4 bg-slate-200 my-auto"></div>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
              title="Xuất dữ liệu thô JSON"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-600" />
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* 7-Day Date Selector Row */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Chọn ngày phân tích (7 ngày gần nhất):
          </span>
          <span className="text-[11px] font-semibold text-slate-400">
            Múi giờ chuẩn: Việt Nam (GMT+7)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {stats.map((day, idx) => {
            const isToday = idx === stats.length - 1;
            const isSelected = (day.date || day.id) === selectedDate;
            const dayParts = (day.date || day.id).split('-');
            const displayDate = dayParts.length === 3 ? `${dayParts[2]}/${dayParts[1]}` : day.id;

            // Day of week in Vietnamese
            const dateObj = new Date(day.date || day.id);
            const daysOfWeek = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
            const dayName = isToday ? 'Hôm nay' : daysOfWeek[dateObj.getDay()];

            return (
              <button
                key={day.id}
                onClick={() => setSelectedDate(day.date || day.id)}
                className={`p-3 rounded-2xl flex flex-col text-left transition-all border cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 text-white border-indigo-600 shadow-lg shadow-indigo-500/20 scale-[1.02]'
                    : 'bg-white hover:bg-slate-50/80 text-slate-700 border-slate-200/80 hover:border-indigo-200 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={`text-[11px] font-black uppercase tracking-wider ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {dayName}
                  </span>
                  {isToday && (
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                      LIVE
                    </span>
                  )}
                </div>

                <div className="text-base font-black tracking-tight">{displayDate}</div>

                <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-between text-[11px] font-semibold">
                  <span className={isSelected ? 'text-indigo-100' : 'text-slate-500'}>
                    {day.requests || 0} lượt
                  </span>
                  <span className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {formatDuration(day.totalDurationMinutes || 0)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng lượt gọi */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Tổng Lượt Sử Dụng</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-800">
              {metrics.totalRequests.toLocaleString('vi-VN')}
              <span className="text-xs text-slate-400 font-bold ml-1">lượt</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Ghi nhận trên toàn hệ thống trong ngày {selectedDate}
            </p>
          </div>
        </div>

        {/* Card 2: Thời lượng tương tác */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Thời Gian Hoạt Động</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-800">
              {formatDuration(metrics.totalDuration)}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Tổng thời lượng người dùng thao tác thực tế
            </p>
          </div>
        </div>

        {/* Card 3: Khung giờ cao điểm */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Giờ Cao Điểm (Peak)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 truncate" title={metrics.peakHourStr}>
              {metrics.peakHourStr}
            </div>
            <p className="text-[11px] text-amber-700 font-medium mt-1">
              Đạt đỉnh: <span className="font-bold">{metrics.peakHourRequests}</span> {chartMetric === 'requests' ? 'lượt gọi' : 'phút'}
            </p>
          </div>
        </div>

        {/* Card 4: Tính năng thịnh hành nhất */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Tính Năng Hàng Đầu</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-xl font-black text-slate-800 truncate" title={metrics.topFeatureName}>
              {metrics.topFeatureName}
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">
              Dẫn đầu với <span className="font-bold">{metrics.topFeatureCount}</span> lượt sử dụng
            </p>
          </div>
        </div>
      </div>

      {/* 24-Hour Timeline Section */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
        {/* Subheader with chart metric switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Biểu Đồ Phân Phối Hoạt Động 24 Giờ (00:00 - 23:59)
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Rà soát mật độ thao tác theo từng khung giờ trong ngày {selectedDate}.
            </p>
          </div>

          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setChartMetric('requests')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMetric === 'requests'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lượt thao tác
            </button>
            <button
              onClick={() => setChartMetric('duration')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMetric === 'duration'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Thời lượng (Phút)
            </button>
          </div>
        </div>

        {/* 24-Hour Bar Chart Visualization */}
        <div className="pt-4">
          <div className="h-56 sm:h-64 flex items-end gap-1 sm:gap-2 px-1 pb-2 border-b border-slate-200 relative">
            {Array.from({ length: 24 }).map((_, h) => {
              const hh = String(h).padStart(2, '0');
              const hData = activeDayStats?.hourly ? activeDayStats.hourly[hh] : null;
              const req = hData?.requests || 0;
              const dur = hData?.durationMinutes || 0;
              const currentVal = chartMetric === 'requests' ? req : dur;

              const percent = maxHourlyInDay > 0 ? (currentVal / maxHourlyInDay) * 100 : 0;
              const isHovered = hoveredHour === h;
              const hasActivity = currentVal > 0;

              // Color based on time of day
              let barColorClass = 'bg-slate-200';
              if (hasActivity) {
                if (h >= 0 && h < 6) barColorClass = 'bg-gradient-to-t from-indigo-400 to-indigo-500';
                else if (h >= 6 && h < 12) barColorClass = 'bg-gradient-to-t from-amber-400 to-amber-500';
                else if (h >= 12 && h < 18) barColorClass = 'bg-gradient-to-t from-blue-500 to-indigo-600';
                else barColorClass = 'bg-gradient-to-t from-purple-500 to-pink-500';
              }

              return (
                <div
                  key={h}
                  className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                  onMouseEnter={() => setHoveredHour(h)}
                  onMouseLeave={() => setHoveredHour(null)}
                >
                  {/* Tooltip on hover */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-2 z-30 bg-slate-900/95 backdrop-blur-md text-white text-[11px] rounded-xl px-3 py-2 shadow-xl border border-slate-700 whitespace-nowrap pointer-events-none transform -translate-x-1/2 left-1/2 animate-scale-up">
                      <div className="flex items-center gap-1.5 font-bold text-amber-300 pb-1 border-b border-slate-700 mb-1">
                        {getPeriodIcon(h)}
                        <span>{hh}:00 - {String(h + 1).padStart(2, '0')}:00</span>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between gap-3 text-slate-300">
                          <span>Số lượt thao tác:</span>
                          <span className="font-bold text-white">{req} lượt</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-slate-300">
                          <span>Thời lượng ước tính:</span>
                          <span className="font-bold text-emerald-400">{formatDuration(dur)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bar */}
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 ${barColorClass} ${
                      isHovered ? 'brightness-110 shadow-md ring-2 ring-indigo-400/50' : ''
                    }`}
                    style={{
                      height: `${Math.max(percent > 0 ? percent : 3, 3)}%`
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* X Axis Labels: 00h to 23h */}
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-2 px-1">
            <span>00:00</span>
            <span className="hidden sm:inline">04:00</span>
            <span>08:00</span>
            <span className="hidden sm:inline">12:00</span>
            <span>16:00</span>
            <span className="hidden sm:inline">20:00</span>
            <span>23:59</span>
          </div>

          {/* Time Zone Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100 text-[11px] font-semibold text-slate-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-indigo-400 shrink-0"></div>
              <span>🌙 Đêm (00h - 06h)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-amber-400 shrink-0"></div>
              <span>🌅 Sáng (06h - 12h)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-blue-500 shrink-0"></div>
              <span>☀️ Chiều (12h - 18h)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-purple-500 shrink-0"></div>
              <span>🌆 Tối (18h - 24h)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Breakdown & 7-Day Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Phân bổ tỷ trọng các tính năng */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                Tỷ Trọng Sử Dụng Các Tính Năng ({selectedDate})
              </h3>
              <span className="text-[11px] font-bold text-slate-400">
                {metrics.featureBreakdown.length} tính năng
              </span>
            </div>

            {metrics.featureBreakdown.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Chưa có dữ liệu tính năng nào được ghi nhận trong ngày này.
              </div>
            ) : (
              <div className="space-y-4">
                {metrics.featureBreakdown.map((item, idx) => {
                  const percent = metrics.totalRequests > 0
                    ? Math.round((item.requests / metrics.totalRequests) * 100)
                    : 0;
                  const colorConfig = FEATURE_COLORS[item.name] || DEFAULT_COLOR;

                  return (
                    <div key={idx} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${colorConfig.bar}`}></span>
                          {item.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 font-semibold">{item.requests} lượt ({percent}%)</span>
                          {item.duration > 0 && (
                            <span className="text-[11px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-bold">
                              {formatDuration(item.duration)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${colorConfig.bar}`}
                          style={{ width: `${Math.max(percent, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Dữ liệu tự động đồng bộ khi thành viên tương tác</span>
            <span className="font-bold text-indigo-600">Đã kích hoạt Realtime</span>
          </div>
        </div>

        {/* Right: So sánh xu hướng 7 ngày (Weekly Trends) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Tổng Quan Xu Hướng 7 Ngày Qua
              </h3>
              <span className="text-[11px] font-bold text-slate-400">
                Tổng 7 ngày: {stats.reduce((acc, s) => acc + (s.requests || 0), 0)} lượt
              </span>
            </div>

            <div className="space-y-3">
              {stats.map((day) => {
                const totalReq = day.requests || 0;
                const totalDur = day.totalDurationMinutes || 0;
                const isSelected = (day.date || day.id) === selectedDate;

                const maxWeekly = Math.max(...stats.map(s => s.requests || 0), 1);
                const percent = Math.round((totalReq / maxWeekly) * 100);

                return (
                  <div
                    key={day.id}
                    onClick={() => setSelectedDate(day.date || day.id)}
                    className={`p-2.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-200'
                        : 'bg-white hover:bg-slate-50 border-slate-100'
                    }`}
                  >
                    <div className="w-20 shrink-0 text-xs font-black text-slate-700">
                      {day.date || day.id}
                    </div>

                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(percent, 2)}%` }}
                      />
                    </div>

                    <div className="w-28 text-right text-xs font-bold text-slate-800 shrink-0">
                      <span>{totalReq} lượt</span>
                      <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                        ({formatDuration(totalDur)})
                      </span>
                    </div>

                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 shrink-0 ${isSelected ? 'text-indigo-600' : ''}`} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Dữ liệu được lưu trữ tự động trên Cloud Firestore</span>
            <span className="font-bold text-emerald-600">Đã đồng bộ</span>
          </div>
        </div>
      </div>
    </div>
  );
};
