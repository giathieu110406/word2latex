export type ActivitySource = 'web' | 'localhost' | 'test' | 'legacy';
export interface ActivityEvent {
  id: string; actorUid: string | null; actorType: 'user' | 'system';
  action: string; source: ActivitySource; status: 'started' | 'success' | 'error' | 'cancelled' | 'observed';
  date: string; hour: string; occurredAt: string; startedAt?: string;
  durationMs: number | null; httpStatus?: number; targetUid?: string; referenceId?: string;
}
export const vietnamDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year:'numeric',month:'2-digit',day:'2-digit',
}).format(date);
export const vietnamHour = (date = new Date()) => new Intl.DateTimeFormat('en-US', {
  timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',hourCycle:'h23',
}).format(date);
export function classifySource(req: any): ActivitySource {
  if (req.headers?.['x-activity-source'] === 'test') return 'test';
  const candidates = [req.headers?.['x-forwarded-host'], req.headers?.host]
    .flatMap(v => String(v || '').split(','))
    .map(s => s.trim())
    .filter(Boolean);
  for (const raw of candidates) {
    try {
      const host = new URL('http://' + raw).hostname.toLowerCase();
      if (host === 'word2latex.io.vn' || host === 'www.word2latex.io.vn') return 'web';
    } catch {}
  }
  return 'localhost';
}

export type FeatureBucket = 'convert' | 'ai' | 'exam' | 'drawing' | 'markitdown';
const SERVER_AI_ACTIONS = new Set(['Dán AI', 'AI Canvas', 'AI thay thế số liệu', 'AI hỏi đáp', 'Trích xuất văn bản', 'Chuyển đổi LaTeX']);

export function classifyFeatureBucket(event: any): FeatureBucket | null {
  if (!event) return null;
  if (event.action === 'Chuyển đổi LaTeX' && event.status === 'observed') return 'convert';
  if ((event.action === 'Áp dụng đề thi' && event.status === 'observed') || (event.action === 'Soạn đề thi (AI)' && event.status === 'success')) return 'exam';
  if (event.action === 'AI Vẽ hình' && event.status === 'success') return 'drawing';
  if (event.action === 'MarkItDown AI' && event.status === 'success') return 'markitdown';
  if ((event.action === 'Áp dụng tinh chỉnh AI' && event.status === 'observed') || (SERVER_AI_ACTIONS.has(event.action) && event.status === 'success')) return 'ai';
  return null;
}

