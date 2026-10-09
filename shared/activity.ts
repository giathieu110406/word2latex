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
  let host='';
  try {host=new URL('http://'+String(req.headers?.host || '')).hostname;} catch {}
  return ['localhost','127.0.0.1','[::1]'].includes(host) ? 'localhost' : 'web';
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
