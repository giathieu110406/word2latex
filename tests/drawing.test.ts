import test from 'node:test';
import assert from 'node:assert/strict';
import securedHandler, { parseProposal, createDrawingHandler } from '../api/ve-hinh';
const handler = createDrawingHandler();
import { triangleTemplate } from '../public/ve-hinh/src/math.js';
import { exportSVG } from '../public/ve-hinh/src/render.js';

function response() {
  return { code: 200, data: null as any, headers: {}, setHeader(k: string, v: string) { this.headers[k] = v; }, status(code: number) { this.code = code; return this; }, json(data: any) { this.data = data; return this; } };
}

test('drawing API reports unavailable provider and preserves schema validation', async () => {
  const config = response();
  await handler({ method: 'GET', query: { action: 'config' }, headers: { host: 'localhost:3000' } } as any, config as any);
  assert.equal(config.code, 200);
  assert.equal(typeof config.data.configured, 'boolean');
  const invalid = response();
  await handler({ method: 'POST', query: { action: 'reconstruct' }, headers: { host: 'localhost:3000' }, body: { prompt: '', document: {} } } as any, invalid as any);
  assert.equal(invalid.code, 400);
  const anonymous=response();
  await securedHandler({method:'POST',query:{action:'reconstruct'},headers:{host:'localhost:3000'},body:{prompt:'Dựng tam giác',document:triangleTemplate()}} as any,anonymous as any);
  assert.equal(anonymous.code,401,'production recorder requires verified identity before starting work');
  if (!config.data.configured) {
    const unavailable = response();
    await handler({ method: 'POST', query: { action: 'reconstruct' }, headers: { host: 'localhost:3000' }, body: { prompt: 'Dựng tam giác ABC', document: triangleTemplate() } } as any, unavailable as any);
    assert.equal(unavailable.code, 503);
    assert.match(unavailable.data.error, /Chưa cấu hình AI provider/);
  }
  const crossOrigin = response();
  await handler({ method: 'GET', query: { action: 'config' }, headers: { host: 'localhost:3000', origin: 'https://example.com' } } as any, crossOrigin as any);
  assert.equal(crossOrigin.code, 403);
  const result = parseProposal(JSON.stringify({ document: triangleTemplate(), uncertainties: [], extractedText: 'Tam giác ABC' }));
  assert.equal(result.document.points.length, triangleTemplate().points.length);
  assert.throws(() => parseProposal('{"document":{}}'));
});

test('geometry export includes the expanded canvas without cropping edge points or adding a grid', () => {
  const document = triangleTemplate();
  document.points.push({ id: 'EDGE', x: -12, y: 12 });
  const viewport = { x: -200, y: -500, width: 1400, height: 1660 };
  const svg = exportSVG(document, 'geometry', { viewport });
  assert.ok(svg.includes('viewBox="-200 -500 1400 1660"'));
  assert.ok(svg.includes('data-point="EDGE"'));
  assert.ok(svg.includes('cx="-160" cy="-330"'));
  assert.ok(!svg.includes('url(#dots)'));
  assert.ok(!svg.includes('fill="#ffffff"'));
});
