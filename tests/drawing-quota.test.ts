import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingHandler, getDrawingProviderConfig } from '../api/ve-hinh';
import { getAiUsageDay } from '../shared/ai-usage-policy';
import { triangleTemplate } from '../public/ve-hinh/src/math.js';

function fixture() {
  const day = getAiUsageDay();
  const profiles: Record<string, any> = {
    alice: { status: 'pending', planType: 'free', promptCount: 14, queryCount: 20, lastLatexResetDate: day },
    bob: { status: 'pending', planType: 'free', promptCount: 0, queryCount: 0, lastLatexResetDate: day },
  };
  let queue = Promise.resolve();
  const db = {
    collection: (name: string) => { assert.equal(name, 'users'); return { doc: (uid: string) => ({ uid }) }; },
    runTransaction: (work: any) => {
      const result = queue.then(() => work({
        get: async (ref: any) => ({ exists: !!profiles[ref.uid], data: () => ({ ...profiles[ref.uid] }) }),
        update: (ref: any, data: any) => { Object.assign(profiles[ref.uid], data); },
      }));
      queue = result.catch(() => {});
      return result;
    },
  };
  let calls = 0;
  let fail = false;
  let content = JSON.stringify({ document: triangleTemplate(), extractedText: 'Tam giác ABC', uncertainties: [] });
  const handler = createDrawingHandler({
    env: { GEMINI_API_KEY: 'test-only' },
    authenticate: async (req: any) => req.headers.authorization
      ? { authorized: true, status: 200, user: { uid: req.headers.authorization, isOwner: false } }
      : { authorized: false, status: 401, error: 'Chưa đăng nhập' },
    getDatabase: () => db,
    generate: async () => { calls++; if (fail) throw Error('provider failed'); return content; },
  });
  const request = async (uid?: string) => {
    const res = { code: 200, data: null as any, setHeader() {}, status(n: number) { this.code = n; return this; }, json(data: any) { this.data = data; return this; } };
    await handler({ method: 'POST', query: { action: 'reconstruct' }, headers: { host: 'localhost:3000', authorization: uid }, body: { prompt: 'Dựng tam giác ABC', document: triangleTemplate(), userId: 'bob' } }, res);
    return res;
  };
  return { profiles, request, calls: () => calls, setFailure: () => { fail = true; }, setContent: (value: string) => { content = value; } };
}

test('drawing AI shares each authenticated user promptCount and blocks exhausted or missing accounts', async () => {
  const f = fixture();
  const results = await Promise.all([f.request('alice'), f.request('alice')]);
  assert.deepEqual(results.map(r => r.code).sort(), [200, 429]);
  assert.equal(f.calls(), 1);
  assert.equal(f.profiles.alice.promptCount, 15);
  assert.equal(f.profiles.alice.queryCount, 21);
  assert.equal(f.profiles.bob.promptCount, 0);
  assert.equal((await f.request('bob')).code, 200);
  assert.equal(f.profiles.bob.promptCount, 1);
  assert.equal((await f.request()).code, 401);
  assert.equal((await f.request('missing')).code, 403);
  assert.equal(f.calls(), 2);
});

test('provider failure refunds the same bucket, reset occurs at Vietnam 05:00, expired Pro uses free limit', async () => {
  const f = fixture();
  f.setFailure();
  assert.equal((await f.request('alice')).code, 502);
  assert.equal(f.profiles.alice.promptCount, 14);
  assert.equal(f.profiles.alice.queryCount, 20);
  f.profiles.alice.planType = 'pro';
  f.profiles.alice.planExpiresAt = Date.now() - 1;
  f.profiles.alice.promptCount = 15;
  assert.equal((await f.request('alice')).code, 429);
  assert.equal(getAiUsageDay(new Date('2026-10-08T21:59:00Z')), '8/10/2026');
  assert.equal(getAiUsageDay(new Date('2026-10-08T22:00:00Z')), '9/10/2026');
  f.profiles.bob.lastLatexResetDate = 'old';
  f.profiles.bob.promptCount = 100;
  f.profiles.bob.latexCount = 12;
  assert.equal((await f.request('bob')).code, 502);
  assert.equal(f.profiles.bob.promptCount, 0);
  assert.equal(f.profiles.bob.latexCount, 0);
});

test('provider selection reuses Gemini and never treats its key as an OpenAI key', () => {
  const gemini = getDrawingProviderConfig({ GEMINI_API_KEY: 'test-only' });
  assert.equal(gemini.provider, 'gemini');
  assert.equal(gemini.configured, true);
  const partial = getDrawingProviderConfig({ GEMINI_API_KEY: 'test-only', DRAWING_AI_ENDPOINT: 'https://example.com/chat' });
  assert.equal(partial.configured, false);
  assert.ok(partial.missing.includes('DRAWING_AI_API_KEY'));
});

test('invalid provider schema refunds usage and existing approved entitlement remains unlimited', async () => {
  const f = fixture();
  f.setContent('{"document":{}}');
  assert.equal((await f.request('alice')).code, 502);
  assert.equal(f.profiles.alice.promptCount, 14);
  f.setContent(JSON.stringify({ document: triangleTemplate(), extractedText: 'ABC', uncertainties: [] }));
  f.profiles.alice.status = 'approved';
  f.profiles.alice.promptCount = 100;
  assert.equal((await f.request('alice')).code, 200);
  assert.equal(f.profiles.alice.promptCount, 101);
});
