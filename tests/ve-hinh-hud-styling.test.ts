import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSnapOverlay } from '../public/ve-hinh/src/render.js';
import { findGeometricAngle } from '../public/ve-hinh/src/math.js';

test('renderSnapOverlay uses bright white background and high-contrast text', () => {
  const snapInfo = {
    cursor: { x: 2, y: 2 },
    angularSnap: { angleDeg: 60, length: 4, isRightAngle: false, snapped: true }
  };
  const svg = renderSnapOverlay(snapInfo);
  assert.ok(svg.includes('fill="#ffffff"'), 'Should have white card background');
  assert.ok(svg.includes('stroke="#059669"') || svg.includes('stroke="#10b981"'), 'Should highlight snapped angle in emerald');
  assert.ok(svg.includes('fill="#0f172a"'), 'Should have high-contrast text');
  assert.ok(svg.includes('drop-shadow'), 'Should have subtle drop shadow for elevation');
});

test('findGeometricAngle calculates interior angle between BA and BC', () => {
  // A(0, 3), B(0, 0), C(4, 0) -> right angle 90 degrees
  const angle = findGeometricAngle({ x: 0, y: 3 }, { x: 0, y: 0 }, { x: 4, y: 0 });
  assert.equal(Math.round(angle), 90);

  // Collinear opposite: A(-2, 0), B(0, 0), C(2, 0) -> 180 degrees
  const flat = findGeometricAngle({ x: -2, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 });
  assert.equal(Math.round(flat), 180);

  // Equilateral: A(0, 0), B(2, 0), C(1, Math.sqrt(3)) -> 60 degrees
  const eq = findGeometricAngle({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: Math.sqrt(3) });
  assert.equal(Math.round(eq), 60);
});
