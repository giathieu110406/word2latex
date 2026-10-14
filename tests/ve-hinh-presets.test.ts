import test from 'node:test';
import assert from 'node:assert/strict';

export function makeEquilateral(p1: {x: number, y: number}, p2: {x: number, y: number}) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  // Quay 60 độ quanh p1
  const cos60 = 0.5, sin60 = Math.sqrt(3)/2;
  const p3 = {
    x: p1.x + dx * cos60 - dy * sin60,
    y: p1.y + dx * sin60 + dy * cos60
  };
  const d12 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const d13 = Math.hypot(p3.x - p1.x, p3.y - p1.y);
  const d23 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
  return { p3, isEquilateral: Math.abs(d12 - d13) < 1e-4 && Math.abs(d12 - d23) < 1e-4 };
}

export function makeSquare(p1: {x: number, y: number}, p2: {x: number, y: number}) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  // Quay 90 độ
  const p3 = { x: p2.x - dy, y: p2.y + dx };
  const p4 = { x: p1.x - dy, y: p1.y + dx };
  const d12 = Math.hypot(dx, dy);
  const d23 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
  return { p3, p4, isSquare: Math.abs(d12 - d23) < 1e-4 };
}

test('makeEquilateral creates a valid third vertex', () => {
  const res = makeEquilateral({x: 0, y: 0}, {x: 4, y: 0});
  assert.equal(res.isEquilateral, true);
  assert.equal(Math.round(res.p3.x), 2);
});

test('makeSquare creates valid 4 vertices', () => {
  const res = makeSquare({x: 0, y: 0}, {x: 4, y: 0});
  assert.equal(res.isSquare, true);
  assert.equal(res.p3.x, 4);
  assert.equal(res.p3.y, 4);
  assert.equal(res.p4.x, 0);
  assert.equal(res.p4.y, 4);
});
