import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blankDocument,
  validateDocument,
  resolve,
  construct
} from '../public/ve-hinh/src/math.js';

import {
  tools3D,
  create3DPrimitive,
  createSegment3D,
  createMidpoint3D,
  createRatio3D,
  createAltitude3D,
  createCrossSection3D,
  toggleSegmentStyle,
  apply3DOrbit,
  create3DHistorySession
} from '../public/ve-hinh/src/app.js';

test('Challenger M3.1: Complex multi-step construction on Pyramid S.ABCD', () => {
  let doc = create3DPrimitive('pyramid4');

  // Step 1: Create midpoint M of SC
  doc = createMidpoint3D(doc, 'S', 'C', { id: 'M', label: 'M' });
  // Step 2: Create midpoint N of SB
  doc = createMidpoint3D(doc, 'S', 'B', { id: 'N', label: 'N' });
  // Step 3: Connect segment MN
  doc = createSegment3D(doc, 'M', 'N', { color: '#e11d48' });
  // Step 4: Connect AM
  doc = createSegment3D(doc, 'A', 'M', { color: '#2563eb' });
  // Step 5: Connect AN
  doc = createSegment3D(doc, 'A', 'N', { color: '#2563eb' });
  // Step 6: Create Cross Section plane (AMN)
  doc = createCrossSection3D(doc, ['A', 'M', 'N'], { color: '#f59e0b', opacity: 0.25 });

  // Verify document validation passes
  const validated = validateDocument(doc);
  assert.ok(validated);

  // Verify mathematical resolution
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);

  // Verify points coordinates
  const pS = res.points['S'];
  const pC = res.points['C'];
  const pM = res.points['M'];
  assert.ok(Math.abs(pM.x - (pS.x + pC.x) / 2) < 1e-4);
  assert.ok(Math.abs(pM.y - (pS.y + pC.y) / 2) < 1e-4);
  assert.ok(Math.abs(pM.z - (pS.z + pC.z) / 2) < 1e-4);

  // Cross section plane is registered
  assert.equal(doc.solid.crossSections.length, 1);
  assert.deepEqual(doc.solid.crossSections[0].planeRefs, ['A', 'M', 'N']);
});

test('Challenger M3.2: Edge cases in construct and resolve altitude with collinear points', () => {
  const S = { id: 'S', x: 0, y: 3, z: 0 };
  const P1 = { id: 'P1', x: 0, y: 0, z: 0 };
  const P2 = { id: 'P2', x: 1, y: 0, z: 0 };
  const P3 = { id: 'P3', x: 2, y: 0, z: 0 };

  // Attempting to construct foot onto 3 collinear points throws explicit error
  assert.throws(() => {
    construct({ id: 'H', kind: 'foot', refs: ['S', 'P1', 'P2', 'P3'] }, [S, P1, P2, P3]);
  }, /Ba điểm mặt phẳng thẳng hàng/);

  // Resolve collects the error cleanly without crashing
  let doc = create3DPrimitive('pyramid4');
  doc.solid.points.push(P1, P2, P3);
  doc = createAltitude3D(doc, 'S', ['P1', 'P2', 'P3']);
  const res = resolve(doc);
  assert.ok(res.errors.length > 0);
  assert.ok(res.errors.some(e => e.includes('Ba điểm mặt phẳng thẳng hàng')));
});

test('Challenger M3.3: apply3DOrbit extreme angles and normalization', () => {
  const doc = create3DPrimitive('pyramid4', { rotation: 0, tilt: 0 });

  // Rotate huge positive rotation and positive tilt
  const turned1 = apply3DOrbit(doc, 7200, 500); // 7200 deg delta, tilt clamped to 80
  assert.equal(turned1.solid.tilt, 80);
  assert.ok(turned1.solid.rotation >= -180 && turned1.solid.rotation <= 180);

  // Rotate huge negative tilt
  const turned2 = apply3DOrbit(doc, 0, -1000); // tilt clamped to -80
  assert.equal(turned2.solid.tilt, -80);
});

test('Challenger M3.4: 3-state toggleSegmentStyle cycling and non-existent segments', () => {
  let doc = create3DPrimitive('pyramid4');
  const segAB = doc.solid.segments.find(s => s.id === 'AB');
  assert.ok(segAB);
  assert.equal(segAB.styleMode, 'auto');

  // auto -> solid
  doc = toggleSegmentStyle(doc, 'AB');
  assert.equal(doc.solid.segments.find(s => s.id === 'AB').styleMode, 'solid');

  // solid -> dashed
  doc = toggleSegmentStyle(doc, 'AB');
  assert.equal(doc.solid.segments.find(s => s.id === 'AB').styleMode, 'dashed');

  // dashed -> auto
  doc = toggleSegmentStyle(doc, 'AB');
  assert.equal(doc.solid.segments.find(s => s.id === 'AB').styleMode, 'auto');

  // Non-existent segment should safely return doc unchanged
  const unchanged = toggleSegmentStyle(doc, 'NON_EXISTENT');
  assert.equal(unchanged.solid.segments.length, doc.solid.segments.length);
});

test('Challenger M3.5: Undo/Redo history session stress test', () => {
  const session = create3DHistorySession(create3DPrimitive('cube'));
  assert.equal(session.history.length, 0);
  assert.equal(session.future.length, 0);

  // Perform 10 sequential additions
  for (let i = 1; i <= 10; i++) {
    const nextDoc = createRatio3D(session.doc, 'A', 'B', i / 10, { id: `R${i}` });
    session.commit(nextDoc);
  }

  assert.equal(session.doc.solid.points.length, 8 + 10);
  assert.equal(session.history.length, 10);
  assert.equal(session.future.length, 0);

  // Undo 5 times
  for (let i = 0; i < 5; i++) {
    session.undo();
  }
  assert.equal(session.doc.solid.points.length, 8 + 5);
  assert.equal(session.history.length, 5);
  assert.equal(session.future.length, 5);

  // Redo 2 times
  session.redo();
  session.redo();
  assert.equal(session.doc.solid.points.length, 8 + 7);
  assert.equal(session.history.length, 7);
  assert.equal(session.future.length, 3);

  // Branch commit: new change clears redo future
  const branchDoc = createSegment3D(session.doc, 'A', 'C1');
  session.commit(branchDoc);
  assert.equal(session.future.length, 0);
  assert.ok(session.doc.solid.segments.some(s => s.refs.includes('A') && s.refs.includes('C1')));
});
