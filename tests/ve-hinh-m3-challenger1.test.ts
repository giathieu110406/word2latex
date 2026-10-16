/**
 * tests/ve-hinh-m3-challenger1.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST HARNESS — MILESTONE 3 (R3)
 * Challenger 1: Empirical verification of Quick Context Menu positioning algorithms,
 * boundary clamping, extreme degeneration, and rapid mutation undo/redo fidelity.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blankDocument,
  emptyDocument,
  validateDocument,
  removePoint
} from '../public/ve-hinh/src/math.js';

import {
  calculateContextMenuPosition,
  setShapeColor,
  toggleShapeDashed,
  setShapeStrokeWidth,
  updatePointLabel,
  deleteShape,
  setSolidSegmentColor,
  updateSolidPointLabel,
  setCrossSectionColor,
  setCrossSectionOpacity,
  deleteSolidSegment,
  deleteCrossSection,
  create3DPrimitive,
  toggleSegmentStyle,
  create3DHistorySession
} from '../public/ve-hinh/src/app.js';

// ============================================================================
// STRESS TEST HARNESS 1: calculateContextMenuPosition EXTREME BOUNDARY CONDITIONS
// ============================================================================

test('CHALLENGER 1 - Stress 1.1: Extreme Top Borders (Y=0, Y=5, Y=45) trigger flipping and valid coordinates', () => {
  const canvasRect = { left: 0, top: 0, width: 1000, height: 600 };
  const menuSize = { width: 240, height: 42 };

  // Case 1: Y = 0 (Flush with top canvas edge)
  const rectY0 = { left: 300, top: 0, right: 340, bottom: 20, width: 40, height: 20 };
  const pos0 = calculateContextMenuPosition(rectY0, canvasRect, menuSize);
  assert.equal(pos0.flipped, true, 'At Y=0, menu must flip below target');
  assert.equal(pos0.top, 30, 'At Y=0, flipped top = targetBottom(20) + offsetY(10) = 30');
  assert.ok(Number.isFinite(pos0.left) && !Number.isNaN(pos0.left));
  assert.ok(Number.isFinite(pos0.top) && !Number.isNaN(pos0.top));

  // Case 2: Y = 5 (Near top border)
  const rectY5 = { left: 300, top: 5, right: 340, bottom: 25, width: 40, height: 20 };
  const pos5 = calculateContextMenuPosition(rectY5, canvasRect, menuSize);
  assert.equal(pos5.flipped, true, 'At Y=5, menu must flip below target');
  assert.equal(pos5.top, 35, 'At Y=5, flipped top = 25 + 10 = 35');

  // Case 3: Y = 45 (45 - 42 - 10 = -7 < padding 12)
  const rectY45 = { left: 300, top: 45, right: 340, bottom: 65, width: 40, height: 20 };
  const posY45 = calculateContextMenuPosition(rectY45, canvasRect, menuSize);
  assert.equal(posY45.flipped, true, 'At Y=45, top position would overflow top boundary, must flip');
  assert.equal(posY45.top, 75, 'At Y=45, flipped top = 65 + 10 = 75');

  // Case 4: Y = 70 (70 - 42 - 10 = 18 >= padding 12, safe above)
  const rectY70 = { left: 300, top: 70, right: 340, bottom: 90, width: 40, height: 20 };
  const posY70 = calculateContextMenuPosition(rectY70, canvasRect, menuSize);
  assert.equal(posY70.flipped, false, 'At Y=70, menu has enough room above');
  assert.equal(posY70.top, 18, 'Top = 70 - 42 - 10 = 18');
});

test('CHALLENGER 1 - Stress 1.2: Extreme Bottom Borders (Y = canvasHeight, deep bottom targets)', () => {
  const canvasRect = { left: 0, top: 0, width: 1000, height: 600 };
  const menuSize = { width: 240, height: 42 };
  const padding = 12;
  const maxSafeTop = 600 - 42 - padding; // 546

  // Case 1: Target at exact bottom of canvas (Y = 600)
  const rectBottom = { left: 400, top: 600, right: 440, bottom: 620, width: 40, height: 20 };
  const posBottom = calculateContextMenuPosition(rectBottom, canvasRect, menuSize);
  assert.equal(posBottom.flipped, false, 'Should attempt placement above');
  assert.equal(posBottom.top, maxSafeTop, 'Top must be clamped to maxSafeTop (546)');
  assert.ok(posBottom.top <= maxSafeTop);

  // Case 2: Target starting near top and ending near bottom (tall object)
  const rectTall = { left: 400, top: 10, right: 440, bottom: 590, width: 40, height: 580 };
  const posTall = calculateContextMenuPosition(rectTall, canvasRect, menuSize);
  assert.equal(posTall.flipped, true, 'Must flip because top is at 10');
  // Flipped would be 590 + 10 = 600, but canvas height is 600, so it must clamp to maxSafeTop
  assert.equal(posTall.top, maxSafeTop, 'Flipped position must clamp to bottom boundary');
});

test('CHALLENGER 1 - Stress 1.3: Extreme Left and Right Borders (X = 0, X = canvasWidth, negative X, overflow X)', () => {
  const canvasRect = { left: 0, top: 0, width: 800, height: 500 };
  const menuSize = { width: 200, height: 40 };
  const padding = 12;
  const maxSafeLeft = 800 - 200 - padding; // 588

  // Case 1: Left boundary at X = 0
  const rectX0 = { left: 0, top: 200, right: 20, bottom: 220, width: 20, height: 20 };
  const posX0 = calculateContextMenuPosition(rectX0, canvasRect, menuSize, { padding });
  assert.equal(posX0.left, padding, 'Left must be clamped to padding (12)');

  // Case 2: Right boundary at X = canvasWidth (800)
  const rectXRight = { left: 800, top: 200, right: 820, bottom: 220, width: 20, height: 20 };
  const posXRight = calculateContextMenuPosition(rectXRight, canvasRect, menuSize, { padding });
  assert.equal(posXRight.left, maxSafeLeft, 'Left must be clamped to right margin (588)');

  // Case 3: Negative X coordinates (target dragged partially offscreen left)
  const rectXNeg = { left: -300, top: 200, right: -250, bottom: 220, width: 50, height: 20 };
  const posXNeg = calculateContextMenuPosition(rectXNeg, canvasRect, menuSize, { padding });
  assert.equal(posXNeg.left, padding, 'Offscreen left target must clamp menu to left padding');

  // Case 4: Far right X coordinates (target offscreen right)
  const rectXFarRight = { left: 1500, top: 200, right: 1550, bottom: 220, width: 50, height: 20 };
  const posXFarRight = calculateContextMenuPosition(rectXFarRight, canvasRect, menuSize, { padding });
  assert.equal(posXFarRight.left, maxSafeLeft, 'Offscreen right target must clamp menu to right padding');
});

test('CHALLENGER 1 - Stress 1.4: Massive Oversized targetRect (larger than canvas)', () => {
  const canvasRect = { left: 0, top: 0, width: 800, height: 600 };
  const menuSize = { width: 240, height: 42 };
  const padding = 12;

  // targetRect is 4000x3000, spanning across and beyond canvas
  const rectGiant = { left: -500, top: -200, right: 3500, bottom: 2800, width: 4000, height: 3000 };
  const pos = calculateContextMenuPosition(rectGiant, canvasRect, menuSize, { padding });

  assert.ok(Number.isFinite(pos.left), 'Left must be a finite number');
  assert.ok(Number.isFinite(pos.top), 'Top must be a finite number');
  assert.ok(!Number.isNaN(pos.left), 'Left must not be NaN');
  assert.ok(!Number.isNaN(pos.top), 'Top must not be NaN');

  const maxSafeLeft = 800 - 240 - padding;
  const maxSafeTop = 600 - 42 - padding;

  assert.ok(pos.left >= padding && pos.left <= maxSafeLeft, `Left (${pos.left}) must be within [${padding}, ${maxSafeLeft}]`);
  assert.ok(pos.top >= padding && pos.top <= maxSafeTop, `Top (${pos.top}) must be within [${padding}, ${maxSafeTop}]`);
});

test('CHALLENGER 1 - Stress 1.5: Ultra-small Canvas (300x200, 200x50, 100x30)', () => {
  const menuSize = { width: 240, height: 42 };
  const padding = 8;

  // Small Canvas: 300x200
  const canvas300x200 = { left: 0, top: 0, width: 300, height: 200 };
  const target1 = { left: 50, top: 50, right: 80, bottom: 80, width: 30, height: 30 };
  const pos1 = calculateContextMenuPosition(target1, canvas300x200, menuSize, { padding });
  assert.ok(Number.isFinite(pos1.left) && Number.isFinite(pos1.top));
  assert.ok(pos1.left >= padding);
  assert.ok(pos1.top >= padding);

  // Tiny Canvas smaller than menu: 200x50 (menu is 240x42)
  const canvasTiny = { left: 0, top: 0, width: 200, height: 50 };
  const target2 = { left: 10, top: 10, right: 30, bottom: 30, width: 20, height: 20 };
  const pos2 = calculateContextMenuPosition(target2, canvasTiny, menuSize, { padding });
  assert.ok(Number.isFinite(pos2.left) && !Number.isNaN(pos2.left));
  assert.ok(Number.isFinite(pos2.top) && !Number.isNaN(pos2.top));
  // Under inverted bounds (canvasWidth < menuWidth), Math.max(padding, ...) keeps it safe
  assert.equal(pos2.left, padding);
  assert.equal(pos2.top, padding);
});

test('CHALLENGER 1 - Stress 1.6: Degenerate Target Shapes (0x0 point, 1D line segments, negative dims)', () => {
  const canvasRect = { left: 50, top: 50, width: 800, height: 600 };
  const menuSize = { width: 200, height: 40 };

  // Point with 0 width and 0 height
  const pointZero = { left: 450, top: 350, right: 450, bottom: 350, width: 0, height: 0 };
  const posPoint = calculateContextMenuPosition(pointZero, canvasRect, menuSize);
  assert.ok(Number.isFinite(posPoint.left) && Number.isFinite(posPoint.top));
  // targetCenterX relative to canvas = (450 - 50) + 0 = 400. left = 400 - 100 = 300
  assert.equal(posPoint.left, 300);
  // top = (350 - 50) - 40 - 10 = 250
  assert.equal(posPoint.top, 250);

  // Pure vertical 1D line (width = 0, height = 300)
  const vertLine = { left: 200, top: 100, right: 200, bottom: 400, width: 0, height: 300 };
  const posVert = calculateContextMenuPosition(vertLine, canvasRect, menuSize);
  assert.ok(Number.isFinite(posVert.left) && Number.isFinite(posVert.top));

  // Pure horizontal 1D line (width = 300, height = 0)
  const horizLine = { left: 200, top: 100, right: 500, bottom: 100, width: 300, height: 0 };
  const posHoriz = calculateContextMenuPosition(horizLine, canvasRect, menuSize);
  assert.ok(Number.isFinite(posHoriz.left) && Number.isFinite(posHoriz.top));
});

test('CHALLENGER 1 - Stress 1.7: Monte Carlo Fuzzing (1,000 randomized boundary inputs)', () => {
  const menuSize = { width: 220, height: 38 };
  let validCount = 0;

  for (let i = 0; i < 1000; i++) {
    // Random canvas dimensions between 100 and 2000
    const canvasWidth = 100 + Math.random() * 1900;
    const canvasHeight = 100 + Math.random() * 1900;
    const canvasRect = {
      left: (Math.random() - 0.5) * 500,
      top: (Math.random() - 0.5) * 500,
      width: canvasWidth,
      height: canvasHeight
    };

    // Random target dimensions, including negative offsets, oversized shapes, degenerates
    const targetWidth = Math.random() * 3000 - 500;
    const targetHeight = Math.random() * 3000 - 500;
    const targetLeft = canvasRect.left + (Math.random() - 0.5) * 4000;
    const targetTop = canvasRect.top + (Math.random() - 0.5) * 4000;

    const targetRect = {
      left: targetLeft,
      top: targetTop,
      right: targetLeft + Math.max(0, targetWidth),
      bottom: targetTop + Math.max(0, targetHeight),
      width: Math.max(0, targetWidth),
      height: Math.max(0, targetHeight)
    };

    const res = calculateContextMenuPosition(targetRect, canvasRect, menuSize);

    assert.ok(Number.isFinite(res.left), `Iteration ${i}: left must be finite`);
    assert.ok(Number.isFinite(res.top), `Iteration ${i}: top must be finite`);
    assert.ok(!Number.isNaN(res.left), `Iteration ${i}: left must not be NaN`);
    assert.ok(!Number.isNaN(res.top), `Iteration ${i}: top must not be NaN`);
    assert.equal(typeof res.flipped, 'boolean', `Iteration ${i}: flipped must be boolean`);

    validCount++;
  }

  assert.equal(validCount, 1000, 'All 1,000 fuzz iterations produced finite, valid position numbers');
});

// ============================================================================
// STRESS TEST HARNESS 2: RAPID MUTATION STORM & 20-STEP UNDO/REDO FIDELITY
// ============================================================================

test('CHALLENGER 1 - Stress 2.1: 20 consecutive rapid 2D shape mutations with full 20-step undo/redo fidelity', () => {
  const initialDoc = blankDocument();
  initialDoc.points.push({ id: 'A', x: 0, y: 0, label: 'A' }, { id: 'B', x: 5, y: 0, label: 'B' });
  initialDoc.shapes.push({
    id: 's1',
    type: 'segment',
    refs: ['A', 'B'],
    color: '#176b52',
    dashed: false,
    strokeWidth: 2.5
  });

  const session = create3DHistorySession(initialDoc);
  const colorPalette = ['#2563eb', '#dc2626', '#d97706', '#1f2937', '#7c3aed', '#059669', '#ea580c', '#0891b2', '#4b5563', '#be123c'];
  const strokeWidths = [1.5, 2.5, 4.0, 1.5, 2.5];

  const snapshots: any[] = [structuredClone(session.doc)];

  // Perform 20 rapid distinct mutations
  for (let i = 1; i <= 20; i++) {
    let nextDoc;
    if (i % 3 === 1) {
      // Color mutation
      const color = colorPalette[(i - 1) % colorPalette.length];
      nextDoc = setShapeColor(session.doc, 's1', color);
    } else if (i % 3 === 2) {
      // Dash mutation
      nextDoc = toggleShapeDashed(session.doc, 's1');
    } else {
      // Stroke width mutation
      const width = strokeWidths[(i / 3 - 1) % strokeWidths.length];
      nextDoc = setShapeStrokeWidth(session.doc, 's1', width);
    }

    const success = session.commit(nextDoc);
    assert.ok(success, `Step ${i}: commit must succeed`);
    assert.equal(session.history.length, i, `Step ${i}: history must have exact length ${i}`);
    snapshots.push(structuredClone(session.doc));
  }

  assert.equal(snapshots.length, 21, 'Must have recorded initial state + 20 mutated states');
  assert.equal(session.history.length, 20, 'History stack must hold 20 steps');

  // Verify 20 consecutive undos step-by-step
  for (let step = 20; step >= 1; step--) {
    const previousSnapshot = snapshots[step - 1];
    const undone = session.undo();
    assert.ok(undone, `Undo step ${step} must succeed`);
    assert.deepEqual(
      session.doc.shapes[0],
      previousSnapshot.shapes[0],
      `Shape at undo step ${step} must exactly match snapshot ${step - 1}`
    );
    assert.equal(session.history.length, step - 1, `History length at undo step ${step} must be ${step - 1}`);
    assert.equal(session.future.length, 21 - step, `Future length at undo step ${step} must be ${21 - step}`);
  }

  // After 20 undos, we must be back at initial document
  assert.deepEqual(session.doc.shapes[0], initialDoc.shapes[0], 'Document after 20 undos must be identical to initial');
  assert.equal(session.history.length, 0, 'History stack must be empty after 20 undos');

  // Verify 20 consecutive redos step-by-step
  for (let step = 1; step <= 20; step++) {
    const expectedSnapshot = snapshots[step];
    const redone = session.redo();
    assert.ok(redone, `Redo step ${step} must succeed`);
    assert.deepEqual(
      session.doc.shapes[0],
      expectedSnapshot.shapes[0],
      `Shape at redo step ${step} must exactly match snapshot ${step}`
    );
    assert.equal(session.history.length, step, `History length at redo step ${step} must be ${step}`);
  }

  assert.deepEqual(session.doc.shapes[0], snapshots[20].shapes[0], 'Document after 20 redos must match 20th snapshot');
  assert.equal(session.future.length, 0, 'Future stack must be empty after 20 redos');
});

test('CHALLENGER 1 - Stress 2.2: 20 consecutive rapid 3D segment mutations (styleMode & color) with undo/redo fidelity', () => {
  const doc = create3DPrimitive('pyramid4');
  const session = create3DHistorySession(doc);
  const targetSegId = session.doc.solid.segments[0].id;

  const styles: Array<'auto' | 'solid' | 'dashed'> = ['solid', 'dashed', 'auto'];
  const colors = ['#2563eb', '#dc2626', '#d97706', '#1f2937'];

  const snapshots: any[] = [structuredClone(session.doc)];

  for (let i = 1; i <= 20; i++) {
    let nextDoc;
    if (i % 2 === 1) {
      const targetStyle = styles[((i - 1) / 2) % styles.length];
      nextDoc = toggleSegmentStyle(session.doc, targetSegId, targetStyle);
    } else {
      const color = colors[(i / 2 - 1) % colors.length];
      nextDoc = setSolidSegmentColor(session.doc, targetSegId, color);
    }

    const ok = session.commit(nextDoc);
    assert.ok(ok, `Step ${i} commit succeeded`);
    snapshots.push(structuredClone(session.doc));
  }

  assert.equal(session.history.length, 20);

  // Undo 20 times
  for (let step = 20; step >= 1; step--) {
    assert.ok(session.undo());
    const seg = session.doc.solid.segments.find((s: any) => s.id === targetSegId);
    const expectedSeg = snapshots[step - 1].solid.segments.find((s: any) => s.id === targetSegId);
    assert.deepEqual(seg, expectedSeg, `3D Segment at step ${step} must match snapshot ${step - 1}`);
  }

  assert.equal(session.history.length, 0);

  // Redo 20 times
  for (let step = 1; step <= 20; step++) {
    assert.ok(session.redo());
    const seg = session.doc.solid.segments.find((s: any) => s.id === targetSegId);
    const expectedSeg = snapshots[step].solid.segments.find((s: any) => s.id === targetSegId);
    assert.deepEqual(seg, expectedSeg, `3D Segment redo at step ${step} must match snapshot ${step}`);
  }
});

test('CHALLENGER 1 - Stress 2.3: Idempotent mutations do not pollute history stack', () => {
  const initialDoc = blankDocument();
  initialDoc.points.push({ id: 'A', x: 0, y: 0 }, { id: 'B', x: 2, y: 2 });
  initialDoc.shapes.push({ id: 's1', type: 'segment', refs: ['A', 'B'], color: '#176b52' });

  const session = create3DHistorySession(initialDoc);

  // Attempting to set identical color multiple times
  for (let i = 0; i < 10; i++) {
    const sameDoc = setShapeColor(session.doc, 's1', '#176b52');
    session.commit(sameDoc);
  }

  assert.equal(session.history.length, 0, 'Identical mutations must not push to history');

  // One real change
  session.commit(setShapeColor(session.doc, 's1', '#dc2626'));
  assert.equal(session.history.length, 1);

  // 10 more identical changes to the new color
  for (let i = 0; i < 10; i++) {
    session.commit(setShapeColor(session.doc, 's1', '#dc2626'));
  }
  assert.equal(session.history.length, 1, 'Subsequent identical mutations must still not push to history');
});

test('CHALLENGER 1 - Stress 2.4: History stack capacity limit (80 items) and FIFO eviction under 100 mutations', () => {
  const doc = blankDocument();
  doc.points.push({ id: 'A', x: 0, y: 0, label: 'A_0' });
  const session = create3DHistorySession(doc);

  // Perform 100 consecutive label mutations
  for (let i = 1; i <= 100; i++) {
    const nextDoc = updatePointLabel(session.doc, 'A', `A_${i}`);
    session.commit(nextDoc);
    assert.ok(session.history.length <= 80, `History length (${session.history.length}) must never exceed 80`);
  }

  assert.equal(session.history.length, 80, 'History must cap at exactly 80 items');
  assert.equal(session.doc.points[0].label, 'A_100');

  // Can undo exactly 80 times
  let undoCount = 0;
  while (session.undo()) {
    undoCount++;
  }

  assert.equal(undoCount, 80, 'Must be able to undo exactly 80 times');
  // Since oldest 20 were evicted, the oldest accessible state is A_20
  assert.equal(session.doc.points[0].label, 'A_20', 'Oldest state after 80 undos must be A_20');
  assert.equal(session.undo(), false, 'Undo at empty stack must return false cleanly');
});

test('CHALLENGER 1 - Stress 2.5: Complex interleaved sequence (Mutate -> Delete -> Undo -> Re-mutate -> Redo boundary)', () => {
  const doc = blankDocument();
  doc.points.push({ id: 'A', x: 0, y: 0 }, { id: 'B', x: 2, y: 2 });
  doc.shapes.push({ id: 's1', type: 'segment', refs: ['A', 'B'], color: '#176b52', dashed: false, strokeWidth: 2.5 });

  const session = create3DHistorySession(doc);

  // Step 1: change color
  session.commit(setShapeColor(session.doc, 's1', '#2563eb'));
  // Step 2: change strokeWidth
  session.commit(setShapeStrokeWidth(session.doc, 's1', 4.0));
  // Step 3: delete shape
  session.commit(deleteShape(session.doc, 's1'));
  assert.equal(session.doc.shapes.length, 0);

  // Undo delete: shape is restored with color #2563eb and strokeWidth 4.0
  assert.ok(session.undo());
  assert.equal(session.doc.shapes.length, 1);
  assert.equal(session.doc.shapes[0].color, '#2563eb');
  assert.equal(session.doc.shapes[0].strokeWidth, 4.0);

  // Branching history test: While at restored state, apply new mutation (dashed = true)
  session.commit(toggleShapeDashed(session.doc, 's1'));
  // This must clear the future stack (the previously undone delete is discarded)
  assert.equal(session.future.length, 0, 'New commit after undo must clear future stack');
  assert.equal(session.redo(), false, 'Redo must return false when future was invalidated');

  // Can still undo back through the modified lineage
  assert.ok(session.undo()); // reverts dashed
  assert.equal(session.doc.shapes[0].dashed, false);
  assert.ok(session.undo()); // reverts strokeWidth to 2.5
  assert.equal(session.doc.shapes[0].strokeWidth, 2.5);
  assert.ok(session.undo()); // reverts color to #176b52
  assert.equal(session.doc.shapes[0].color, '#176b52');
  assert.equal(session.undo(), false);
});

test('CHALLENGER 1 - Stress 2.6: 20 rapid 3D plane opacity and color mutations with full undo/redo cycle', () => {
  const doc = create3DPrimitive('pyramid4');
  doc.solid.planes = [
    { id: 'plane_S_A_B', refs: ['S', 'A', 'B'], color: '#176b52', opacity: 0.35, transparent: true }
  ];
  const session = create3DHistorySession(doc);
  const opacities = [0.15, 0.35, 0.60, 0.35];
  const colors = ['#2563eb', '#dc2626', '#d97706', '#1f2937', '#176b52'];

  const snapshots: any[] = [structuredClone(session.doc)];

  for (let i = 1; i <= 20; i++) {
    let nextDoc;
    if (i % 2 === 1) {
      const nextColor = colors[((i - 1) / 2) % colors.length];
      nextDoc = structuredClone(session.doc);
      nextDoc.solid.planes[0].color = nextColor;
    } else {
      const nextOpacity = opacities[(i / 2 - 1) % opacities.length];
      nextDoc = structuredClone(session.doc);
      nextDoc.solid.planes[0].opacity = nextOpacity;
    }
    const ok = session.commit(nextDoc);
    assert.ok(ok, `Plane mutation step ${i} succeeded`);
    snapshots.push(structuredClone(session.doc));
  }

  assert.equal(session.history.length, 20);

  // Undo 20 times
  for (let step = 20; step >= 1; step--) {
    assert.ok(session.undo());
    assert.deepEqual(
      session.doc.solid.planes[0],
      snapshots[step - 1].solid.planes[0],
      `Plane at step ${step} must match snapshot ${step - 1}`
    );
  }
  assert.equal(session.history.length, 0);

  // Redo 20 times
  for (let step = 1; step <= 20; step++) {
    assert.ok(session.redo());
    assert.deepEqual(
      session.doc.solid.planes[0],
      snapshots[step].solid.planes[0],
      `Plane redo at step ${step} must match snapshot ${step}`
    );
  }
});

// ============================================================================
// STRESS TEST HARNESS 3: SUB-PIXEL INTEGRITY & DOM SAFETIES
// ============================================================================

test('CHALLENGER 1 - Stress 3.1: Sub-pixel floats produce strict integer coordinates (anti-blur)', () => {
  const canvasRect = { left: 10.333, top: 20.777, width: 999.888, height: 600.444 };
  const targetRect = {
    left: 456.789,
    top: 234.567,
    right: 512.345,
    bottom: 267.890,
    width: 55.556,
    height: 33.323
  };

  const pos = calculateContextMenuPosition(targetRect, canvasRect, { width: 239.5, height: 41.5 });
  assert.equal(Number.isInteger(pos.left), true, `Left (${pos.left}) must be an integer`);
  assert.equal(Number.isInteger(pos.top), true, `Top (${pos.top}) must be an integer`);
});

test('CHALLENGER 1 - Stress 3.2: Custom flipThreshold and extreme offsets', () => {
  const canvasRect = { left: 0, top: 0, width: 1000, height: 800 };
  const targetRect = { left: 400, top: 120, right: 450, bottom: 150, width: 50, height: 30 };

  // By default: 120 - 42 - 10 = 68 >= padding(12) -> flipped: false
  const defPos = calculateContextMenuPosition(targetRect, canvasRect, { width: 240, height: 42 });
  assert.equal(defPos.flipped, false);
  assert.equal(defPos.top, 68);

  // With aggressive flipThreshold: 100
  // top (68) < flipThreshold (100) -> must flip!
  const flipPos = calculateContextMenuPosition(targetRect, canvasRect, { width: 240, height: 42 }, { flipThreshold: 100 });
  assert.equal(flipPos.flipped, true);
  assert.equal(flipPos.top, 150 + 10); // targetBottom + offsetY
});

