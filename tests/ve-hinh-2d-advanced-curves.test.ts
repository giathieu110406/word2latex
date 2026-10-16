import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shapes,
  counts,
  blankDocument,
  validateDocument,
  resolve,
  construct,
  findSnapTarget
} from '../public/ve-hinh/src/math.js';

test('shapes & counts whitelist include advanced 2D curves and orthocenter', () => {
  // 1. Shapes whitelist
  assert.deepEqual(shapes.arc, [3, 3], 'arc requires exactly 3 points [O, A, B]');
  assert.deepEqual(shapes.sector, [3, 3], 'sector requires exactly 3 points [O, A, B]');
  assert.deepEqual(shapes.ellipse, [2, 3], 'ellipse requires 2 or 3 points [C, A] or [C, A, B]');

  // 2. Counts whitelist
  assert.equal(counts.orthocenter, 3, 'orthocenter requires exactly 3 triangle vertices');
  assert.equal(counts.centroid, 3, 'centroid requires 3 triangle vertices');
});

test('validateDocument accepts valid arc, sector, ellipse and extended mark styles', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'O', x: 0, y: 0 },
    { id: 'A', x: 3, y: 0 },
    { id: 'B', x: 0, y: 3 },
    { id: 'C', x: 0, y: 2 }
  ];
  doc.shapes = [
    { id: 'arc1', type: 'arc', refs: ['O', 'A', 'B'], color: '#176b52', dashed: true, strokeWidth: 2 },
    { id: 'sec1', type: 'sector', refs: ['O', 'A', 'B'], color: '#1d4ed8', fill: '#1d4ed8', fillOpacity: 0.25 },
    { id: 'ell1', type: 'ellipse', refs: ['O', 'A', 'C'], color: '#dc2626', strokeWidth: 1.5, fill: '#fee2e2', fillOpacity: 0.5, rx: 3, ry: 2 },
    { id: 'seg1', type: 'segment', refs: ['A', 'B'], mark: 'triple', color: '#176b52' },
    { id: 'ang1', type: 'angle', refs: ['A', 'O', 'B'], mark: 'single', color: '#d97706' },
    { id: 'ang2', type: 'angle', refs: ['A', 'O', 'B'], mark: 'double', color: '#7c3aed' }
  ];

  const validated = validateDocument(doc);
  assert.equal(validated.shapes.length, 6);
  assert.equal(validated.shapes[0].type, 'arc');
  assert.equal(validated.shapes[1].type, 'sector');
  assert.equal(validated.shapes[2].type, 'ellipse');
  assert.equal(validated.shapes[3].mark, 'triple');
  assert.equal(validated.shapes[4].mark, 'single');
});

test('validateDocument rejects invalid curve attributes and unknown marks', () => {
  const baseDoc = blankDocument();
  baseDoc.points = [{ id: 'O', x: 0, y: 0 }, { id: 'A', x: 2, y: 0 }, { id: 'B', x: 0, y: 2 }];

  // Invalid ref count for arc
  const docBadArcRefs = structuredClone(baseDoc);
  docBadArcRefs.shapes = [{ id: 'badArc', type: 'arc', refs: ['O', 'A'] }];
  assert.throws(() => validateDocument(docBadArcRefs), /Tham chiếu đối tượng không hợp lệ/);

  // Invalid ref count for ellipse (>3)
  const docBadEllRefs = structuredClone(baseDoc);
  docBadEllRefs.points.push({ id: 'D', x: 1, y: 1 });
  docBadEllRefs.shapes = [{ id: 'badEll', type: 'ellipse', refs: ['O', 'A', 'B', 'D'] }];
  assert.throws(() => validateDocument(docBadEllRefs), /Tham chiếu đối tượng không hợp lệ/);

  // Invalid color format
  const docBadColor = structuredClone(baseDoc);
  docBadColor.shapes = [{ id: 'badCol', type: 'arc', refs: ['O', 'A', 'B'], color: 'red' }];
  assert.throws(() => validateDocument(docBadColor), /Màu không hợp lệ/);

  // Invalid strokeWidth (non-positive or NaN)
  const docBadWidth = structuredClone(baseDoc);
  docBadWidth.shapes = [{ id: 'badW', type: 'arc', refs: ['O', 'A', 'B'], strokeWidth: -1 }];
  assert.throws(() => validateDocument(docBadWidth), /Độ dày nét không hợp lệ/);

  // Invalid fillOpacity (< 0 or > 1)
  const docBadOpacity = structuredClone(baseDoc);
  docBadOpacity.shapes = [{ id: 'badOp', type: 'sector', refs: ['O', 'A', 'B'], fillOpacity: 1.5 }];
  assert.throws(() => validateDocument(docBadOpacity), /Độ mờ không hợp lệ/);

  // Invalid mark
  const docBadMark = structuredClone(baseDoc);
  docBadMark.shapes = [{ id: 'badMk', type: 'segment', refs: ['O', 'A'], mark: 'quadruple' as any }];
  assert.throws(() => validateDocument(docBadMark), /Ký hiệu không hợp lệ/);
});

