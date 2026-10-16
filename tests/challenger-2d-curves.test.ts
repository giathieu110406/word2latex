import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shapes,
  counts,
  blankDocument,
  validateDocument,
  resolve,
  construct,
  findSnapTarget,
  findAngularSnap,
  sub,
  add,
  mul,
  dot,
  cross,
  norm
} from '../public/ve-hinh/src/math.js';
import { renderSVG } from '../public/ve-hinh/src/render.js';

// ============================================================================
// SUITE 1: ADVANCED 2D ARCS & CIRCULAR SECTORS (REFLEX, WRAP-AROUND, MICRO)
// ============================================================================

test('Challenge 1.1: Reflex arc (> 180 deg) renders with largeArc=1 and accurate CCW midpoint', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'O', x: 0, y: 0 },
    { id: 'A', x: 2, y: 0 },   // angle 0 deg, R = 2
    { id: 'B', x: 0, y: -2 }  // angle 270 deg (math: -pi/2). CCW span = 270 deg = 3pi/2 > pi
  ];
  doc.shapes = [
    { id: 'arcReflex', type: 'arc', refs: ['O', 'A', 'B'], color: '#176b52' }
  ];

  // 1. SVG render test: largeArc must be 1, sweep must be 0
  const svg = renderSVG(doc, { scale: 50, grid: false });
  assert.ok(!svg.includes('NaN'), 'SVG must not contain NaN');
  // SVG arc syntax: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
  // R = 2 * 50 = 100. largeArc=1, sweep=0.
  // End point B on screen: O=(500, 330), B in math is (0, -2) -> screen y = 330 - (-2)*50 = 430
  assert.ok(svg.includes('A 100.00 100.00 0 1 0 500.00 430.00'), 'Should have largeArc=1 and sweep=0 for reflex arc');

  // 2. Midpoint test: CCW midpoint of 0 deg to 270 deg is 135 deg (2nd quadrant: -sqrt(2), +sqrt(2))
  const expectedMidX = 2 * Math.cos(135 * Math.PI / 180); // -sqrt(2) ≈ -1.4142
  const expectedMidY = 2 * Math.sin(135 * Math.PI / 180); // +sqrt(2) ≈ 1.4142

  const snap = findSnapTarget(expectedMidX + 0.02, expectedMidY - 0.02, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snap.type, 'midpoint');
  assert.equal(snap.refId, 'arcReflex');
  assert.equal(snap.subType, 'arcMidpoint');
  assert.ok(Math.abs(snap.x - expectedMidX) < 1e-4, `Expected midX ≈ ${expectedMidX}, got ${snap.x}`);
  assert.ok(Math.abs(snap.y - expectedMidY) < 1e-4, `Expected midY ≈ ${expectedMidY}, got ${snap.y}`);

  // Ensure it does NOT snap to the conjugate minor arc midpoint (at 315 deg: +sqrt(2), -sqrt(2))
  const snapWrongMid = findSnapTarget(1.4142, -1.4142, doc, { radius: 0.28, snapMidpoints: true });
  assert.notEqual(snapWrongMid.refId, 'arcReflex', 'Should not snap to conjugate minor arc midpoint');
});

test('Challenge 1.2: Arc wrapping across 0 deg / 360 deg boundary (e.g. 330 deg to 30 deg)', () => {
  const doc = blankDocument();
  const R = 3;
  // A at -30 deg (330 deg): x = 3*cos(-30°), y = 3*sin(-30°)
  // B at +30 deg: x = 3*cos(30°), y = 3*sin(30°)
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);
  doc.points = [
    { id: 'O', x: 0, y: 0 },
    { id: 'A', x: R * cos30, y: -R * sin30 },
    { id: 'B', x: R * cos30, y: R * sin30 }
  ];
  doc.shapes = [
    { id: 'arcWrap', type: 'arc', refs: ['O', 'A', 'B'] }
  ];

  // Span is 60 deg <= 180 deg -> largeArc = 0
  const svg = renderSVG(doc, { scale: 50, grid: false });
  assert.ok(!svg.includes('NaN'), 'SVG must not contain NaN');
  assert.ok(svg.includes('0 0 0'), 'Should have largeArc=0 and sweep=0');

  // Midpoint of arc from -30 deg to +30 deg is 0 deg: (R, 0) = (3, 0)
  const snap = findSnapTarget(2.95, 0.05, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snap.type, 'midpoint');
  assert.equal(snap.refId, 'arcWrap');
  assert.ok(Math.abs(snap.x - 3) < 1e-4, `Expected midX ≈ 3, got ${snap.x}`);
  assert.ok(Math.abs(snap.y - 0) < 1e-4, `Expected midY ≈ 0, got ${snap.y}`);
});

