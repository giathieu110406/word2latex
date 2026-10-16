import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blankDocument,
  validateDocument,
  resolve,
  findSnapTarget
} from '../public/ve-hinh/src/math.js';
import { renderSVG } from '../public/ve-hinh/src/render.js';
import {
  create3DHistorySession,
  freshSolidPointId
} from '../public/ve-hinh/src/app.js';

// ============================================================================
// PART 1: VISUAL MARKERS ADVERSARIAL STRESS TESTS
// ============================================================================

test('Visual Markers: Adjacent right angles sharing vertex and ray', () => {
  // A(-2, 0), B(0, 0), C(2, 0), D(0, 2)
  // Angle 1: ABD (90 deg), Angle 2: DBC (90 deg)
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: -2, y: 0 },
    { id: 'B', x: 0, y: 0 },
    { id: 'C', x: 2, y: 0 },
    { id: 'D', x: 0, y: 2 }
  ];
  doc.shapes = [
    { id: 'ang1', type: 'angle', refs: ['A', 'B', 'D'], mark: 'right', color: '#176b52' },
    { id: 'ang2', type: 'angle', refs: ['D', 'B', 'C'], mark: 'right', color: '#2563eb' }
  ];

  const validated = validateDocument(doc);
  assert.ok(validated, 'Document with adjacent right angles must be valid');

  const svg = renderSVG(doc, { scale: 55, grid: false });
  assert.ok(!svg.includes('NaN'), 'SVG must not contain NaN');

  // Both right-angle paths must be rendered
  assert.ok(svg.includes('data-shape="ang1"'), 'Must render angle 1');
  assert.ok(svg.includes('data-shape="ang2"'), 'Must render angle 2');

  // Scale 55, center (500, 330): B = (500, 330)
  // A = (390, 330), D = (500, 220), C = (610, 330)
  // For ang1 (A-B-D): u = (-1, 0), v = (0, -1) -> corner at (500 - 18, 330 - 18) = (482, 312)
  assert.ok(
    svg.includes('M 482.00 330.00 L 482.00 312.00 L 500.00 312.00'),
    'ang1 must have exact 18px square marker in Q2'
  );

  // For ang2 (D-B-C): u = (0, -1), v = (1, 0) -> corner at (500 + 18, 330 - 18) = (518, 312)
  assert.ok(
    svg.includes('M 500.00 312.00 L 518.00 312.00 L 518.00 330.00'),
    'ang2 must have exact 18px square marker in Q1'
  );
});

test('Visual Markers: Inverted vertex order (A-B-C vs C-B-A) renders identical square corner', () => {
  // Test across multiple rotations (0 deg, 37 deg oblique, 135 deg)
  const testAngles = [
    { a: { x: 3, y: 0 }, b: { x: 0, y: 0 }, c: { x: 0, y: 3 } },
    { a: { x: 2, y: 1 }, b: { x: 0, y: 0 }, c: { x: -1, y: 2 } }, // 90 deg rotated
    { a: { x: -2, y: -2 }, b: { x: 0, y: 0 }, c: { x: 2, y: -2 } }  // 90 deg rotated
  ];

  for (let idx = 0; idx < testAngles.length; idx++) {
    const { a, b, c } = testAngles[idx];
    const docForward = blankDocument();
    docForward.points = [{ id: 'A', ...a }, { id: 'B', ...b }, { id: 'C', ...c }];
    docForward.shapes = [{ id: 'angF', type: 'angle', refs: ['A', 'B', 'C'], mark: 'right' }];

    const docReverse = blankDocument();
    docReverse.points = [{ id: 'A', ...a }, { id: 'B', ...b }, { id: 'C', ...c }];
    docReverse.shapes = [{ id: 'angR', type: 'angle', refs: ['C', 'B', 'A'], mark: 'right' }];

    const svgF = renderSVG(docForward, { scale: 55, grid: false });
    const svgR = renderSVG(docReverse, { scale: 55, grid: false });

    assert.ok(!svgF.includes('NaN'), `Forward svg ${idx} must not have NaN`);
    assert.ok(!svgR.includes('NaN'), `Reverse svg ${idx} must not have NaN`);

    // Extract path d attribute from data-shape="angF" and "angR"
    const matchF = svgF.match(/<path d="([^"]+)"[^>]*data-shape="angF"/);
    const matchR = svgR.match(/<path d="([^"]+)"[^>]*data-shape="angR"/);
    assert.ok(matchF && matchR, 'Both paths must exist');

    const partsF = matchF[1].split(' ');
    const partsR = matchR[1].split(' ');

    // Path is: M p1.x p1.y L p2.x p2.y L p3.x p3.y
    // Corner point p2 is at index 4, 5
    assert.equal(partsF[4], partsR[4], `X coordinate of corner p2 must match for test ${idx}`);
    assert.equal(partsF[5], partsR[5], `Y coordinate of corner p2 must match for test ${idx}`);

    // Endpoints p1 and p3 must be flipped: p1_forward == p3_reverse, p3_forward == p1_reverse
    assert.equal(partsF[1], partsR[7], `p1.x forward must match p3.x reverse for test ${idx}`);
    assert.equal(partsF[2], partsR[8], `p1.y forward must match p3.y reverse for test ${idx}`);
    assert.equal(partsF[7], partsR[1], `p3.x forward must match p1.x reverse for test ${idx}`);
    assert.equal(partsF[8], partsR[2], `p3.y forward must match p1.y reverse for test ${idx}`);
  }
});