test('construct and resolve orthocenter H using Euler formula H = A + B + C - 2O', () => {
  // Test Case 1: Right-angle triangle at A: A(0,0), B(4,0), C(0,3) -> H must be (0,0)
  const H_right = construct({ kind: 'orthocenter' }, [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 3 }
  ]);
  assert.ok(Math.abs(H_right.x - 0) < 1e-6, `Expected H.x ≈ 0, got ${H_right.x}`);
  assert.ok(Math.abs(H_right.y - 0) < 1e-6, `Expected H.y ≈ 0, got ${H_right.y}`);

  // Test Case 2: Acute isosceles triangle: A(0, 4), B(-3, 0), C(3, 0)
  // Circumcenter O is (0, 0.875). Euler: H = A + B + C - 2*O = (0, 4) - (0, 1.75) = (0, 2.25)
  const H_acute = construct({ kind: 'orthocenter' }, [
    { x: 0, y: 4 },
    { x: -3, y: 0 },
    { x: 3, y: 0 }
  ]);
  assert.ok(Math.abs(H_acute.x - 0) < 1e-6, `Expected H.x ≈ 0, got ${H_acute.x}`);
  assert.ok(Math.abs(H_acute.y - 2.25) < 1e-6, `Expected H.y ≈ 2.25, got ${H_acute.y}`);

  // Test Case 3: Collinear points guard against division by zero
  assert.throws(
    () => construct({ kind: 'orthocenter' }, [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]),
    /thẳng hàng/
  );

  // Test Case 4: Complete Document Resolve with orthocenter
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 4, y: 0 },
    { id: 'C', x: 0, y: 3 },
    { id: 'H', kind: 'orthocenter', refs: ['A', 'B', 'C'] }
  ];
  const { points, errors } = resolve(doc);
  assert.equal(errors.length, 0);
  assert.ok(Math.abs(points.H.x - 0) < 1e-6);
  assert.ok(Math.abs(points.H.y - 0) < 1e-6);
});

test('resolve identifies degenerate curves with zero radius or coinciding centers', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'O', x: 1, y: 1 },
    { id: 'A', x: 1, y: 1 }, // Coincides with O
    { id: 'B', x: 2, y: 2 }
  ];
  doc.shapes = [
    { id: 'degArc', type: 'arc', refs: ['O', 'A', 'B'] },
    { id: 'degEll', type: 'ellipse', refs: ['O', 'A'] }
  ];
  const { errors } = resolve(doc);
  assert.ok(errors.some(e => e.includes('degArc') && e.includes('Bán kính cung/quạt tròn bằng 0')));
  assert.ok(errors.some(e => e.includes('degEll') && e.includes('Bán trục chính elip bằng 0')));
});

test('findSnapTarget snaps accurately to Arc midpoint', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'O', x: 0, y: 0, visible: true },
    { id: 'A', x: 2, y: 0, visible: true },
    { id: 'B', x: 0, y: 2, visible: true }
  ];
  doc.shapes = [
    { id: 'myArc', type: 'arc', refs: ['O', 'A', 'B'] }
  ];

  // Arc from 0 to 90 deg has midpoint at (sqrt(2), sqrt(2)) ≈ (1.4142, 1.4142)
  const expectedX = Math.SQRT2;
  const expectedY = Math.SQRT2;

  // Query near the arc midpoint (within radius 0.28)
  const snap = findSnapTarget(1.40, 1.40, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snap.type, 'midpoint');
  assert.equal(snap.refId, 'myArc');
  assert.ok(Math.abs(snap.x - expectedX) < 1e-4);
  assert.ok(Math.abs(snap.y - expectedY) < 1e-4);

  // Query far from midpoint (outside radius)
  const missSnap = findSnapTarget(0.5, 0.5, doc, { radius: 0.28, snapMidpoints: true });
  assert.notEqual(missSnap.refId, 'myArc');
});