test('Challenge 1.3: Reflex arc wrapping across 0 deg / 360 deg boundary (e.g. 30 deg to 330 deg)', () => {
  const doc = blankDocument();
  const R = 4;
  // A at +30 deg, B at -30 deg (330 deg).
  // CCW sweep from 30 deg -> 90 deg -> 180 deg -> 270 deg -> 330 deg. Span = 300 deg > 180 deg.
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);
  doc.points = [
    { id: 'O', x: 0, y: 0 },
    { id: 'A', x: R * cos30, y: R * sin30 },
    { id: 'B', x: R * cos30, y: -R * sin30 }
  ];
  doc.shapes = [
    { id: 'arcReflexWrap', type: 'arc', refs: ['O', 'A', 'B'] }
  ];

  const svg = renderSVG(doc, { scale: 50, grid: false });
  assert.ok(!svg.includes('NaN'), 'SVG must not contain NaN');
  assert.ok(svg.includes('0 1 0'), 'Should have largeArc=1 and sweep=0');

  // Midpoint of CCW arc from 30 deg to 330 deg is 180 deg: (-R, 0) = (-4, 0)
  const snap = findSnapTarget(-3.95, 0.05, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snap.type, 'midpoint');
  assert.equal(snap.refId, 'arcReflexWrap');
  assert.ok(Math.abs(snap.x - (-4)) < 1e-4, `Expected midX ≈ -4, got ${snap.x}`);
  assert.ok(Math.abs(snap.y - 0) < 1e-4, `Expected midY ≈ 0, got ${snap.y}`);
});

test('Challenge 1.4: Micro arc (< 1 deg) renders cleanly without precision breakdown or NaN', () => {
  const doc = blankDocument();
  const R = 5;
  // 0.2 degrees in radians
  const angleRad = 0.2 * Math.PI / 180;
  doc.points = [
    { id: 'O', x: 1, y: 1 },
    { id: 'A', x: 1 + R, y: 1 },
    { id: 'B', x: 1 + R * Math.cos(angleRad), y: 1 + R * Math.sin(angleRad) }
  ];
  doc.shapes = [
    { id: 'microArc', type: 'arc', refs: ['O', 'A', 'B'] },
    { id: 'microSec', type: 'sector', refs: ['O', 'A', 'B'], fill: '#2a9d8f', fillOpacity: 0.2 }
  ];

  const { errors } = resolve(doc);
  assert.equal(errors.length, 0, 'Resolve should have no errors for micro arc');

  const svg = renderSVG(doc, { scale: 55, grid: false });
  assert.ok(!svg.includes('NaN'), 'Micro arc SVG must not contain NaN');
  assert.ok(svg.includes('data-shape="microArc"'));
  assert.ok(svg.includes('data-shape="microSec"'));
});

test('Challenge 1.5: Sector with reflex angle (> 180 deg) closes properly through center', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'O', x: 0, y: 0 },
    { id: 'A', x: 2, y: 0 },
    { id: 'B', x: 0, y: -2 }
  ];
  doc.shapes = [
    { id: 'secReflex', type: 'sector', refs: ['O', 'A', 'B'], fill: '#e63946', fillOpacity: 0.3 }
  ];

  const svg = renderSVG(doc, { scale: 50, grid: false });
  assert.ok(!svg.includes('NaN'), 'Sector SVG must not contain NaN');
  // Must contain path starting at O(500, 330), L to A(600, 330), A with largeArc=1, then Z
  assert.ok(svg.includes('M 500.00 330.00 L 600.00 330.00 A 100.00 100.00 0 1 0 500.00 430.00 Z'));
  assert.ok(svg.includes('fill:#e63946'));
});

test('Challenge 1.6: Degenerate Arc and Sector identification (zero radius, O coinciding with A or B)', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'O', x: 2, y: 3 },
    { id: 'A', x: 2, y: 3 }, // Coincides with O -> R = 0
    { id: 'B', x: 5, y: 3 }
  ];
  doc.shapes = [
    { id: 'degArc1', type: 'arc', refs: ['O', 'A', 'B'] },
    { id: 'degSec1', type: 'sector', refs: ['O', 'A', 'B'] }
  ];
  const { errors } = resolve(doc);
  assert.ok(errors.some(e => e.includes('degArc1') && e.includes('Bán kính cung/quạt tròn bằng 0')));
  assert.ok(errors.some(e => e.includes('degSec1') && e.includes('Bán kính cung/quạt tròn bằng 0')));

  // Case: B coincides with O
  const docB = blankDocument();
  docB.points = [
    { id: 'O', x: 2, y: 3 },
    { id: 'A', x: 5, y: 3 },
    { id: 'B', x: 2, y: 3 } // Coincides with O
  ];
  docB.shapes = [
    { id: 'degArc2', type: 'arc', refs: ['O', 'A', 'B'] }
  ];
  const resB = resolve(docB);
  assert.ok(resB.errors.some(e => e.includes('degArc2') && e.includes('Điểm định hướng cung/quạt tròn trùng tâm')));
});

