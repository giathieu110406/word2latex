import test from 'node:test';
import assert from 'node:assert/strict';
import { create3DPrimitive } from '../public/ve-hinh/src/app.js';
import { resolve, validateDocument } from '../public/ve-hinh/src/math.js';

test('create3DPrimitive: supports trapezoid-pyramid with parallel base edges', () => {
  const doc = create3DPrimitive('trapezoid-pyramid');
  assert.equal(doc.solid.points.length, 5); // S, A, B, C, D
  assert.equal(doc.solid.segments.length, 8);
  assert.ok(validateDocument(doc));
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);
});

test('create3DPrimitive: supports sa-perp-pyramid where S is vertically aligned with A', () => {
  const doc = create3DPrimitive('sa-perp-pyramid');
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);
  const pA = res.solidPoints['A'];
  const pS = res.solidPoints['S'];
  assert.ok(Math.abs(pS.x - pA.x) < 1e-4);
  assert.ok(Math.abs(pS.z - pA.z) < 1e-4);
  assert.ok(pS.y > pA.y);
});

test('create3DPrimitive: supports prism4 (quadrilateral prism)', () => {
  const doc = create3DPrimitive('prism4');
  assert.equal(doc.solid.points.length, 8); // 4 bottom + 4 top
  assert.equal(doc.solid.segments.length, 12);
  assert.ok(validateDocument(doc));
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);
});