test('findSnapTarget snaps accurately to Ellipse major and minor axis vertices', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'C', x: 0, y: 0, visible: true },
    { id: 'A', x: 5, y: 0, visible: true }
  ];
  // Ellipse with center (0, 0), rx = 5, ry = 3
  doc.shapes = [
    { id: 'myEll', type: 'ellipse', refs: ['C', 'A'], ry: 3 }
  ];

  // Negative major axis vertex at (-5, 0)
  const snapMajorNeg = findSnapTarget(-4.95, 0.05, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snapMajorNeg.type, 'midpoint');
  assert.equal(snapMajorNeg.refId, 'myEll');
  assert.ok(Math.abs(snapMajorNeg.x - (-5)) < 1e-4);
  assert.ok(Math.abs(snapMajorNeg.y - 0) < 1e-4);

  // Positive minor axis vertex at (0, 3)
  const snapMinorPos = findSnapTarget(0.04, 2.96, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snapMinorPos.type, 'midpoint');
  assert.equal(snapMinorPos.refId, 'myEll');
  assert.ok(Math.abs(snapMinorPos.x - 0) < 1e-4);
  assert.ok(Math.abs(snapMinorPos.y - 3) < 1e-4);

  // Negative minor axis vertex at (0, -3)
  const snapMinorNeg = findSnapTarget(-0.04, -2.96, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snapMinorNeg.type, 'midpoint');
  assert.equal(snapMinorNeg.refId, 'myEll');
  assert.ok(Math.abs(snapMinorNeg.x - 0) < 1e-4);
  assert.ok(Math.abs(snapMinorNeg.y - (-3)) < 1e-4);
});

test('construct orthocenter in 3D space with coordinates (x, y, z)', () => {
  // Right-angle triangle in 3D at A(0, 0, 1): B(4, 0, 1), C(0, 3, 1) -> H must be (0, 0, 1)
  const H_3d = construct({ kind: 'orthocenter' }, [
    { x: 0, y: 0, z: 1 },
    { x: 4, y: 0, z: 1 },
    { x: 0, y: 3, z: 1 }
  ]);
  assert.ok(Math.abs(H_3d.x - 0) < 1e-6);
  assert.ok(Math.abs(H_3d.y - 0) < 1e-6);
  assert.ok(Math.abs(H_3d.z - 1) < 1e-6);

  // Collinear points in 3D guard
  assert.throws(
    () => construct({ kind: 'orthocenter' }, [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
      { x: 2, y: 2, z: 2 }
    ]),
    /thẳng hàng/
  );
});

test('app.js declares all 6 new 2D tools and categorizes them in toolGroups', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const appContent = await fs.readFile(path.resolve('public/ve-hinh/src/app.js'), 'utf-8');

  // Verify tool definitions in tools array
  assert.ok(appContent.includes("['arc','⌒','Cung tròn',3"), 'arc tool declared');
  assert.ok(appContent.includes("['sector','⌔','Hình quạt',3"), 'sector tool declared');
  assert.ok(appContent.includes("['ellipse','⬭','Elip',3"), 'ellipse tool declared');
  assert.ok(appContent.includes("['rightAngle','∟','Góc vuông',3"), 'rightAngle tool declared');
  assert.ok(appContent.includes("['centroid','◬','Trọng tâm',3"), 'centroid tool declared');
  assert.ok(appContent.includes("['orthocenter','⟂','Trực tâm',3"), 'orthocenter tool declared');

  // Verify categorization in toolGroups
  assert.ok(appContent.includes("'arc'") && appContent.includes("'sector'") && appContent.includes("'ellipse'"), 'arc, sector, ellipse in Basic group');
  assert.ok(appContent.includes("'centroid'") && appContent.includes("'orthocenter'"), 'centroid, orthocenter in Relations group');
  assert.ok(appContent.includes("'rightAngle'"), 'rightAngle in Measurement group');
});