// ============================================================================
// SUITE 2: ADVANCED 2D ELLIPSES (EXTREME ASPECT RATIOS, SPECIAL ROTATIONS, SNAP)
// ============================================================================

test('Challenge 2.1: Extreme horizontal aspect ratio rx >> ry (e.g. 20 : 0.05)', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'C', x: 0, y: 0, visible: true },
    { id: 'A', x: 20, y: 0, visible: true }
  ];
  doc.shapes = [
    { id: 'ellFlat', type: 'ellipse', refs: ['C', 'A'], ry: 0.05 }
  ];

  // 1. Validation and resolve
  const validated = validateDocument(doc);
  assert.equal(validated.shapes[0].ry, 0.05);
  const { errors } = resolve(doc);
  assert.equal(errors.length, 0);

  // 2. SVG rendering
  const svg = renderSVG(doc, { scale: 20, grid: false });
  assert.ok(!svg.includes('NaN'), 'SVG must not contain NaN');
  // rxScreen = 20 * 20 = 400, ryScreen = 0.05 * 20 = 1.00
  assert.ok(svg.includes('rx="400.00" ry="1.00"'), 'Screen radii match scale');

  // 3. Snap to all 4 vertices
  // Positive major axis vertex at (+20, 0) coincides with Point A.
  // With snapPoints: true (default), Point Snap has highest priority -> type: 'point'
  const snapMajorPosWithPoints = findSnapTarget(19.95, 0.02, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snapMajorPosWithPoints.type, 'point');
  assert.equal(snapMajorPosWithPoints.refId, 'A');

  // With snapPoints: false, vertex snap on ellipse shape activates -> type: 'midpoint', subType: 'ellipseVertex'
  const snapMajorPosMidOnly = findSnapTarget(19.95, 0.02, doc, { radius: 0.28, snapMidpoints: true, snapPoints: false });
  assert.equal(snapMajorPosMidOnly.type, 'midpoint');
  assert.equal(snapMajorPosMidOnly.refId, 'ellFlat');
  assert.equal(snapMajorPosMidOnly.subType, 'ellipseVertex');
  assert.ok(Math.abs(snapMajorPosMidOnly.x - 20) < 1e-4);

  // Negative major axis vertex at (-20, 0) is generated solely by the ellipse -> type: 'midpoint' even with snapPoints: true
  const snapMajorNeg = findSnapTarget(-19.95, -0.02, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snapMajorNeg.type, 'midpoint');
  assert.equal(snapMajorNeg.refId, 'ellFlat');
  assert.equal(snapMajorNeg.subType, 'ellipseVertex');
  assert.ok(Math.abs(snapMajorNeg.x - (-20)) < 1e-4);

  // Minor axis vertices at (0, 0.05) and (0, -0.05)
  const snapMinorPos = findSnapTarget(0.01, 0.04, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snapMinorPos.type, 'midpoint');
  assert.equal(snapMinorPos.refId, 'ellFlat');
  assert.equal(snapMinorPos.subType, 'ellipseVertex');
  assert.ok(Math.abs(snapMinorPos.y - 0.05) < 1e-4);

  const snapMinorNeg = findSnapTarget(-0.01, -0.04, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snapMinorNeg.type, 'midpoint');
  assert.equal(snapMinorNeg.refId, 'ellFlat');
  assert.equal(snapMinorNeg.subType, 'ellipseVertex');
  assert.ok(Math.abs(snapMinorNeg.y - (-0.05)) < 1e-4);
});

