import test from 'node:test';
import assert from 'node:assert/strict';
import {
  create3DPrimitive,
  createCentroid3D,
  createPlaneLineIntersection3D,
  createFootLine3D
} from '../public/ve-hinh/src/app.js';
import { resolve } from '../public/ve-hinh/src/math.js';

test('createCentroid3D: creates centroid of 3 vertices in 3D', () => {
  const doc = create3DPrimitive('pyramid4');
  const next = createCentroid3D(doc, ['A', 'B', 'C'], { id: 'G', label: 'G' });
  const g = next.solid.points.find(p => p.id === 'G');
  assert.ok(g);
  assert.equal(g.kind, 'centroid');
  assert.deepEqual(g.refs, ['A', 'B', 'C']);
  
  const res = resolve(next);
  assert.equal(res.errors.length, 0);
  assert.ok(res.solidPoints['G']);
});

test('createPlaneLineIntersection3D: finds intersection between line and plane', () => {
  const doc = create3DPrimitive('pyramid4');
  // In pyramid S.ABCD: Plane (ABCD) with line through apex S and center of base
  const next = createPlaneLineIntersection3D(doc, ['A', 'B', 'C'], ['S', 'D'], { id: 'I', label: 'I' });
  const iPt = next.solid.points.find(p => p.id === 'I');
  assert.ok(iPt);
  assert.equal(iPt.kind, 'planeLineIntersection');
  assert.deepEqual(iPt.refs, ['A', 'B', 'C', 'S', 'D']);
  
  const res = resolve(next);
  assert.equal(res.errors.length, 0);
});

test('createFootLine3D: drops perpendicular from apex to edge', () => {
  const doc = create3DPrimitive('pyramid4');
  const next = createFootLine3D(doc, 'A', ['S', 'B'], { id: 'K', label: 'K' });
  const kPt = next.solid.points.find(p => p.id === 'K');
  assert.ok(kPt);
  assert.equal(kPt.kind, 'foot');
  assert.deepEqual(kPt.refs, ['A', 'S', 'B']);
  
  const res = resolve(next);
  assert.equal(res.errors.length, 0);
  
  // Segment AK should be created
  const segAK = next.solid.segments.find(s => s.refs.includes('A') && s.refs.includes('K'));
  assert.ok(segAK, 'Altitude segment AK must be created');
});
