import test from 'node:test';
import assert from 'node:assert/strict';
import { findSnapTarget, findAngularSnap, blankDocument } from '../public/ve-hinh/src/math.js';
import { renderSnapOverlay } from '../public/ve-hinh/src/render.js';

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

test('renderSnapOverlay: generates SVG elements for point snap halo and angle HUD', () => {
  const snapInfo = {
    snapTarget: { x: 1, y: 2, type: 'point' },
    cursor: { x: 1, y: 2 },
    angularSnap: { angleDeg: 60, length: 3.5, isRightAngle: false, snapped: true }
  };
  const svg = renderSnapOverlay(snapInfo, 55, { x: 0, y: 0 });
  assert.ok(svg.includes('data-snap-overlay="true"'));
  assert.ok(svg.includes('60.0°') || svg.includes('60°'));
  assert.ok(svg.includes('L: 3.50') || svg.includes('L: 3.5'));
});