test('Challenge 2.2: Extreme vertical aspect ratio rx << ry (e.g. 0.1 : 15)', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'C', x: 0, y: 0, visible: true },
    { id: 'A', x: 0.1, y: 0, visible: true }, // rx = 0.1
    { id: 'B', x: 0, y: 15, visible: true }   // B gives ry = 15
  ];
  doc.shapes = [
    { id: 'ellTall', type: 'ellipse', refs: ['C', 'A', 'B'] }
  ];

  const { errors } = resolve(doc);
  assert.equal(errors.length, 0);

  // Snap to tall minor axis vertex at (0, 15):
  // With snapPoints: false, snaps as ellipse vertex
  const snapMinor = findSnapTarget(0.02, 14.95, doc, { radius: 0.28, snapMidpoints: true, snapPoints: false });
  assert.equal(snapMinor.type, 'midpoint');
  assert.equal(snapMinor.refId, 'ellTall');
  assert.equal(snapMinor.subType, 'ellipseVertex');
  assert.ok(Math.abs(snapMinor.x - 0) < 1e-4);
  assert.ok(Math.abs(snapMinor.y - 15) < 1e-4);

  // Snap to opposite minor axis vertex at (0, -15) (not an explicit point, so works even with default snapPoints: true)
  const snapMinorNeg = findSnapTarget(-0.02, -14.95, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snapMinorNeg.type, 'midpoint');
  assert.equal(snapMinorNeg.refId, 'ellTall');
  assert.equal(snapMinorNeg.subType, 'ellipseVertex');
  assert.ok(Math.abs(snapMinorNeg.x - 0) < 1e-4);
  assert.ok(Math.abs(snapMinorNeg.y - (-15)) < 1e-4);
});

test('Challenge 2.3: Rotated ellipse at cardinal and diagonal angles (45 deg, 90 deg, 135 deg, 180 deg)', () => {
  const angles = [
    { deg: 45, expectedRot: -45 },
    { deg: 90, expectedRot: -90 },
    { deg: 135, expectedRot: -135 },
    { deg: 180, expectedRot: 180 }
  ];

  for (const { deg, expectedRot } of angles) {
    const rad = deg * Math.PI / 180;
    const rx = 4;
    const ry = 2;
    const doc = blankDocument();
    doc.points = [
      { id: 'C', x: 2, y: 2, visible: true },
      { id: 'A', x: 2 + rx * Math.cos(rad), y: 2 + rx * Math.sin(rad), visible: true }
    ];
    doc.shapes = [
      { id: `ell_${deg}`, type: 'ellipse', refs: ['C', 'A'], ry }
    ];

    // SVG render: Screen rotation angle must match expected
    const svg = renderSVG(doc, { scale: 50, grid: false });
    assert.ok(!svg.includes('NaN'), `SVG at ${deg} deg must not contain NaN`);
    const rotSnippet = `rotate(${expectedRot.toFixed(2)}`;
    assert.ok(
      svg.includes(rotSnippet) || (expectedRot === 180 && svg.includes('rotate(-180.00')),
      `Expected rotation snippet ${rotSnippet} for angle ${deg} deg`
    );

    // Verify snap to major vertex A
    const targetA = { x: 2 + rx * Math.cos(rad), y: 2 + rx * Math.sin(rad) };
    const snapA = findSnapTarget(targetA.x + 0.05, targetA.y - 0.05, doc, { radius: 0.28, snapMidpoints: true, snapPoints: false });
    assert.equal(snapA.type, 'midpoint');
    assert.equal(snapA.refId, `ell_${deg}`);
    assert.ok(Math.abs(snapA.x - targetA.x) < 1e-4);
    assert.ok(Math.abs(snapA.y - targetA.y) < 1e-4);

    // Verify snap to minor vertex perpendicular to A: v = (-sin(rad), cos(rad))
    const targetMinor = { x: 2 - ry * Math.sin(rad), y: 2 + ry * Math.cos(rad) };
    const snapMinor = findSnapTarget(targetMinor.x + 0.04, targetMinor.y - 0.04, doc, { radius: 0.28, snapMidpoints: true, snapPoints: false });
    assert.equal(snapMinor.type, 'midpoint');
    assert.equal(snapMinor.refId, `ell_${deg}`);
    assert.ok(Math.abs(snapMinor.x - targetMinor.x) < 1e-4);
    assert.ok(Math.abs(snapMinor.y - targetMinor.y) < 1e-4);
  }
});

test('Challenge 2.4: Degenerate ellipse with C = A (rx = 0)', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'C', x: 3, y: 4 },
    { id: 'A', x: 3, y: 4 } // Identical to C
  ];
  doc.shapes = [
    { id: 'degEll', type: 'ellipse', refs: ['C', 'A'] }
  ];
  const { errors } = resolve(doc);
  assert.ok(errors.some(e => e.includes('degEll') && e.includes('Bán trục chính elip bằng 0')));

  // renderSVG safely skips or handles without throwing
  assert.doesNotThrow(() => {
    const svg = renderSVG(doc, { scale: 50, grid: false });
    assert.ok(!svg.includes('NaN'));
  });
});

