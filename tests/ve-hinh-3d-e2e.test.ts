import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blankDocument,
  validateDocument,
  resolve,
  movePoint,
  removePoint
} from '../public/ve-hinh/src/math.js';

import {
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

import {
  project3D,
  screen3D
} from '../public/ve-hinh/src/engine3d/projection.js';

import {
  compute3DOcclusion
} from '../public/ve-hinh/src/engine3d/occlusion.js';

import {
  exportTikZ3D
} from '../public/ve-hinh/src/engine3d/tikz3d.js';

import {
  exportTikZ
} from '../public/ve-hinh/src/tikz.js';

import {
  solidSVG,
  exportSVG
} from '../public/ve-hinh/src/render.js';

import {
  parseProposal,
  constructVietnamese3DProposal,
  createDrawingHandler
} from '../api/ve-hinh.js';

// ============================================================================
// TIER 4: REAL-WORLD VIETNAMESE HIGH SCHOOL GEOMETRY SCENARIOS
// ============================================================================

test('Scenario 1: Pyramid S.ABCD with square base, SA perp to base, M midpoint of SC, segment AM', () => {
  // 1. Construct via AI proposal
  const prompt = 'Cho hình chóp S.ABCD có đáy ABCD là hình vuông, SA vuông góc với đáy, M là trung điểm SC, đoạn thẳng AM';
  const proposal = constructVietnamese3DProposal(prompt);
  assert.ok(proposal);

  const parsed = parseProposal(JSON.stringify(proposal));
  const doc = parsed.document;
  assert.equal(doc.solid.enabled, true);

  // 2. Mathematical validation and resolution
  validateDocument(doc);
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);

  // 3. Occlusion calculation for canonical camera angle (rotation: 30, tilt: 20)
  const occlusion = compute3DOcclusion(doc.solid, { rotation: 30, tilt: 20 });
  assert.ok(occlusion.dashedSegmentIds.size > 0, 'Should detect occluded dashed edges');
  // SA, AB, AD are typically hidden in standard THPT projection
  assert.ok(occlusion.dashedSegmentIds.has('SA') || occlusion.dashedSegmentIds.has('AB') || occlusion.dashedSegmentIds.has('DA'));

  // 4. TikZ LaTeX export
  const tikzCode = exportTikZ(doc, { rotation: 30, tilt: 20 });
  assert.ok(tikzCode.includes('\\begin{tikzpicture}'));
  assert.ok(tikzCode.includes('\\draw[dashed]'));
  assert.ok(tikzCode.includes('\\draw'));
  assert.ok(tikzCode.includes('node') && tikzCode.includes('$S$'));
  assert.ok(tikzCode.includes('$M$'));
  assert.ok(tikzCode.includes('\\end{tikzpicture}'));

  // 5. High-resolution SVG export
  doc.solid.rotation = 30;
  doc.solid.tilt = 20;
  const svg = solidSVG(doc.solid);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('data-vertex="S"'));
  assert.ok(svg.includes('data-vertex="M"'));
  assert.ok(svg.includes('stroke-dasharray="8 7"'));
});

test('Scenario 2: Regular triangle pyramid S.ABC with SO perp to base (ABC), I midpoint of SA', () => {
  // Construct regular pyramid S.ABC
  let doc = create3DPrimitive('pyramid3');
  // Add midpoint I of SA
  doc = createMidpoint3D(doc, 'S', 'A', { id: 'I', label: 'I' });
  // Add segment BI
  doc = createSegment3D(doc, 'B', 'I', { color: '#2563eb' });

  // Resolve
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);
  assert.ok(res.points['I']);

  // Check TikZ export
  const tikz = exportTikZ3D(doc, { rotation: 45, tilt: 25 });
  assert.ok(tikz.includes('$I$'));
  assert.ok(tikz.includes('$B$'));
});

test('Scenario 3: Right triangular prism ABC.A1B1C1 with auxiliary diagonal A1B', () => {
  let doc = create3DPrimitive('prism');
  // Connect diagonal A1B
  doc = createSegment3D(doc, 'A1', 'B', { color: '#059669', styleMode: 'auto' });

  validateDocument(doc);
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);

  // SVG rendering
  const svg = exportSVG(doc, 'solid');
  assert.ok(svg.includes('data-vertex="A1"'));
  assert.ok(svg.includes('data-vertex="B"'));
});

test('Scenario 4: Cube ABCD.A1B1C1D1 with cross-section plane (AB1D1)', () => {
  let doc = create3DPrimitive('cube');
  // Create cutting plane cross section through A, B1, D1
  doc = createCrossSection3D(doc, ['A', 'B1', 'D1'], { color: '#e11d48', opacity: 0.3 });
  // Connect section edges AB1, B1D1, D1A
  doc = createSegment3D(doc, 'A', 'B1', { color: '#e11d48' });
  doc = createSegment3D(doc, 'B1', 'D1', { color: '#e11d48' });
  doc = createSegment3D(doc, 'D1', 'A', { color: '#e11d48' });

  validateDocument(doc);
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);
  assert.equal(doc.solid.crossSections.length, 1);

  // TikZ export contains filled cross-section polygon
  const tikz = exportTikZ3D(doc);
  assert.ok(tikz.includes('\\fill[fill='));
  assert.ok(tikz.includes('(A) -- (B1) -- (D1) -- cycle'));
});