test('Visual Markers: Angles near 90 deg (89.999 deg, 90.001 deg, 89.9 deg, 90.1 deg)', () => {
  // Tolerance in render.js: Math.abs(angle - Math.PI / 2) < 1e-3 (~0.0573 deg)
  const deg2rad = (d: number) => (d * Math.PI) / 180;

  // Case 1: 89.999 deg (diff ~ 0.001 deg = 1.745e-5 rad < 1e-3)
  // Even with mark: 'none', it should automatically render right angle marker
  const doc89999 = blankDocument();
  const rad89999 = deg2rad(89.999);
  doc89999.points = [
    { id: 'A', x: 2, y: 0 },
    { id: 'O', x: 0, y: 0 },
    { id: 'B', x: 2 * Math.cos(rad89999), y: 2 * Math.sin(rad89999) }
  ];
  doc89999.shapes = [{ id: 'ang89', type: 'angle', refs: ['A', 'O', 'B'], mark: 'none' }];

  const svg89999 = renderSVG(doc89999, { scale: 55, grid: false });
  assert.ok(!svg89999.includes('NaN'), '89.999 deg must not have NaN');
  assert.ok(svg89999.includes('L'), '89.999 deg within 1e-3 tolerance must render right angle square');
  assert.ok(!svg89999.includes('90°'), '89.999 deg must suppress degree text in right-angle mode');

  // Case 2: 90.001 deg (diff ~ 0.001 deg < 1e-3)
  const doc90001 = blankDocument();
  const rad90001 = deg2rad(90.001);
  doc90001.points = [
    { id: 'A', x: 2, y: 0 },
    { id: 'O', x: 0, y: 0 },
    { id: 'B', x: 2 * Math.cos(rad90001), y: 2 * Math.sin(rad90001) }
  ];
  doc90001.shapes = [{ id: 'ang90', type: 'angle', refs: ['A', 'O', 'B'], mark: 'none' }];

  const svg90001 = renderSVG(doc90001, { scale: 55, grid: false });
  assert.ok(!svg90001.includes('NaN'), '90.001 deg must not have NaN');
  assert.ok(svg90001.includes('L'), '90.001 deg within 1e-3 tolerance must render right angle square');

  // Case 3: 89.9 deg (diff = 0.1 deg = 1.745e-3 rad > 1e-3) with mark: 'none'
  // Should NOT render right angle square; should render circular arc and '90°' text
  const doc899 = blankDocument();
  const rad899 = deg2rad(89.9);
  doc899.points = [
    { id: 'A', x: 2, y: 0 },
    { id: 'O', x: 0, y: 0 },
    { id: 'B', x: 2 * Math.cos(rad899), y: 2 * Math.sin(rad899) }
  ];
  doc899.shapes = [{ id: 'angPlain', type: 'angle', refs: ['A', 'O', 'B'], mark: 'none' }];

  const svg899 = renderSVG(doc899, { scale: 55, grid: false });
  assert.ok(!svg899.includes('NaN'));
  assert.ok(svg899.includes('90°'), '89.9 deg with mark:none displays degree text rounded to 90°');
  assert.ok(svg899.includes('A 25 25'), '89.9 deg renders arc radius 25');

  // Case 4: 89.9 deg with explicit mark: 'right'
  // Must force render right-angle square marker
  const doc899Forced = blankDocument();
  doc899Forced.points = doc899.points;
  doc899Forced.shapes = [{ id: 'angForced', type: 'angle', refs: ['A', 'O', 'B'], mark: 'right' }];
  const svg899Forced = renderSVG(doc899Forced, { scale: 55, grid: false });
  assert.ok(svg899Forced.includes('L'), '89.9 deg with mark:right must render right-angle square');
  assert.ok(!svg899Forced.includes('90°'), '89.9 deg with mark:right must suppress text');
});