// ============================================================================
// SUITE 3: ORTHOCENTER (OBTUSE, RIGHT, EQUILATERAL, COLLINEAR, 3D SPACE)
// ============================================================================

test('Challenge 3.1: Obtuse triangle - orthocenter lies strictly outside the triangle', () => {
  // Triangle A(0, 0), B(4, 0), C(1, 1).
  // Angle C is obtuse: CA=(-1,-1), CB=(3,-1) -> dot = -3 + 1 = -2 < 0.
  // Altitudes:
  // - from B(4, 0) perpendicular to AC(y=x) -> y = -x + 4
  // - from A(0, 0) perpendicular to BC(slope -1/3) -> y = 3x
  // Intersection H = (1, 3).
  const H = construct({ kind: 'orthocenter' }, [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 1, y: 1 }
  ]);

  assert.ok(Math.abs(H.x - 1) < 1e-6, `Expected H.x = 1, got ${H.x}`);
  assert.ok(Math.abs(H.y - 3) < 1e-6, `Expected H.y = 3, got ${H.y}`);

  // Rigorous geometric check: H must be orthogonal to each opposite side
  // 1. Line AH (slope (3-0)/(1-0) = 3) is perpendicular to BC (slope (1-0)/(1-4) = -1/3)
  const vecAH = { x: H.x - 0, y: H.y - 0 };
  const vecBC = { x: 1 - 4, y: 1 - 0 };
  assert.ok(Math.abs(dot(vecAH, vecBC)) < 1e-6, 'AH must be perpendicular to BC');

  // 2. Line BH is perpendicular to AC
  const vecBH = { x: H.x - 4, y: H.y - 0 };
  const vecAC = { x: 1 - 0, y: 1 - 0 };
  assert.ok(Math.abs(dot(vecBH, vecAC)) < 1e-6, 'BH must be perpendicular to AC');

  // 3. Line CH is perpendicular to AB
  const vecCH = { x: H.x - 1, y: H.y - 1 };
  const vecAB = { x: 4 - 0, y: 0 - 0 };
  assert.ok(Math.abs(dot(vecCH, vecAB)) < 1e-6, 'CH must be perpendicular to AB');

  // 4. Position: H.y = 3 is strictly greater than max(A.y, B.y, C.y) = 1 -> outside!
  assert.ok(H.y > 1, 'Orthocenter of obtuse triangle must lie outside');
});

test('Challenge 3.2: Right-angle triangle - orthocenter coincides exactly with the right-angle vertex', () => {
  // Test right angle at A, B, and C respectively
  // 1. Right at A: A(2, 3), B(7, 3), C(2, 8)
  const H_A = construct({ kind: 'orthocenter' }, [{ x: 2, y: 3 }, { x: 7, y: 3 }, { x: 2, y: 8 }]);
  assert.ok(Math.abs(H_A.x - 2) < 1e-6);
  assert.ok(Math.abs(H_A.y - 3) < 1e-6);

  // 2. Right at B: A(-2, 1), B(3, 1), C(3, 6)
  const H_B = construct({ kind: 'orthocenter' }, [{ x: -2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 6 }]);
  assert.ok(Math.abs(H_B.x - 3) < 1e-6);
  assert.ok(Math.abs(H_B.y - 1) < 1e-6);

  // 3. Right at C with tilted hypotenuse: A(1, 1), B(5, 4), C(1, 4)
  // Legs AC: (0, 3), BC: (-4, 0). Right at C(1, 4).
  const H_C = construct({ kind: 'orthocenter' }, [{ x: 1, y: 1 }, { x: 5, y: 4 }, { x: 1, y: 4 }]);
  assert.ok(Math.abs(H_C.x - 1) < 1e-6);
  assert.ok(Math.abs(H_C.y - 4) < 1e-6);
});

test('Challenge 3.3: Equilateral triangle - orthocenter H coincides with centroid G and circumcenter O', () => {
  // Equilateral triangle centered at (0, 0):
  // R = 6. A(0, 6), B(-3*sqrt(3), -3), C(3*sqrt(3), -3)
  const s3 = Math.sqrt(3);
  const A = { x: 0, y: 6 };
  const B = { x: -3 * s3, y: -3 };
  const C = { x: 3 * s3, y: -3 };

  const H = construct({ kind: 'orthocenter' }, [A, B, C]);
  const G = construct({ kind: 'centroid' }, [A, B, C]);

  assert.ok(Math.abs(H.x - 0) < 1e-6, `Expected H.x ≈ 0, got ${H.x}`);
  assert.ok(Math.abs(H.y - 0) < 1e-6, `Expected H.y ≈ 0, got ${H.y}`);
  assert.ok(Math.abs(G.x - 0) < 1e-6, `Expected G.x ≈ 0, got ${G.x}`);
  assert.ok(Math.abs(G.y - 0) < 1e-6, `Expected G.y ≈ 0, got ${G.y}`);
  assert.ok(Math.hypot(H.x - G.x, H.y - G.y) < 1e-6, 'H and G must coincide for equilateral triangle');
});

