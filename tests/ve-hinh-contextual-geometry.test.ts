import test from 'node:test';
import assert from 'node:assert/strict';
import { blankDocument } from '../public/ve-hinh/src/math.js';

function ensureSegment(next: any, p1: string, p2: string, options: any = {}) {
  const exists = next.shapes.some((s: any) =>
    ['segment', 'polygon'].includes(s.type) &&
    ((s.refs.includes(p1) && s.refs.includes(p2)))
  );
  if (!exists) {
    let i = 1;
    while (next.shapes.some((s: any) => s.id === 's' + i) || next.points.some((p: any) => p.id === 's' + i)) i++;
    next.shapes.push({ id: 's' + i, type: 'segment', refs: [p1, p2], color: options.color || '#176b52', ...options });
  }
}

test('ensureSegment creates segment if missing', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 3, y: 0 }
  ];
  ensureSegment(doc, 'A', 'B');
  assert.equal(doc.shapes.length, 1);
  assert.equal(doc.shapes[0].type, 'segment');
  assert.deepEqual(doc.shapes[0].refs, ['A', 'B']);

  // Calling again should not duplicate
  ensureSegment(doc, 'B', 'A');
  assert.equal(doc.shapes.length, 1);
});

test('ensureSegment does not create segment if polygon already connects vertices', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 3, y: 0 },
    { id: 'C', x: 1, y: 2 }
  ];
  doc.shapes.push({ id: 's1', type: 'polygon', refs: ['A', 'B', 'C'] });
  ensureSegment(doc, 'A', 'B');
  assert.equal(doc.shapes.length, 1);
});

test('incenter/circumcenter contextual helper adds missing triangle edges', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 4, y: 0 },
    { id: 'C', x: 0, y: 3 }
  ];
  const refs = ['A', 'B', 'C'];
  ensureSegment(doc, refs[0], refs[1]);
  ensureSegment(doc, refs[1], refs[2]);
  ensureSegment(doc, refs[2], refs[0]);

  assert.equal(doc.shapes.length, 3);
  const segments = doc.shapes.map(s => s.refs.join('-'));
  assert.ok(segments.includes('A-B'));
  assert.ok(segments.includes('B-C'));
  assert.ok(segments.includes('C-A'));
});