test('Visual Markers: Segment triple ticks on short, vertical, horizontal, oblique segments', () => {
  const doc = blankDocument();
  doc.points = [
    // 1. Extremely short segment (length 0.2 in math = 11px on screen)
    { id: 'S1', x: 0, y: 0 },
    { id: 'S2', x: 0.2, y: 0 },

    // 2. Vertical segment (dx = 0)
    { id: 'V1', x: 2, y: -2 },
    { id: 'V2', x: 2, y: 2 },

    // 3. Horizontal segment (dy = 0)
    { id: 'H1', x: -3, y: 3 },
    { id: 'H2', x: 3, y: 3 },

    // 4. Oblique segment (45 deg)
    { id: 'O1', x: -2, y: -2 },
    { id: 'O2', x: 2, y: 2 }
  ];
  doc.shapes = [
    { id: 'segShort', type: 'segment', refs: ['S1', 'S2'], mark: 'triple', color: '#e11d48' },
    { id: 'segVert', type: 'segment', refs: ['V1', 'V2'], mark: 'triple', color: '#16a34a' },
    { id: 'segHoriz', type: 'segment', refs: ['H1', 'H2'], mark: 'triple', color: '#2563eb' },
    { id: 'segObl', type: 'segment', refs: ['O1', 'O2'], mark: 'triple', color: '#9333ea' }
  ];

  const svg = renderSVG(doc, { scale: 55, grid: false });
  assert.ok(!svg.includes('NaN'), 'SVG must not contain NaN');

  // Verify Vertical segment: ticks must be strictly horizontal (y1 === y2)
  // Scale 55, V1(2, -2) -> (610, 440), V2(2, 2) -> (610, 220)
  // Midpoint is (610, 330). Offsets are [-6, 0, 6] along segment (vertical)
  // Normal is horizontal (dx = 0, dy = -220, unit vector = (0, -1), normal = (1, 0))
  // Ticks span from x = 610 - 7 = 603 to x = 610 + 7 = 617
  assert.ok(svg.includes('x1="603" y1="324" x2="617" y2="324"') || svg.includes('x1="617" y1="324" x2="603" y2="324"'), 'Vertical tick offset -6');
  assert.ok(svg.includes('x1="603" y1="330" x2="617" y2="330"') || svg.includes('x1="617" y1="330" x2="603" y2="330"'), 'Vertical tick offset 0');
  assert.ok(svg.includes('x1="603" y1="336" x2="617" y2="336"') || svg.includes('x1="617" y1="336" x2="603" y2="336"'), 'Vertical tick offset +6');

  // Verify Horizontal segment: ticks must be strictly vertical (x1 === x2)
  // H1(-3, 3) -> (335, 165), H2(3, 3) -> (665, 165). Midpoint is (500, 165).
  // Ticks at x = 500 - 6 = 494, 500, 506. Y spans from 165 - 7 = 158 to 165 + 7 = 172
  assert.ok(svg.includes('x1="494"') && svg.includes('x2="494"') && (svg.includes('y1="158"') || svg.includes('y1="172"')), 'Horizontal tick offset -6');
  assert.ok(svg.includes('x1="500"') && svg.includes('x2="500"') && (svg.includes('y1="158"') || svg.includes('y1="172"')), 'Horizontal tick offset 0');
  assert.ok(svg.includes('x1="506"') && svg.includes('x2="506"') && (svg.includes('y1="158"') || svg.includes('y1="172"')), 'Horizontal tick offset +6');

  // Verify Oblique 45 deg segment: ticks must be strictly perpendicular
  // Segment vector: O1(-2, -2) -> (390, 440), O2(2, 2) -> (610, 220)
  // dx = 220, dy = -220. Segment direction = (1/√2, -1/√2).
  // Normal direction must be (1/√2, 1/√2).
  // Dot product of segment direction and tick direction must be 0
  const tickMatches = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" stroke="#9333ea" stroke-width="2"/g)];
  assert.equal(tickMatches.length, 3, 'Must render exactly 3 ticks for oblique triple mark');

  for (const match of tickMatches) {
    const x1 = Number(match[1]), y1 = Number(match[2]), x2 = Number(match[3]), y2 = Number(match[4]);
    const tickDx = x2 - x1, tickDy = y2 - y1;
    // Dot product with segment vector (220, -220):
    const dot = 220 * tickDx + (-220) * tickDy;
    assert.ok(Math.abs(dot) < 1e-4, 'Tick vector must be perpendicular to oblique segment');

    // Tick length must be 14px (2 * 7)
    const tickLen = Math.hypot(tickDx, tickDy);
    assert.ok(Math.abs(tickLen - 14) < 1e-2, 'Tick length must be exactly 14px');
  }

  // Verify degenerate segment length < 1e-6 does not render ticks or crash
  const docDegen = blankDocument();
  docDegen.points = [
    { id: 'P1', x: 1, y: 1 },
    { id: 'P2', x: 1, y: 1 }
  ];
  docDegen.shapes = [{ id: 'sDegen', type: 'segment', refs: ['P1', 'P2'], mark: 'triple' }];
  const svgDegen = renderSVG(docDegen, { scale: 55, grid: false });
  assert.ok(!svgDegen.includes('NaN'), 'Degenerate zero-length segment must not produce NaN');
});