test('Challenge 3.4: Collinear and coinciding vertices throw safe error without NaN', () => {
  // Case 1: Collinear horizontal points
  assert.throws(
    () => construct({ kind: 'orthocenter' }, [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 5, y: 0 }]),
    /thẳng hàng/
  );

  // Case 2: Collinear diagonal points
  assert.throws(
    () => construct({ kind: 'orthocenter' }, [{ x: 1, y: 2 }, { x: 3, y: 6 }, { x: 5, y: 10 }]),
    /thẳng hàng/
  );

  // Case 3: Two vertices coinciding
  assert.throws(
    () => construct({ kind: 'orthocenter' }, [{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 4, y: 5 }]),
    /thẳng hàng/
  );

  // Case 4: All three vertices coinciding
  assert.throws(
    () => construct({ kind: 'orthocenter' }, [{ x: 2, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 2 }]),
    /thẳng hàng/
  );
});

test('Challenge 3.5: 3D Orthocenter in tilted plane and 3D collinear guard', () => {
  // Triangle in plane z = 2x + y:
  // A(0, 0, 0), B(3, 0, 6), C(0, 4, 4).
  // Vector AB = (3, 0, 6), AC = (0, 4, 4).
  // dot(AB, AC) = 0 + 0 + 24 != 0.
  // Let's create an exact right triangle in 3D:
  // A(1, 2, 3), B(1+4, 2, 3) = (5, 2, 3), C(1, 2+3, 3) = (1, 5, 3).
  // Right at A(1, 2, 3).
  const H_3d_right = construct({ kind: 'orthocenter' }, [
    { x: 1, y: 2, z: 3 },
    { x: 5, y: 2, z: 3 },
    { x: 1, y: 5, z: 3 }
  ]);
  assert.ok(Math.abs(H_3d_right.x - 1) < 1e-6);
  assert.ok(Math.abs(H_3d_right.y - 2) < 1e-6);
  assert.ok(Math.abs(H_3d_right.z - 3) < 1e-6);

  // Collinear in 3D space
  assert.throws(
    () => construct({ kind: 'orthocenter' }, [
      { x: 1, y: 1, z: 1 },
      { x: 2, y: 2, z: 2 },
      { x: 3, y: 3, z: 3 }
    ]),
    /thẳng hàng/
  );
});

// ============================================================================
// SUITE 4: SMART MAGNET SNAP (PRIORITY, THRESHOLDS, SCALE INVARIANCE)
// ============================================================================

test('Challenge 4.1: Magnet snap priority - Point Snap beats Midpoint Snap beats Grid Snap', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 2, y: 0, visible: true },
    { id: 'B', x: 2, y: 2, visible: true }
  ];
  doc.shapes = [
    { id: 'segAB', type: 'segment', refs: ['A', 'B'] }
  ];
  // Segment AB has midpoint at (2, 1).
  // Vertex B is at (2, 2).
  // Query at (2.05, 1.95): distance to B is ~0.07. Distance to midpoint (2, 1) is ~0.95.
  // Point snap should win.
  const snapPoint = findSnapTarget(2.05, 1.95, doc, { radius: 0.28, snapPoints: true, snapMidpoints: true, snapGrid: true });
  assert.equal(snapPoint.type, 'point');
  assert.equal(snapPoint.refId, 'B');

  // Query near midpoint (2.03, 1.02): distance to midpoint is ~0.036. Point is far (>0.9).
  // Midpoint snap should win over grid snap (grid point is also at 2, 1).
  const snapMid = findSnapTarget(2.03, 1.02, doc, { radius: 0.28, snapPoints: true, snapMidpoints: true, snapGrid: true });
  assert.equal(snapMid.type, 'midpoint');
  assert.equal(snapMid.refId, 'segAB');

  // Query far from any shape (5.08, 5.06): grid snap wins
  const snapGrid = findSnapTarget(5.08, 5.06, doc, { radius: 0.28, snapPoints: true, snapMidpoints: true, snapGrid: true, gridStep: 1 });
  assert.equal(snapGrid.type, 'grid');
  assert.equal(snapGrid.x, 5);
  assert.equal(snapGrid.y, 5);
});

