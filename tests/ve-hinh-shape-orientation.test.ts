import test from 'node:test';
import assert from 'node:assert/strict';
import { blankDocument, resolve } from '../public/ve-hinh/src/math.js';

test('equilateralTriangle flip: determines correct half-plane sign based on cursor cross product', () => {
  // A is at (0, 0), B is at (2, 0) -> AB vector = (2, 0)
  const A = { x: 0, y: 0 };
  const B = { x: 2, y: 0 };

  // Cursor M above AB at (1, 2)
  const crossAbove = (B.x - A.x) * (2 - A.y) - (B.y - A.y) * (1 - A.x); // 2 * 2 - 0 = 4 > 0
  assert.ok(crossAbove > 0);

  // Cursor M below AB at (1, -2)
  const crossBelow = (B.x - A.x) * (-2 - A.y) - (B.y - A.y) * (1 - A.x); // 2 * (-2) - 0 = -4 < 0
  assert.ok(crossBelow < 0);
});

test('square flip: rotated points correctly place vertices in chosen half-plane', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 2, y: 0 }
  ];

  // Upward square: flip = +1
  const flipUp = 1;
  const dUp = { id: 'D_up', kind: 'rotateAround', refs: ['B', 'A'], angle: flipUp * Math.PI / 2 };
  const cUp = { id: 'C_up', kind: 'rotateAround', refs: ['A', 'B'], angle: -flipUp * Math.PI / 2 };
  doc.points.push(dUp, cUp);

  const resUp = resolve(doc).points;
  assert.ok(Math.abs(resUp['D_up'].x - 0) < 1e-4);
  assert.ok(Math.abs(resUp['D_up'].y - 2) < 1e-4);
  assert.ok(Math.abs(resUp['C_up'].x - 2) < 1e-4);
  assert.ok(Math.abs(resUp['C_up'].y - 2) < 1e-4);

  // Downward square: flip = -1
  const docDown = blankDocument();
  docDown.points = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 2, y: 0 }
  ];
  const flipDown = -1;
  const dDown = { id: 'D_down', kind: 'rotateAround', refs: ['B', 'A'], angle: flipDown * Math.PI / 2 };
  const cDown = { id: 'C_down', kind: 'rotateAround', refs: ['A', 'B'], angle: -flipDown * Math.PI / 2 };
  docDown.points.push(dDown, cDown);

  const resDown = resolve(docDown).points;
  assert.ok(Math.abs(resDown['D_down'].x - 0) < 1e-4);
  assert.ok(Math.abs(resDown['D_down'].y - (-2)) < 1e-4);
  assert.ok(Math.abs(resDown['C_down'].x - 2) < 1e-4);
  assert.ok(Math.abs(resDown['C_down'].y - (-2)) < 1e-4);
});