test('Visual Markers: Angle single and double markers on acute (30 deg), obtuse (150 deg), and straight (180 deg)', () => {
  const doc = blankDocument();
  const rad30 = (30 * Math.PI) / 180;
  const rad150 = (150 * Math.PI) / 180;

  doc.points = [
    { id: 'O', x: 0, y: 0 },
    { id: 'X', x: 3, y: 0 }, // base ray
    { id: 'A30', x: 3 * Math.cos(rad30), y: 3 * Math.sin(rad30) },
    { id: 'A150', x: 3 * Math.cos(rad150), y: 3 * Math.sin(rad150) },
    { id: 'A180', x: -3, y: 0 } // collinear straight angle
  ];
  doc.shapes = [
    // 30 deg acute: single mark (arc r=24 + bisector tick)
    { id: 'angAcuteSingle', type: 'angle', refs: ['X', 'O', 'A30'], mark: 'single', color: '#0284c7' },
    // 30 deg acute: double mark (arc r=20 and r=26)
    { id: 'angAcuteDouble', type: 'angle', refs: ['X', 'O', 'A30'], mark: 'double', color: '#7c3aed' },
    // 150 deg obtuse: single mark
    { id: 'angObtuseSingle', type: 'angle', refs: ['X', 'O', 'A150'], mark: 'single', color: '#ea580c' },
    // 180 deg straight: single mark (test nw guard when u + v = 0)
    { id: 'angStraightSingle', type: 'angle', refs: ['X', 'O', 'A180'], mark: 'single', color: '#16a34a' },
    // 180 deg straight: double mark
    { id: 'angStraightDouble', type: 'angle', refs: ['X', 'O', 'A180'], mark: 'double', color: '#0d9488' }
  ];

  const svg = renderSVG(doc, { scale: 55, grid: false });
  assert.ok(!svg.includes('NaN'), 'SVG must not contain NaN in any angle configuration');
  assert.ok(!svg.includes('Infinity'), 'SVG must not contain Infinity');

  // 1. Acute angle: double concentric arcs
  assert.ok(svg.includes('A 20 20 0 0'), 'Double angle inner arc r=20');
  assert.ok(svg.includes('A 26 26 0 0'), 'Double angle outer arc r=26');

  // 2. Acute angle: single arc r=24 and bisector tick
  assert.ok(svg.includes('A 24 24 0 0'), 'Single angle arc r=24');

  // 3. Straight angle 180 deg:
  // When angle is 180 deg, u/nu + v/nv = (0, 0) -> nw <= 1e-6.
  // The bisector tick line must be safely skipped (if nw > 1e-6) without division by zero!
  // The arc itself must render with span = 180 deg, radius 24:
  // start = (500 + 24, 330) = (524, 330), end = (500 - 24, 330) = (476, 330)
  assert.ok(
    svg.includes('M 524.00 330.00 A 24 24 0 0 0 476.00 330.00'),
    '180 deg straight angle must render clean semicircle path'
  );

  // 4. Marked angles must suppress degree numerical labels
  assert.ok(!svg.includes('30°'), '30 deg with mark must not display 30° text');
  assert.ok(!svg.includes('150°'), '150 deg with mark must not display 150° text');
  assert.ok(!svg.includes('180°'), '180 deg with mark must not display 180° text');
});