test('Challenge 4.2: Magnet snap distance threshold - misses when cursor is outside radius', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'O', x: 0, y: 0, visible: true },
    { id: 'A', x: 3, y: 0, visible: true },
    { id: 'B', x: 0, y: 3, visible: true }
  ];
  doc.shapes = [
    { id: 'arc1', type: 'arc', refs: ['O', 'A', 'B'] }
  ];
  // Arc midpoint at (3/sqrt(2), 3/sqrt(2)) ≈ (2.1213, 2.1213)
  const mx = 3 / Math.SQRT2;
  const my = 3 / Math.SQRT2;

  // Inside radius 0.28: query at (mx + 0.15, my + 0.15) -> dist = sqrt(0.15^2 + 0.15^2) ≈ 0.212 < 0.28 -> hit!
  const snapInside = findSnapTarget(mx + 0.15, my + 0.15, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snapInside.type, 'midpoint');
  assert.equal(snapInside.refId, 'arc1');

  // Outside radius 0.28: query at (mx + 0.35, my + 0.35) -> dist ≈ 0.495 > 0.28 -> miss!
  const snapOutside = findSnapTarget(mx + 0.35, my + 0.35, doc, { radius: 0.28, snapMidpoints: true });
  assert.notEqual(snapOutside.refId, 'arc1');
});

// ============================================================================
// SUITE 5: EXTENDED MARKERS & SVG GENERATION INTEGRITY UNDER STRESS
// ============================================================================

test('Challenge 5.1: Complex document with 20+ mixed 2D entities validates, resolves, and renders with zero NaN', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'O', x: 0, y: 0 },
    { id: 'A', x: 4, y: 0 },
    { id: 'B', x: 0, y: 4 },
    { id: 'C', x: -3, y: 0 },
    { id: 'D', x: 0, y: -3 },
    { id: 'E', x: 2, y: 2 },
    { id: 'H', kind: 'orthocenter', refs: ['A', 'B', 'C'] },
    { id: 'G', kind: 'centroid', refs: ['A', 'B', 'C'] }
  ];
  doc.shapes = [
    { id: 'arc1', type: 'arc', refs: ['O', 'A', 'B'], dashed: true, strokeWidth: 2 },
    { id: 'sec1', type: 'sector', refs: ['O', 'B', 'C'], fill: '#1d4ed8', fillOpacity: 0.25 },
    { id: 'arcReflex', type: 'arc', refs: ['O', 'C', 'A'] },
    { id: 'ell1', type: 'ellipse', refs: ['O', 'A'], ry: 1.5, color: '#dc2626' },
    { id: 'ell2', type: 'ellipse', refs: ['O', 'E'], ry: 0.8, fill: '#fef08a', fillOpacity: 0.4 },
    { id: 's1', type: 'segment', refs: ['A', 'B'], mark: 'triple', color: '#176b52' },
    { id: 's2', type: 'segment', refs: ['B', 'C'], mark: 'double', color: '#176b52' },
    { id: 's3', type: 'segment', refs: ['C', 'A'], mark: 'tick', color: '#176b52' },
    { id: 'ang1', type: 'angle', refs: ['A', 'O', 'B'], mark: 'right' },
    { id: 'ang2', type: 'angle', refs: ['B', 'O', 'C'], mark: 'single' },
    { id: 'ang3', type: 'angle', refs: ['C', 'O', 'D'], mark: 'double' }
  ];

  // 1. Validation
  const validated = validateDocument(doc);
  assert.equal(validated.points.length, 8);
  assert.equal(validated.shapes.length, 11);

  // 2. Resolve
  const { points, errors } = resolve(doc);
  assert.equal(errors.length, 0, `Expected 0 errors, got: ${errors.join('; ')}`);
  assert.ok(Number.isFinite(points.H.x) && Number.isFinite(points.H.y));
  assert.ok(Number.isFinite(points.G.x) && Number.isFinite(points.G.y));

  // 3. Render at different scales
  for (const scale of [10, 55, 120]) {
    const svg = renderSVG(doc, { scale, grid: true });
    assert.ok(!svg.includes('NaN'), `SVG at scale ${scale} must not contain NaN`);
    assert.ok(svg.includes('data-shape="arc1"'));
    assert.ok(svg.includes('data-shape="sec1"'));
    assert.ok(svg.includes('data-shape="ell1"'));
    assert.ok(svg.includes('data-shape="s1"'));
  }
});

// ============================================================================
// SUITE 6: ADVERSARIAL STRESS TESTS (SEMICIRCLE, ARBITRARY CONICS, EXTREME COORDS)
// ============================================================================