export function aggregateDashboardUsage(events: any[], options: { from: string; to: string; feature?: 'all' | FeatureBucket }) {
  const featureFilter = options.feature || 'all';
  const seen = new Set<string>();
  const webEvents: any[] = [];
  for (const e of events || []) {
    if (!e?.id || seen.has(e.id)) continue;
    seen.add(e.id);
    if (e.source !== 'web' || !e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    if (e.date < options.from || e.date > options.to) continue;
    const bucket = classifyFeatureBucket(e);
    if (!bucket) continue;
    webEvents.push({ ...e, bucket });
  }
  webEvents.sort((a, b) => String(a.occurredAt || '').localeCompare(String(b.occurredAt || '')));

  const lastServerAiMs = new Map<string, number>();
  const dedupedEvents: any[] = [];
  for (const e of webEvents) {
    const uidKey = `${e.actorUid || 'system'}:${e.date}`;
    const ms = Date.parse(e.occurredAt || '');
    if (e.bucket === 'ai' && SERVER_AI_ACTIONS.has(e.action) && e.status === 'success') {
      if (Number.isFinite(ms)) lastServerAiMs.set(uidKey, ms);
      dedupedEvents.push(e);
      continue;
    }
    if (e.bucket === 'ai' && e.action === 'Áp dụng tinh chỉnh AI') {
      const prevMs = lastServerAiMs.get(uidKey);
      if (prevMs !== undefined && Number.isFinite(ms) && ms >= prevMs && ms - prevMs <= 60000) {
        lastServerAiMs.delete(uidKey);
        continue;
      }
    }
    dedupedEvents.push(e);
  }

  const daysMap = new Map<string, { date: string; total: number; filteredTotal: number; convert: number; ai: number; exam: number; drawing: number; markitdown: number }>();
  const usersByDate: Record<string, any[]> = {};
  const userMapByDate = new Map<string, Map<string, any>>();

  for (let ms = Date.parse(options.from + 'T00:00:00Z'); ms <= Date.parse(options.to + 'T00:00:00Z') && daysMap.size < 32; ms += 86400000) {
    const d = new Date(ms).toISOString().slice(0, 10);
    daysMap.set(d, { date: d, total: 0, filteredTotal: 0, convert: 0, ai: 0, exam: 0, drawing: 0, markitdown: 0 });
    usersByDate[d] = [];
    userMapByDate.set(d, new Map());
  }

  const totals = { all: 0, convert: 0, ai: 0, exam: 0, drawing: 0, markitdown: 0 };

  for (const e of dedupedEvents) {
    const b: FeatureBucket = e.bucket;
    totals.all++;
    totals[b]++;
    let day = daysMap.get(e.date);
    if (!day) {
      day = { date: e.date, total: 0, filteredTotal: 0, convert: 0, ai: 0, exam: 0, drawing: 0, markitdown: 0 };
      daysMap.set(e.date, day);
      usersByDate[e.date] = [];
      userMapByDate.set(e.date, new Map());
    }
    day.total++;
    day[b]++;
    if (featureFilter === 'all' || featureFilter === b) {
      day.filteredTotal++;
    }

    const uid = e.actorUid || 'system';
    const dateUsers = userMapByDate.get(e.date)!;
    let u = dateUsers.get(uid);
    if (!u) {
      u = {
        uid,
        name: e.actorName || uid,
        email: e.actorEmail || '',
        convert: 0,
        ai: 0,
        exam: 0,
        drawing: 0,
        markitdown: 0,
        total: 0,
        filteredTotal: 0,
        lastActiveAt: e.occurredAt || '',
        events: [],
      };
      dateUsers.set(uid, u);
    }
    u[b]++;
    u.total++;
    if (featureFilter === 'all' || featureFilter === b) {
      u.filteredTotal++;
    }
    if (String(e.occurredAt || '') >= u.lastActiveAt) {
      u.lastActiveAt = e.occurredAt || u.lastActiveAt;
    }
    if (featureFilter === 'all' || featureFilter === b) {
      u.events.push(e);
    }
  }

  for (const [d, dateUsers] of userMapByDate.entries()) {
    const list = [...dateUsers.values()]
      .filter(u => u.filteredTotal > 0)
      .map(u => ({
        ...u,
        events: [...u.events].sort((a, b) => String(b.occurredAt || '').localeCompare(String(a.occurredAt || ''))),
      }))
      .sort((a, b) => b.filteredTotal - a.filteredTotal || b.total - a.total || String(b.lastActiveAt).localeCompare(String(a.lastActiveAt)));
    usersByDate[d] = list;
  }

  return {
    totals,
    days: [...daysMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    usersByDate,
  };
}

export function aggregateActivity(events: any[], filter: {source: string; uid?: string}) {
  const days = new Map<string, any>();
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    if ((filter.source !== 'all' && event.source !== filter.source) || (filter.uid && event.actorUid !== filter.uid)) continue;
    if (!event.date || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) continue;
    const day = days.get(event.date) || {id:event.date,date:event.date,requests:0,totalDurationMinutes:0,errors:0,observations:0,hourly:{},featureDurations:{}};
    days.set(event.date, day);
    if (event.status === 'error') day.errors++;
    if (event.status === 'observed' || event.status === 'cancelled') day.observations++;
    if (event.status !== 'success') continue;
    const minutes = Number.isFinite(event.durationMs) ? Math.max(0,event.durationMs) / 60000 : 0;
    day.requests++;
    day.totalDurationMinutes += minutes;
    day[event.action] = (day[event.action] || 0) + 1;
    day.featureDurations[event.action] = (day.featureDurations[event.action] || 0) + minutes;
    const hour = /^\d{2}$/.test(event.hour) ? event.hour : '00';
    day.hourly[hour] ||= {requests:0,durationMinutes:0};
    day.hourly[hour].requests++;
    day.hourly[hour].durationMinutes += minutes;
  }
  return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