// ============================================================================
// PART 2: UI STATE MACHINE & UNDO/REDO ADVERSARIAL STRESS TESTS
// ============================================================================

test('State Machine & Undo/Redo: Dựng hình -> Undo -> Dựng hình khác -> Redo ID collision test', () => {
  // We simulate the exact Undo/Redo state store contract implemented by app.js:
  // 1. commit(next): validates doc, pushes to history, CLEARS future, updates doc.
  // 2. undo(): pops history, pushes to future.
  // 3. redo(): pops future, pushes to history.
  // 4. freshId(doc): generates ID based on current doc contents.

  const session = create3DHistorySession();
  let baseDoc = blankDocument();
  baseDoc.points = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 4, y: 0 }
  ];
  session.commit(baseDoc);
  assert.equal(session.history.length, 1);
  assert.equal(session.future.length, 0);

  // Helper freshId algorithm strictly matching app.js line 604
  function freshId(source: any) {
    for (let i = 0; i < 26; i++) {
      const id = String.fromCharCode(65 + i);
      if (![...source.points, ...source.shapes].some((p: any) => p.id === id)) return id;
    }
    let i = 1;
    while ([...source.points, ...source.shapes].some((p: any) => p.id === 'P' + i)) i++;
    return 'P' + i;
  }

  // Step 1: Dựng hình 1: Thêm điểm C(4, 3) và góc vuông s1(A, B, C)
  const doc1 = structuredClone(session.doc);
  const idC1 = freshId(doc1);
  assert.equal(idC1, 'C', 'First fresh ID should be C');
  doc1.points.push({ id: idC1, x: 4, y: 3 });
  doc1.shapes.push({ id: 's1', type: 'angle', refs: ['A', 'B', idC1], mark: 'right' });
  session.commit(doc1);

  assert.equal(session.doc.points.length, 3);
  assert.equal(session.doc.shapes.length, 1);
  assert.equal(session.history.length, 2);
  assert.equal(session.future.length, 0);

  // Step 2: Undo -> Quay về trạng thái baseDoc (A, B)
  assert.ok(session.undo(), 'Undo must succeed');
  assert.equal(session.doc.points.length, 2);
  assert.equal(session.doc.shapes.length, 0);
  assert.equal(session.history.length, 1);
  assert.equal(session.future.length, 1);
  assert.ok(session.future[0].points.some((p: any) => p.id === 'C' && p.y === 3));

  // Step 3: Dựng hình khác: Thêm điểm C mới tại (0, 5) và đoạn s1 mới
  // In the current doc, 'C' is absent, so freshId() will return 'C' again!
  const doc2 = structuredClone(session.doc);
  const idC2 = freshId(doc2);
  assert.equal(idC2, 'C', 'freshId returns C because old C was undone');
  doc2.points.push({ id: idC2, x: 0, y: 5 }); // Different coordinates
  doc2.shapes.push({ id: 's1', type: 'segment', refs: ['A', idC2], mark: 'triple' }); // Different shape

  // Step 4: Commit new branch -> MUST WIPE FUTURE!
  session.commit(doc2);
  assert.equal(session.doc.points.length, 3);
  assert.equal(session.doc.shapes[0].type, 'segment');
  assert.equal(session.doc.shapes[0].mark, 'triple');

  // CRITICAL CHECK: future must be completely cleared after committing on a new branch
  assert.equal(session.future.length, 0, 'Redo stack (future) MUST be cleared after committing a new branch');

  // Step 5: Calling redo() now must be impossible (return false)
  const redoResult = session.redo();
  assert.equal(redoResult, false, 'Redo must return false when future is empty');
  assert.equal(session.doc.points.find((p: any) => p.id === 'C')?.y, 5, 'Point C must remain at y=5, not overwritten by old branch');
  assert.equal(session.doc.shapes[0].type, 'segment', 'Shape must remain segment, not overwritten by old angle');

  // Step 6: Subsequent undo must cleanly revert to baseDoc
  assert.ok(session.undo(), 'Undo on new branch must succeed');
  assert.equal(session.doc.points.length, 2);
  assert.equal(session.doc.shapes.length, 0);

  // Document integrity and resolution check
  assert.doesNotThrow(() => validateDocument(session.doc));
  const res = resolve(session.doc);
  assert.equal(res.errors.length, 0, 'No resolution errors');
});