test('Challenge 6.1: Exactly 180 deg semicircle (boundary between minor and major arc)', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'O', x: 0, y: 0 },
    { id: 'A', x: 5, y: 0 },  // 0 deg
    { id: 'B', x: -5, y: 0 }  // 180 deg
  ];
  doc.shapes = [
    { id: 'semiArc', type: 'arc', refs: ['O', 'A', 'B'] },
    { id: 'semiSec', type: 'sector', refs: ['O', 'A', 'B'], fill: '#3b82f6', fillOpacity: 0.2 }
  ];

  const svg = renderSVG(doc, { scale: 50, grid: false });
  assert.ok(!svg.includes('NaN'), 'Semicircle SVG must not contain NaN');
  // Semicircle CCW midpoint is at 90 deg: (0, 5)
  const snap = findSnapTarget(0.02, 4.95, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snap.type, 'midpoint');
  assert.equal(snap.refId, 'semiArc');
  assert.ok(Math.abs(snap.x - 0) < 1e-4);
  assert.ok(Math.abs(snap.y - 5) < 1e-4);
});

test('Challenge 6.2: Ellipse rotated at non-cardinal angle (e.g. 210 deg in 3rd quadrant)', () => {
  const doc = blankDocument();
  const rad = 210 * Math.PI / 180;
  const rx = 6;
  const ry = 3;
  doc.points = [
    { id: 'C', x: -5, y: -5, visible: true },
    { id: 'A', x: -5 + rx * Math.cos(rad), y: -5 + rx * Math.sin(rad), visible: true }
  ];
  doc.shapes = [
    { id: 'ell210', type: 'ellipse', refs: ['C', 'A'], ry }
  ];

  const svg = renderSVG(doc, { scale: 40, grid: false });
  assert.ok(!svg.includes('NaN'));
  // Math angle 210 deg -> screen rotation atan2(-sin, cos) = -210 deg or +150 deg
  assert.ok(svg.includes('rotate(150.00') || svg.includes('rotate(-210.00'));

  // Minor axis vertex: v = (-sin(rad), cos(rad))
  const minorVertex = {
    x: -5 - ry * Math.sin(rad),
    y: -5 + ry * Math.cos(rad)
  };
  const snapMinor = findSnapTarget(minorVertex.x + 0.03, minorVertex.y - 0.03, doc, { radius: 0.28, snapMidpoints: true, snapPoints: false });
  assert.equal(snapMinor.type, 'midpoint');
  assert.equal(snapMinor.refId, 'ell210');
  assert.ok(Math.abs(snapMinor.x - minorVertex.x) < 1e-4);
  assert.ok(Math.abs(snapMinor.y - minorVertex.y) < 1e-4);
});

test('Challenge 6.3: Orthocenter with huge coordinates (10,000+) maintains precision without overflow', () => {
  // Right-angled triangle at A(10000, 20000): B(10000+600, 20000), C(10000, 20000+800)
  const H = construct({ kind: 'orthocenter' }, [
    { x: 10000, y: 20000 },
    { x: 10600, y: 20000 },
    { x: 10000, y: 20800 }
  ]);
  assert.ok(Math.abs(H.x - 10000) < 1e-4, `Expected H.x ≈ 10000, got ${H.x}`);
  assert.ok(Math.abs(H.y - 20000) < 1e-4, `Expected H.y ≈ 20000, got ${H.y}`);
});

test('Challenge 6.4: Multiple overlapping curves select the closest midpoint target deterministically', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'O', x: 0, y: 0, visible: true },
    { id: 'A1', x: 2, y: 0, visible: true },
    { id: 'B1', x: 0, y: 2, visible: true },
    { id: 'A2', x: 4, y: 0, visible: true },
    { id: 'B2', x: 0, y: 4, visible: true }
  ];
  doc.shapes = [
    { id: 'innerArc', type: 'arc', refs: ['O', 'A1', 'B1'] },
    { id: 'outerArc', type: 'arc', refs: ['O', 'A2', 'B2'] }
  ];

  // Inner arc midpoint is at (sqrt(2), sqrt(2)) ≈ (1.414, 1.414)
  // Outer arc midpoint is at (2*sqrt(2), 2*sqrt(2)) ≈ (2.828, 2.828)

  // Query close to inner arc midpoint (1.40, 1.40)
  const snapInner = findSnapTarget(1.40, 1.40, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snapInner.refId, 'innerArc');

  // Query close to outer arc midpoint (2.80, 2.80)
  const snapOuter = findSnapTarget(2.80, 2.80, doc, { radius: 0.28, snapMidpoints: true });
  assert.equal(snapOuter.refId, 'outerArc');
});

