import test from 'node:test';
import assert from 'node:assert/strict';
import { findAlignmentGuides, blankDocument } from '../public/ve-hinh/src/math.js';

test('findAlignmentGuides: snaps x to another vertex when aligned vertically', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 2, y: 0, visible: true },
    { id: 'B', x: 2.04, y: 3, visible: true }
  ];
  const result = findAlignmentGuides('B', 2.04, 3, doc, { threshold: 0.15 });
  assert.equal(result.x, 2);
  assert.equal(result.y, 3);
  assert.equal(result.guides.length, 1);
  assert.equal(result.guides[0].axis, 'x');
  assert.equal(result.guides[0].val, 2);
  assert.equal(result.guides[0].targetId, 'A');
});

test('findAlignmentGuides: snaps y to another vertex when aligned horizontally', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: -1, y: 1.5, visible: true },
    { id: 'B', x: 4, y: 1.53, visible: true }
  ];
  const result = findAlignmentGuides('B', 4, 1.53, doc, { threshold: 0.15 });
  assert.equal(result.x, 4);
  assert.equal(result.y, 1.5);
  assert.equal(result.guides.length, 1);
  assert.equal(result.guides[0].axis, 'y');
  assert.equal(result.guides[0].val, 1.5);
  assert.equal(result.guides[0].targetId, 'A');
});

test('findAlignmentGuides: ignores hidden points and dragged point itself', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'B', x: 2.02, y: 3, visible: true },
    { id: 'C', x: 2, y: 0, visible: false }
  ];
  const result = findAlignmentGuides('B', 2.02, 3, doc, { threshold: 0.15 });
  assert.equal(result.x, 2.02);
  assert.equal(result.guides.length, 0);
});

test('renderSnapOverlay: renders horizontal and vertical alignment guide lines', async () => {
  const { renderSnapOverlay } = await import('../public/ve-hinh/src/render.js');
  const snapInfo = {
    alignmentGuides: [
      { axis: 'x', val: 2, targetId: 'A' },
      { axis: 'y', val: 1.5, targetId: 'B' }
    ]
  };
  const svg = renderSnapOverlay(snapInfo, 55, { x: 0, y: 0 });
  assert.ok(svg.includes('data-alignment-guide="true"'));
  assert.ok(svg.includes('stroke="#0ea5e9"'));
  assert.ok(svg.includes('stroke-dasharray="4 3"'));
  // Verify horizontal line passes through y = 1.5 -> screen cy = 330 - 1.5 * 55 = 247.5
  assert.ok(svg.includes('y1="247.5" y2="247.5"') || svg.includes('y1="247.5"'));
  // Verify vertical line passes through x = 2 -> screen cx = 500 + 2 * 55 = 610
  assert.ok(svg.includes('x1="610" x2="610"') || svg.includes('x1="610"'));
});