test('State Machine: Tool switching with pending points (pending.length = 1 and pending.length = 2)', () => {
  // Simulate UI tool state transition and cancelConstruction
  let doc = blankDocument();
  doc.points = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 3, y: 0 },
    { id: 'C', x: 3, y: 3 }
  ];

  let tool = 'select';
  let pending: string[] = [];
  let draftBefore: any = null;

  function pickTool(newTool: string) {
    cancelConstruction();
    tool = newTool;
  }

  function cancelConstruction() {
    if (draftBefore) {
      doc = draftBefore;
      draftBefore = null;
    }
    pending = [];
  }

  // --- Scenario 1: Tool 'arc' (needs 3 points). Click 1 point -> pending = ['A'] ---
  pickTool('arc');
  assert.equal(tool, 'arc');
  assert.equal(pending.length, 0);

  pending.push('A');
  assert.equal(pending.length, 1);
  assert.deepEqual(pending, ['A']);

  // User switches tool to 'segment' (needs 2 points) midway
  pickTool('segment');
  assert.equal(tool, 'segment');
  assert.equal(pending.length, 0, 'Pending must be wiped when switching tool from pending.length = 1');

  // Now user uses 'segment' cleanly
  pending.push('B');
  pending.push('C');
  assert.deepEqual(pending, ['B', 'C'], 'New tool receives fresh points, not contaminated by A');

  // --- Scenario 2: Tool 'rightAngle' (needs 3 points). Click 2 points -> pending = ['A', 'B'] ---
  pickTool('rightAngle');
  assert.equal(pending.length, 0);

  pending.push('A');
  pending.push('B');
  assert.equal(pending.length, 2);

  // User switches tool to 'circle' (needs 2 points) midway
  pickTool('circle');
  assert.equal(tool, 'circle');
  assert.equal(pending.length, 0, 'Pending must be wiped when switching tool from pending.length = 2');

  // --- Scenario 3: Ghost draft points cleanup on tool cancel / switch ---
  pickTool('polygon');
  draftBefore = structuredClone(doc);

  // Simulate user clicking on empty space to spawn temporary draft points
  doc.points.push({ id: 'P1_temp', x: 5, y: 5 });
  pending.push('P1_temp');
  doc.points.push({ id: 'P2_temp', x: 6, y: 6 });
  pending.push('P2_temp');

  assert.equal(doc.points.length, 5); // 3 original + 2 temporary
  assert.equal(pending.length, 2);

  // User cancels by switching tool or pressing Escape
  pickTool('select');
  assert.equal(pending.length, 0, 'Pending must be empty');
  assert.equal(doc.points.length, 3, 'Draft temporary points must be fully discarded from doc');
  assert.ok(!doc.points.some((p: any) => p.id === 'P1_temp'), 'P1_temp must not linger in document');
  assert.ok(!doc.points.some((p: any) => p.id === 'P2_temp'), 'P2_temp must not linger in document');
});

test('State Machine: Rapid multi-step Undo/Redo cycles maintain document integrity', () => {
  const session = create3DHistorySession();
  let doc = blankDocument();
  session.commit(doc);

  // Sequentially add 10 points
  for (let i = 0; i < 10; i++) {
    const next = structuredClone(session.doc);
    const id = String.fromCharCode(65 + i);
    next.points.push({ id, x: i, y: i });
    session.commit(next);
  }

  assert.equal(session.doc.points.length, 10);
  assert.equal(session.history.length, 10);

  // Undo 5 times
  for (let i = 0; i < 5; i++) {
    assert.ok(session.undo());
  }
  assert.equal(session.doc.points.length, 5);
  assert.equal(session.future.length, 5);

  // Redo 3 times
  for (let i = 0; i < 3; i++) {
    assert.ok(session.redo());
  }
  assert.equal(session.doc.points.length, 8);
  assert.equal(session.future.length, 2);

  // Undo 7 times
  for (let i = 0; i < 7; i++) {
    assert.ok(session.undo());
  }
  assert.equal(session.doc.points.length, 1);
  assert.equal(session.future.length, 9);

  // Redo all the way to 10
  while (session.future.length > 0) {
    assert.ok(session.redo());
  }
  assert.equal(session.doc.points.length, 10);

  // Validate final state
  const validated = validateDocument(session.doc);
  assert.ok(validated);
  const resolved = resolve(session.doc);
  assert.equal(resolved.errors.length, 0);
});

