import { DayUsageStats } from '../components/AdminAnalyticsDashboard';

export interface ActiveMemberStat {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  latexCount: number;
  examCount: number;
  promptCount: number;
  markItDownCount: number;
  totalDailyCount: number;
  percentage: number;
  lastActive?: string;
}

export interface ReconciledStatsResult {
  stats: DayUsageStats[];
  activeMembersToday: ActiveMemberStat[];
  totalUserDaily: number;
  hasDiscrepancy: boolean;
}

/**
 * Lấy chuỗi ngày hiện tại (YYYY-MM-DD) theo múi giờ chuẩn Việt Nam (GMT+7)
 */
export function getTodayVNDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Lấy giờ hiện tại (0 - 23) theo múi giờ chuẩn Việt Nam (GMT+7)
 */
export function getVNHour(d: Date = new Date()): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: 'numeric',
    hourCycle: 'h23'
  }).format(d);
  return parseInt(hourStr, 10) || 0;
}

/**
 * Chuẩn hóa chuỗi ngày bất kỳ (DD/MM/YYYY hoặc YYYY-MM-DD hoặc ISO timestamp) sang định dạng chuẩn YYYY-MM-DD
 */
export function normalizeDateToISO(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  if (trimmed.includes('-')) {
    const parts = trimmed.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return trimmed;
}

/**
 * Thuật toán Reconcile đối soát và hợp nhất Live Realtime giữa:
 * 1. Dữ liệu User Activity Truth từ collection `users` (từng thành viên).
 * 2. Dữ liệu Event Logs từ collection `api_usage_stats` (thống kê hệ thống).
 *
 * Đảm bảo:
 * - Dữ liệu hôm nay luôn khớp 100% với danh sách thành viên thực tế.
 * - Phản ánh tức thời theo thời gian thực (Realtime sub-second).
 * - Tự động bổ sung các lượt chênh lệch vào khung giờ hiện tại và các tính năng tương ứng.
 */
export function reconcileStatsWithUsers(
  baseStats: DayUsageStats[],
  users: any[],
  targetTodayDate?: string
): ReconciledStatsResult {
  const todayStr = targetTodayDate || getTodayVNDate();
  const currentHourStr = String(getVNHour()).padStart(2, '0');

  // 1. Phân tích chi tiết từng user trong ngày hôm nay
  let totalUserLatex = 0;
  let totalUserExam = 0;
  let totalUserPrompt = 0;
  let totalUserMarkItDown = 0;
  const activeMembersToday: ActiveMemberStat[] = [];

  if (Array.isArray(users)) {
    for (const u of users) {
      const uDateISO = normalizeDateToISO(u.lastLatexResetDate);
      const isToday = (uDateISO === todayStr) || (u.lastLatexResetDate === todayStr);
      const latex = isToday ? (Number(u.latexCount) || 0) : 0;
      const exam = isToday ? (Number(u.examCount) || 0) : 0;
      const prompt = isToday ? (Number(u.promptCount) || 0) : 0;
      const markItDown = isToday ? (Number(u.markItDownCount) || 0) : 0;
      const userTotal = latex + exam + prompt + markItDown;

      totalUserLatex += latex;
      totalUserExam += exam;
      totalUserPrompt += prompt;
      totalUserMarkItDown += markItDown;

      if (userTotal > 0) {
        activeMembersToday.push({
          uid: u.uid || `user-${activeMembersToday.length}`,
          displayName: u.displayName || u.email?.split('@')[0] || 'Thành viên mới',
          email: u.email || 'Không có email',
          photoURL: u.photoURL,
          latexCount: latex,
          examCount: exam,
          promptCount: prompt,
          markItDownCount: markItDown,
          totalDailyCount: userTotal,
          percentage: 0,
          lastActive: u.lastActiveDate || u.updatedAt
        });
      }
    }
  }

  const totalUserDaily = totalUserLatex + totalUserExam + totalUserPrompt + totalUserMarkItDown;

  // Tính phần trăm đóng góp của từng thành viên
  for (const member of activeMembersToday) {
    member.percentage = totalUserDaily > 0 ? Math.round((member.totalDailyCount / totalUserDaily) * 100) : 0;
  }
  activeMembersToday.sort((a, b) => b.totalDailyCount - a.totalDailyCount);

  // 2. Đối soát với danh sách 7 ngày
  const clonedStats: DayUsageStats[] = (baseStats || []).map(day => ({
    ...day,
    hourly: { ...(day.hourly || {}) },
    featureDurations: { ...(day.featureDurations || {}) }
  }));

  let todayStatIndex = clonedStats.findIndex(s => (s.date || s.id) === todayStr);

  if (todayStatIndex === -1) {
    // Nếu hôm nay chưa có trong stats, tạo mới
    const emptyHourly: Record<string, { requests: number; durationMinutes: number }> = {};
    for (let h = 0; h < 24; h++) {
      emptyHourly[String(h).padStart(2, '0')] = { requests: 0, durationMinutes: 0 };
    }
    const newDay: DayUsageStats = {
      id: todayStr,
      date: todayStr,
      timestamp: new Date().toISOString(),
      requests: 0,
      totalDurationMinutes: 0,
      hourly: emptyHourly,
      featureDurations: {}
    };
    clonedStats.push(newDay);
    todayStatIndex = clonedStats.length - 1;
  }

  const todayStat = clonedStats[todayStatIndex];
  const oldRequests = Number(todayStat.requests) || 0;

  // 3. Hợp nhất số lượt từng tính năng (Requests & Durations)
  const featureDurations: Record<string, number> = { ...(todayStat.featureDurations || {}) };

  // Nạp các tính năng có sẵn từ featureDurations vào root keys nếu chưa có
  Object.keys(featureDurations).forEach(k => {
    if (todayStat[k] === undefined || typeof todayStat[k] !== 'number') {
      // Nếu ở root chưa có thì gán số lượt tối thiểu là 1 (hoặc theo lượt đã log)
      todayStat[k] = Number(todayStat[k]) || 1;
    }
  });

  // Hợp nhất số lượt thực tế từ Users
  todayStat["Chuyển đổi LaTeX"] = Math.max(
    Number(todayStat["Chuyển đổi LaTeX"]) || 0,
    totalUserLatex
  );
  todayStat["Soạn đề thi (AI)"] = Math.max(
    Number(todayStat["Soạn đề thi (AI)"]) || 0,
    totalUserExam
  );
  todayStat["Dán AI"] = Math.max(
    Number(todayStat["Dán AI"]) || 0,
    totalUserPrompt
  );
  if (totalUserMarkItDown > 0) {
    todayStat["MarkItDown AI"] = Math.max(
      Number(todayStat["MarkItDown AI"]) || 0,
      totalUserMarkItDown
    );
  }

  // Cập nhật thời lượng tương ứng (duration in minutes)
  featureDurations["Chuyển đổi LaTeX"] = Math.max(
    Number(featureDurations["Chuyển đổi LaTeX"]) || 0,
    Math.round(todayStat["Chuyển đổi LaTeX"] * 2)
  );
  featureDurations["Soạn đề thi (AI)"] = Math.max(
    Number(featureDurations["Soạn đề thi (AI)"]) || 0,
    Math.round(todayStat["Soạn đề thi (AI)"] * 3)
  );
  featureDurations["Dán AI"] = Math.max(
    Number(featureDurations["Dán AI"]) || 0,
    Math.round(todayStat["Dán AI"] * 1)
  );
  if (totalUserMarkItDown > 0) {
    featureDurations["MarkItDown AI"] = Math.max(
      Number(featureDurations["MarkItDown AI"]) || 0,
      Math.round(todayStat["MarkItDown AI"] * 1)
    );
  }

  // Tổng số lượt của toàn bộ tính năng sau khi hợp nhất
  const excludedKeys = new Set(['id', 'date', 'timestamp', 'requests', 'totalDurationMinutes', 'hourly', 'featureDurations']);
  let totalFeaturesReq = 0;
  Object.keys(todayStat).forEach(k => {
    if (!excludedKeys.has(k) && typeof todayStat[k] === 'number') {
      totalFeaturesReq += todayStat[k];
    }
  });

  const reconciledRequests = Math.max(oldRequests, totalUserDaily, totalFeaturesReq);

  // 4. Đối soát phân bổ khung giờ 24h
  const hourly: Record<string, { requests: number; durationMinutes: number }> = { ...(todayStat.hourly || {}) };
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    if (!hourly[hh]) {
      hourly[hh] = { requests: 0, durationMinutes: 0 };
    }
  }

  const currentHourlySum = Object.values(hourly).reduce((acc, h) => acc + (h.requests || 0), 0);
  if (currentHourlySum < reconciledRequests) {
    const diff = reconciledRequests - currentHourlySum;
    const curH = hourly[currentHourStr] || { requests: 0, durationMinutes: 0 };
    hourly[currentHourStr] = {
      requests: curH.requests + diff,
      durationMinutes: curH.durationMinutes + Math.round(diff * 1.5)
    };
  }

  // 5. Cập nhật thời lượng hoạt động tương ứng
  const hourlyTotalDur = Object.values(hourly).reduce((acc, h) => acc + (h.durationMinutes || 0), 0);
  const reconciledDuration = Math.max(
    Number(todayStat.totalDurationMinutes) || 0,
    hourlyTotalDur,
    Math.round(reconciledRequests * 1.5)
  );

  const hasDiscrepancy = reconciledRequests > oldRequests;

  todayStat.requests = reconciledRequests;
  todayStat.totalDurationMinutes = reconciledDuration;
  todayStat.hourly = hourly;
  todayStat.featureDurations = featureDurations;

  // todayStat[feat] giữ nguyên là số lượt requests thực tế
  // todayStat.featureDurations[feat] là thời lượng thao tác (phút)

  return {
    stats: clonedStats,
    activeMembersToday,
    totalUserDaily,
    hasDiscrepancy
  };
}
