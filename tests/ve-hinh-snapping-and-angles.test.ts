import test from 'node:test';
import assert from 'node:assert/strict';
import { findSnapTarget, findAngularSnap, blankDocument } from '../public/ve-hinh/src/math.js';

test('findSnapTarget: snaps to existing vertex within radius', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 0, y: 0, visible: true },
    { id: 'B', x: 4, y: 0, visible: true }
  ];
  const snap = findSnapTarget(0.1, 0.1, doc, { radius: 0.28, snapPoints: true });
  assert.equal(snap.type, 'point');
  assert.equal(snap.refId, 'A');
  assert.equal(snap.x, 0);
  assert.equal(snap.y, 0);
});

test('findSnapTarget: snaps to midpoint of existing segment', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 0, y: 0, visible: true },
    { id: 'B', x: 4, y: 0, visible: true }
  ];
  doc.shapes = [
    { id: 'AB', type: 'segment', refs: ['A', 'B'] }
  ];
  // Midpoint is at (2, 0)
  const snap = findSnapTarget(2.05, 0.05, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snap.type, 'midpoint');
  assert.equal(snap.refId, 'AB');
  assert.equal(snap.x, 2);
  assert.equal(snap.y, 0);
});

test('findSnapTarget: snaps to grid when enabled and far from vertices', () => {
  const doc = blankDocument();
  const snap = findSnapTarget(2.92, 1.05, doc, { radius: 0.28, snapGrid: true, gridStep: 1 });
  assert.equal(snap.type, 'grid');
  assert.equal(snap.x, 3);
  assert.equal(snap.y, 1);
});

test('findAngularSnap: snaps to 60 degrees within threshold', () => {
  // Origin (0,0), target approx at 61.5 degrees with radius 2
  const rad61 = 61.5 * Math.PI / 180;
  const targetX = 2 * Math.cos(rad61);
  const targetY = 2 * Math.sin(rad61);
  const snap = findAngularSnap(0, 0, targetX, targetY, { thresholdDeg: 4 });
  assert.equal(snap.snapped, true);
  assert.equal(Math.round(snap.angleDeg), 60);
  assert.equal(snap.isRightAngle, false);
  assert.ok(Math.abs(snap.length - 2) < 1e-4);
});

test('findAngularSnap: detects right angle 90 degrees and sets isRightAngle', () => {
  const snap = findAngularSnap(0, 0, 0.05, 3.5, { thresholdDeg: 5 });
  assert.equal(snap.snapped, true);
  assert.equal(snap.angleDeg, 90);
  assert.equal(snap.isRightAngle, true);
});