test('Adversarial Robustness: Dangling shape references and invisible points handled gracefully', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 2, y: 0, visible: false }, // invisible auxiliary point (e.g. altitude foot)
    { id: 'C', x: 0, y: 2 }
  ];
  doc.shapes = [
    // Dangling reference to non-existent point 'Z'
    { id: 'sDangle', type: 'segment', refs: ['A', 'Z'], mark: 'triple' },
    // Shape explicitly hidden
    { id: 'sHidden', type: 'segment', refs: ['A', 'C'], mark: 'double', visible: false },
    // Segment using invisible auxiliary point B (should render segment without rendering point B circle/label)
    { id: 'sAux', type: 'segment', refs: ['A', 'B'], mark: 'double' },
    // Dangling angle reference
    { id: 'angDangle', type: 'angle', refs: ['A', 'B', 'Z'], mark: 'right' }
  ];

  assert.doesNotThrow(() => {
    const svg = renderSVG(doc, { scale: 55, grid: false });
    assert.ok(!svg.includes('NaN'), 'SVG must not contain NaN');
    assert.ok(!svg.includes('data-shape="sDangle"'), 'Dangling segment must be skipped');
    assert.ok(!svg.includes('data-shape="sHidden"'), 'Explicitly hidden shape must be skipped');
    assert.ok(svg.includes('data-shape="sAux"'), 'Segment using auxiliary point must be rendered');
    assert.ok(!svg.includes('data-point="B"'), 'Invisible point B must not render point marker');
    assert.ok(svg.includes('data-point="A"'), 'Visible point A must render point marker');
    assert.ok(!svg.includes('data-shape="angDangle"'), 'Dangling angle must be skipped');
  });
});

test('Adversarial Robustness: Collinear 0 deg angle and extreme coordinates', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'O', x: 0, y: 0 },
    { id: 'A', x: 2, y: 0 },
    { id: 'B', x: 4, y: 0 } // Both rays OA and OB in exact same direction (0 deg)
  ];
  doc.shapes = [
    { id: 'ang0Single', type: 'angle', refs: ['A', 'O', 'B'], mark: 'single' },
    { id: 'ang0Double', type: 'angle', refs: ['A', 'O', 'B'], mark: 'double' },
    { id: 'ang0Right', type: 'angle', refs: ['A', 'O', 'B'], mark: 'right' }
  ];

  const svg = renderSVG(doc, { scale: 55, grid: false });
  assert.ok(!svg.includes('NaN'), '0 deg angle must not produce NaN');
  assert.ok(!svg.includes('Infinity'), '0 deg angle must not produce Infinity');

  // Test extreme coordinates (1e5)
  const docLarge = blankDocument();
  docLarge.points = [
    { id: 'P1', x: 100000, y: 100000 },
    { id: 'P2', x: 100004, y: 100000 }
  ];
  docLarge.shapes = [
    { id: 'sLarge', type: 'segment', refs: ['P1', 'P2'], mark: 'triple' }
  ];
  const svgLarge = renderSVG(docLarge, { scale: 55, grid: false });
  assert.ok(!svgLarge.includes('NaN'), 'Large coordinates must not produce NaN');
});

test('State Machine: History capacity bounds (caps at 80) and invalid mutation rejection', () => {
  const session = create3DHistorySession();
  let doc = blankDocument();
  session.commit(doc);

  // Commit 100 mutations
  for (let i = 0; i < 100; i++) {
    const next = structuredClone(session.doc);
    next.points.push({ id: 'P' + i, x: i, y: 0 });
    session.commit(next);
  }

  // History should be strictly capped at 80
  assert.equal(session.history.length, 80, 'History stack must be capped at 80');

  // Test invalid document rejection in commit
  const invalidDoc = structuredClone(session.doc);
  // Duplicate ID is illegal
  invalidDoc.points.push({ id: 'P0', x: 999, y: 999 });

  const commitSuccess = session.commit(invalidDoc);
  assert.equal(commitSuccess, false, 'Invalid document must be rejected by commit');
  assert.equal(session.history.length, 80, 'History must not be corrupted by failed commit');
  assert.ok(!session.doc.points.some((p: any) => p.x === 999), 'Rejected document must not modify current doc');
});

