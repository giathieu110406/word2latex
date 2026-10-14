import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  blankDocument,
  validateDocument,
  resolve
} from '../public/ve-hinh/src/math.js';

import {
  tools3D,
  primitiveNames,
  freshSolidPointId,
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('3D Quick Primitives: all 6 primitives generate valid documents with correct geometry', () => {
  const types = ['pyramid4', 'pyramid3', 'regular-pyramid', 'prism', 'box', 'cube'];

  for (const type of types) {
    const doc = create3DPrimitive(type);
    assert.ok(doc.solid, `Doc should have solid structure for ${type}`);
    assert.equal(doc.solid.enabled, true);

    // Document validation must pass
    const validated = validateDocument(doc);
    assert.ok(validated);

    // Mathematical resolution of points
    const res = resolve(doc);
    assert.equal(res.errors.length, 0, `No resolution errors for ${type}`);

    // Verify specific vertex and edge counts
    if (type === 'pyramid4') {
      assert.equal(doc.solid.points.length, 5); // S, A, B, C, D
      assert.equal(doc.solid.segments.length, 8);
      assert.ok(doc.solid.points.some(p => p.id === 'S'));
      assert.ok(doc.solid.points.some(p => p.id === 'A'));
    } else if (type === 'pyramid3') {
      assert.equal(doc.solid.points.length, 4); // S, A, B, C
      assert.equal(doc.solid.segments.length, 6);
      assert.ok(doc.solid.points.some(p => p.id === 'S'));
    } else if (type === 'regular-pyramid') {
      assert.equal(doc.solid.points.length, 5);
      assert.equal(doc.solid.segments.length, 8);
      const apex = doc.solid.points.find(p => p.id === 'S');
      assert.equal(apex?.x, 0);
      assert.equal(apex?.z, 0);
    } else if (type === 'prism') {
      assert.equal(doc.solid.points.length, 6); // A, B, C, A', B', C'
      assert.equal(doc.solid.segments.length, 9);
      assert.ok(doc.solid.points.some(p => p.id === 'A1'));
    } else if (type === 'box') {
      assert.equal(doc.solid.points.length, 8);
      assert.equal(doc.solid.segments.length, 12);
    } else if (type === 'cube') {
      assert.equal(doc.solid.points.length, 8);
      assert.equal(doc.solid.segments.length, 12);
      // All edges equal in cube
      const pA = doc.solid.points.find(p => p.id === 'A')!;
      const pB = doc.solid.points.find(p => p.id === 'B')!;
      const edge = Math.abs(pB.x - pA.x);
      assert.ok(Math.abs(edge - 2.6) < 1e-4);
    }
  }
});

test('freshSolidPointId generates unique IDs considering both 2D and 3D points', () => {
  const doc = blankDocument();
  doc.points = [{ id: 'A', x: 0, y: 0 }];
  doc.solid = {
    enabled: true,
    type: 'custom',
    rotation: 30,
    tilt: 20,
    points: [{ id: 'B', x: 1, y: 1, z: 1 }, { id: 'M', x: 2, y: 2, z: 2 }],
    segments: [],
    planes: []
  };

  assert.equal(freshSolidPointId(doc, 'P'), 'P');
  assert.equal(freshSolidPointId(doc, 'A'), 'A1');
  assert.equal(freshSolidPointId(doc, 'M'), 'M1');

  doc.solid.points.push({ id: 'M1', x: 0, y: 0, z: 0 });
  assert.equal(freshSolidPointId(doc, 'M'), 'M2');
});

test('createSegment3D: connects vertices, prevents self-loops and duplicates', () => {
  const base = create3DPrimitive('pyramid4');

  // Connect A and C (diagonal of base)
  const docWithAC = createSegment3D(base, 'A', 'C', { color: '#0055ff' });
  assert.equal(docWithAC.solid.segments.length, base.solid.segments.length + 1);
  const acSeg = docWithAC.solid.segments.find(s => s.refs.includes('A') && s.refs.includes('C'));
  assert.ok(acSeg);
  assert.equal(acSeg?.color, '#0055ff');

  // Prevent duplicate segment (in either direction)
  const dup1 = createSegment3D(docWithAC, 'A', 'C');
  assert.equal(dup1.solid.segments.length, docWithAC.solid.segments.length);
  const dup2 = createSegment3D(docWithAC, 'C', 'A');
  assert.equal(dup2.solid.segments.length, docWithAC.solid.segments.length);

  // Prevent self-loop
  assert.throws(() => {
    createSegment3D(base, 'A', 'A');
  }, /Hai đầu đoạn phải là 2 đỉnh khác nhau/);

  // Non-existent vertex throws
  assert.throws(() => {
    createSegment3D(base, 'A', 'UNKNOWN_VERTEX');
  }, /Đỉnh nối không tồn tại/);
});

test('createMidpoint3D: creates geometric midpoint and resolves coordinates', () => {
  const base = create3DPrimitive('pyramid4');
  const docWithMid = createMidpoint3D(base, 'S', 'A', { id: 'M', label: 'M' });

  assert.equal(docWithMid.solid.points.length, base.solid.points.length + 1);
  const mPoint = docWithMid.solid.points.find(p => p.id === 'M');
  assert.ok(mPoint);
  assert.equal(mPoint?.kind, 'midpoint');
  assert.deepEqual(mPoint?.refs, ['S', 'A']);

  // Verify mathematical resolution
  const res = resolve(docWithMid);
  assert.equal(res.errors.length, 0);

  const ptS = res.points['S'];
  const ptA = res.points['A'];
  const ptM = res.points['M'];

  assert.ok(ptS && ptA && ptM);
  assert.ok(Math.abs(ptM.x - (ptS.x + ptA.x) / 2) < 1e-4);
  assert.ok(Math.abs(ptM.y - (ptS.y + ptA.y) / 2) < 1e-4);
  assert.ok(Math.abs(ptM.z - (ptS.z + ptA.z) / 2) < 1e-4);
});

test('createRatio3D: creates point dividing segment with ratio t', () => {
  const base = create3DPrimitive('pyramid4');
  const t = 0.25;
  const docWithRatio = createRatio3D(base, 'S', 'B', t, { id: 'P_ratio', label: 'P' });

  const pPt = docWithRatio.solid.points.find(p => p.id === 'P_ratio');
  assert.ok(pPt);
  assert.equal(pPt?.kind, 'ratio');
  assert.equal(pPt?.t, 0.25);

  const res = resolve(docWithRatio);
  assert.equal(res.errors.length, 0);

  const ptS = res.points['S'];
  const ptB = res.points['B'];
  const ptP = res.points['P_ratio'];

  // P = S + t * (B - S) = (1-t)*S + t*B
  const expectedX = (1 - t) * ptS.x + t * ptB.x;
  const expectedY = (1 - t) * ptS.y + t * ptB.y;
  const expectedZ = (1 - t) * ptS.z + t * ptB.z;

  assert.ok(Math.abs(ptP.x - expectedX) < 1e-4);
  assert.ok(Math.abs(ptP.y - expectedY) < 1e-4);
  assert.ok(Math.abs(ptP.z - expectedZ) < 1e-4);
});

test('createAltitude3D: drops altitude from apex to base plane', () => {
  const base = create3DPrimitive('pyramid4');
  // Drop altitude from S to base plane ABC
  const docWithAlt = createAltitude3D(base, 'S', ['A', 'B', 'C'], { footId: 'H', footLabel: 'H' });

  const foot = docWithAlt.solid.points.find(p => p.id === 'H');
  assert.ok(foot);
  assert.equal(foot?.kind, 'foot');
  assert.deepEqual(foot?.refs, ['S', 'A', 'B', 'C']);

  // Altitude segment SH
  const altSeg = docWithAlt.solid.segments.find(s => s.refs.includes('S') && s.refs.includes('H'));
  assert.ok(altSeg);

  const res = resolve(docWithAlt);
  assert.equal(res.errors.length, 0);
  assert.ok(res.points['H']);
});

test('createCrossSection3D: creates cross section plane with custom color and opacity', () => {
  const base = create3DPrimitive('pyramid4');
  // Cross section passing through S, A, C
  const docWithCS = createCrossSection3D(base, ['S', 'A', 'C'], { color: '#ff5500', opacity: 0.4 });

  assert.equal(docWithCS.solid.crossSections.length, 1);
  const cs = docWithCS.solid.crossSections[0];
  assert.deepEqual(cs.planeRefs, ['S', 'A', 'C']);
  assert.equal(cs.color, '#ff5500');
  assert.equal(cs.opacity, 0.4);

  const validated = validateDocument(docWithCS);
  assert.ok(validated);
});

test('toggleSegmentStyle: 3-state dash toggle cycles correctly (auto -> solid -> dashed -> auto)', () => {
  let doc = create3DPrimitive('pyramid4');
  const segId = 'SA';

  // Initially styleMode is 'auto'
  assert.equal(doc.solid.segments.find(s => s.id === segId)?.styleMode, 'auto');

  // Cycle 1: auto -> solid
  doc = toggleSegmentStyle(doc, segId);
  assert.equal(doc.solid.segments.find(s => s.id === segId)?.styleMode, 'solid');

  // Cycle 2: solid -> dashed
  doc = toggleSegmentStyle(doc, segId);
  assert.equal(doc.solid.segments.find(s => s.id === segId)?.styleMode, 'dashed');

  // Cycle 3: dashed -> auto
  doc = toggleSegmentStyle(doc, segId);
  assert.equal(doc.solid.segments.find(s => s.id === segId)?.styleMode, 'auto');

  // Explicit target mode
  doc = toggleSegmentStyle(doc, segId, 'dashed');
  assert.equal(doc.solid.segments.find(s => s.id === segId)?.styleMode, 'dashed');

  doc = toggleSegmentStyle(doc, segId, 'solid');
  assert.equal(doc.solid.segments.find(s => s.id === segId)?.styleMode, 'solid');
});

test('apply3DOrbit: smoothly rotates angles and clamps tilt between -80 and +80', () => {
  let doc = create3DPrimitive('pyramid4');
  doc.solid.rotation = 30;
  doc.solid.tilt = 20;

  // Normal rotation and tilt delta
  doc = apply3DOrbit(doc, 45, 15);
  assert.equal(doc.solid.rotation, 75);
  assert.equal(doc.solid.tilt, 35);

  // Tilt clamping at upper limit +80
  doc = apply3DOrbit(doc, 0, 100);
  assert.equal(doc.solid.tilt, 80);

  // Tilt clamping at lower limit -80
  doc = apply3DOrbit(doc, 0, -200);
  assert.equal(doc.solid.tilt, -80);

  // Rotation wrapping around 360 degrees: 75 + 300 = 375 -> 15 degrees (-180..180)
  doc = apply3DOrbit(doc, 300, 0);
  assert.equal(doc.solid.rotation, 15);
});

test('create3DHistorySession: full undo / redo integration for multi-step 3D construction workflow', () => {
  const session = create3DHistorySession();
  assert.equal(session.history.length, 0);
  assert.equal(session.future.length, 0);

  // Step 1: create pyramid primitive
  const doc1 = create3DPrimitive('pyramid4', { baseDoc: session.doc });
  session.commit(doc1);
  assert.equal(session.history.length, 1);
  assert.equal(session.doc.solid.points.length, 5);

  // Step 2: create segment AC
  const doc2 = createSegment3D(session.doc, 'A', 'C');
  session.commit(doc2);
  assert.equal(session.history.length, 2);
  assert.equal(session.doc.solid.segments.length, 9);

  // Step 3: create midpoint M of SA
  const doc3 = createMidpoint3D(session.doc, 'S', 'A', { id: 'M' });
  session.commit(doc3);
  assert.equal(session.history.length, 3);
  assert.equal(session.doc.solid.points.length, 6);

  // Step 4: create altitude from S to base ABC
  const doc4 = createAltitude3D(session.doc, 'S', ['A', 'B', 'C'], { footId: 'H' });
  session.commit(doc4);
  assert.equal(session.history.length, 4);
  assert.equal(session.doc.solid.points.length, 7);

  // Step 5: create cross section
  const doc5 = createCrossSection3D(session.doc, ['M', 'B', 'D']);
  session.commit(doc5);
  assert.equal(session.history.length, 5);
  assert.equal(session.doc.solid.crossSections.length, 1);

  // Undo step 5 (revert cross section)
  assert.ok(session.undo());
  assert.equal(session.doc.solid.crossSections.length, 0);
  assert.equal(session.future.length, 1);

  // Undo step 4 (revert altitude)
  assert.ok(session.undo());
  assert.equal(session.doc.solid.points.length, 6);
  assert.equal(session.future.length, 2);

  // Undo step 3 (revert midpoint)
  assert.ok(session.undo());
  assert.equal(session.doc.solid.points.length, 5);
  assert.equal(session.future.length, 3);

  // Redo step 3 (restore midpoint)
  assert.ok(session.redo());
  assert.equal(session.doc.solid.points.length, 6);
  assert.ok(session.doc.solid.points.some(p => p.id === 'M'));

  // Redo step 4 (restore altitude)
  assert.ok(session.redo());
  assert.equal(session.doc.solid.points.length, 7);
  assert.ok(session.doc.solid.points.some(p => p.id === 'H'));

  // Redo step 5 (restore cross section)
  assert.ok(session.redo());
  assert.equal(session.doc.solid.crossSections.length, 1);
  assert.equal(session.future.length, 0);
});

test('UI Static Verification: index.html contains all 3D toolbar primitives and tools', () => {
  const htmlPath = path.join(rootDir, 'public', 've-hinh', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Verify toolbar container
  assert.ok(html.includes('id="toolbar-3d"'), 'Must have #toolbar-3d');
  assert.ok(html.includes('id="tools-badge"'), 'Must have #tools-badge');
  assert.ok(html.includes('id="tools-heading"'), 'Must have #tools-heading');

  // Verify quick primitives
  const expectedPrimitives = ['pyramid4', 'pyramid3', 'regular-pyramid', 'prism', 'box', 'cube'];
  for (const prim of expectedPrimitives) {
    assert.ok(
      html.includes(`data-primitive-3d="${prim}"`),
      `index.html must contain primitive button for ${prim}`
    );
  }

  // Verify 3D tools
  const expectedTools = [
    'orbit3d',
    'select3d',
    'segment3d',
    'midpoint3d',
    'ratio3d',
    'altitude3d',
    'crosssection3d'
  ];
  for (const t of expectedTools) {
    assert.ok(
      html.includes(`data-tool="${t}"`),
      `index.html must contain 3D tool button for ${t}`
    );
  }
});

test('CSS Static Verification: style.css contains styling for 3D toolbar, 3-state toggle, and dark mode', () => {
  const cssPath = path.join(rootDir, 'public', 've-hinh', 'style.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.toolbar-3d'), 'CSS must style .toolbar-3d');
  assert.ok(css.includes('.dash-toggle-group'), 'CSS must style .dash-toggle-group');
  assert.ok(css.includes('.dash-toggle-btn'), 'CSS must style .dash-toggle-btn');
  assert.ok(css.includes('.solid-coords-grid'), 'CSS must style .solid-coords-grid');
  assert.ok(css.includes('.solid-card'), 'CSS must style .solid-card');
  assert.ok(css.includes('[data-vertex]'), 'CSS must style 3D vertices');
  assert.ok(css.includes('[data-segment-3d]'), 'CSS must style 3D segments');
  assert.ok(css.includes(':root.dark .dash-toggle-group'), 'CSS must style dark mode dash toggle');
  assert.ok(css.includes(':root.dark .toolbar-3d'), 'CSS must style dark mode 3D toolbar');
});
