import assert from 'node:assert/strict';
import * as reconciliation from './reconciliation';

const { reconcileStatsWithUsers } = reconciliation;

const date = '2026-09-30';
const baseStats = [{
  id: date,
  date,
  requests: 1,
  totalDurationMinutes: 2,
  hourly: { '09': { requests: 1, durationMinutes: 2 } },
  featureDurations: {},
  'Chuyển đổi LaTeX': 1
}];

const result = reconcileStatsWithUsers(baseStats, [{
  uid: 'member-1',
  displayName: 'Minh',
  email: 'minh@example.com',
  lastLatexResetDate: date,
  latexCount: 3
}], date);

const hourlyRequests = Object.values(result.stats[0].hourly || {}).reduce(
  (total, hour) => total + hour.requests,
  0
);

assert.equal(result.stats[0].requests, 3);
assert.equal(hourlyRequests, 1, 'missing event timestamps must not be assigned to the current hour');

assert.equal(typeof reconciliation.getActiveMembersForDate, 'function');
assert.deepEqual(
  reconciliation.getActiveMembersForDate({
    id: date,
    memberActivity: {
      'member-1': {
        displayName: 'Minh',
        email: 'minh@example.com',
        features: { 'Chuyển đổi LaTeX': 2, 'Dán AI': 1 }
      }
    }
  }),
  [{
    uid: 'member-1',
    displayName: 'Minh',
    email: 'minh@example.com',
    photoURL: undefined,
    latexCount: 2,
    examCount: 0,
    promptCount: 1,
    markItDownCount: 0,
    totalDailyCount: 3,
    percentage: 100,
    lastActive: undefined
  }]
);
