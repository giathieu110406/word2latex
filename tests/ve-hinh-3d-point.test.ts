import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoint3D, createBlank3D } from '../public/ve-hinh/src/app.js';
import { resolve, validateDocument } from '../public/ve-hinh/src/math.js';

test('createPoint3D: adds free 3D point with custom coordinates', () => {
  let doc = createBlank3D();
  assert.equal(doc.solid.points.length, 0);
  
  doc = createPoint3D(doc, 1.0, 2.0, -1.5, { id: 'A', label: 'A' });
  assert.equal(doc.solid.points.length, 1);
  assert.equal(doc.solid.points[0].id, 'A');
  assert.equal(doc.solid.points[0].x, 1.0);
  assert.equal(doc.solid.points[0].y, 2.0);
  assert.equal(doc.solid.points[0].z, -1.5);
  
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);
  assert.deepEqual(res.solidPoints['A'], { ...doc.solid.points[0], x: 1, y: 2, z: -1.5 });
});

test('createBlank3D: creates valid empty 3D solid document', () => {
  const doc = createBlank3D();
  assert.ok(doc.solid);
  assert.equal(doc.solid.enabled, true);
  assert.equal(doc.solid.points.length, 0);
  assert.equal(doc.solid.segments.length, 0);
  assert.ok(validateDocument(doc));
});
