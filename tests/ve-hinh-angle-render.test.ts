import test from 'node:test';
import assert from 'node:assert/strict';

export function renderRightAnglePath(b: {x: number, y: number}, u: {x: number, y: number}, v: {x: number, y: number}, r = 16) {
  const nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y);
  const p1 = { x: b.x + (u.x/nu)*r, y: b.y + (u.y/nu)*r };
  const p2 = { x: b.x + (u.x/nu + v.x/nv)*r, y: b.y + (u.y/nu + v.y/nv)*r };
  const p3 = { x: b.x + (v.x/nv)*r, y: b.y + (v.y/nv)*r };
  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y}`;
}

test('renderRightAnglePath creates correct square corner mark', () => {
  const path = renderRightAnglePath({x: 0, y: 0}, {x: 1, y: 0}, {x: 0, y: 1}, 10);
  assert.equal(path, 'M 10 0 L 10 10 L 0 10');
});