test('Scenario 5: Full workflow from prompt -> backend handler -> parseProposal -> TikZ export', async () => {
  const prompt = 'Cho hình chóp S.ABCD có đáy ABCD là hình vuông, SA vuông góc với đáy, M là trung điểm SC';
  const proposal = constructVietnamese3DProposal(prompt);
  assert.ok(proposal);

  const serialized = JSON.stringify(proposal);
  const parsed = parseProposal(serialized);
  assert.ok(parsed.document.solid);

  const tikz = exportTikZ(parsed.document);
  assert.ok(tikz.includes('\\begin{tikzpicture}'));
  assert.ok(tikz.includes('M'));
});

// ============================================================================
// TIER 5: ADVERSARIAL STRESS TESTING & HARSH BOUNDARY EXTREMES
// ============================================================================

test('Adversarial 5.1: Extreme camera gimbal orientations (top-down +80°, bottom-up -80°, full yaw sweep)', () => {
  const doc = create3DPrimitive('pyramid4');

  // Sweep rotation 360 degrees in 30 degree steps at extreme tilt angles
  for (const tilt of [-80, -45, 0, 45, 80]) {
    for (let rot = -180; rot <= 180; rot += 45) {
      const occl = compute3DOcclusion(doc.solid, { rotation: rot, tilt });
      assert.ok(occl.dashedSegmentIds instanceof Set);
      assert.ok(occl.solidSegmentIds instanceof Set);

      // SVG render should never throw or produce NaN coordinates
      const rotatedSolid = { ...doc.solid, rotation: rot, tilt };
      const svg = solidSVG(rotatedSolid);
      assert.ok(!svg.includes('NaN'));
      assert.ok(!svg.includes('undefined'));

      // TikZ export should never produce NaN
      const tikz = exportTikZ3D(doc, { rotation: rot, tilt });
      assert.ok(!tikz.includes('NaN'));
    }
  }
});

test('Adversarial 5.2: Geometric degeneracy tests in resolve and occlusion', () => {
  // Test zero-length segment should be detected as degenerate
  let doc = create3DPrimitive('pyramid4');
  doc.solid.points.push({ id: 'P_DUP', x: -1.8, y: -1.2, z: -1.2 }); // Same as A
  doc.solid.segments.push({ id: 'seg_degenerate', refs: ['A', 'P_DUP'] });

  const res = resolve(doc);
  assert.ok(res.errors.length > 0, 'Must catch coincident vertices in segment');
  assert.ok(res.errors.some(e => e.includes('Hai điểm trùng nhau, đối tượng suy biến')));
});

test('Adversarial 5.3: Rapid 50-step orbit drag & Undo/Redo session stability', () => {
  const initial = create3DPrimitive('pyramid4');
  const session = create3DHistorySession(initial);

  // 50 sequential orbit turns
  for (let i = 0; i < 50; i++) {
    const turned = apply3DOrbit(session.doc, 15, (i % 2 === 0 ? 5 : -5));
    session.commit(turned);
  }

  assert.equal(session.history.length, 50);

  // Undo 25 times
  for (let i = 0; i < 25; i++) {
    session.undo();
  }
  assert.equal(session.history.length, 25);
  assert.equal(session.future.length, 25);

  // Redo 25 times
  for (let i = 0; i < 25; i++) {
    session.redo();
  }
  assert.equal(session.history.length, 50);
  assert.equal(session.future.length, 0);

  // Verify resulting document is valid and resolves
  validateDocument(session.doc);
  const res = resolve(session.doc);
  assert.equal(res.errors.length, 0);
});

test('Adversarial 5.4: Manual override styleMode persistence across angle rotations', () => {
  let doc = create3DPrimitive('pyramid4');
  // Manually force SA to be solid and SC to be dashed
  doc = toggleSegmentStyle(doc, 'SA', 'solid');
  doc = toggleSegmentStyle(doc, 'SC', 'dashed');

  // Verify that regardless of rotation angle, SA stays solid and SC stays dashed
  for (const rot of [-120, -60, 0, 60, 120, 180]) {
    const occl = compute3DOcclusion(doc.solid, { rotation: rot, tilt: 20 });
    assert.ok(occl.solidSegmentIds.has('SA'), `SA must remain solid at rot=${rot}`);
    assert.ok(occl.dashedSegmentIds.has('SC'), `SC must remain dashed at rot=${rot}`);
  }
});

test('Adversarial 5.5: Point mutation and deletion cascade in 3D scene', () => {
  let doc = create3DPrimitive('pyramid4');
  doc = createMidpoint3D(doc, 'S', 'C', { id: 'M' });
  doc = createSegment3D(doc, 'A', 'M');
  assert.equal(doc.solid.points.length, 6);
  assert.ok(doc.solid.segments.some(s => s.refs.includes('M')));

  // Remove vertex C: should cascade and remove M and segment AM
  const afterRemove = removePoint(doc, 'C');
  assert.ok(!afterRemove.solid.points.some(p => p.id === 'C'));
  assert.ok(!afterRemove.solid.points.some(p => p.id === 'M'), 'Dependent M should be removed');
  assert.ok(!afterRemove.solid.segments.some(s => s.refs.includes('C')), 'Segments to C removed');
  assert.ok(!afterRemove.solid.segments.some(s => s.refs.includes('M')), 'Segments to M removed');

  // Validates cleanly after cascading delete
  validateDocument(afterRemove);
  const res = resolve(afterRemove);
  assert.equal(res.errors.length, 0);
});
