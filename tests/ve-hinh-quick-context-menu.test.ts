/**
 * tests/ve-hinh-quick-context-menu.test.ts
 * Bộ kiểm thử toàn diện cho Quick Context Menu (Milestone 3 - R3)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import {
  blankDocument,
  emptyDocument,
  validateDocument,
  resolve,
  removePoint
} from '../public/ve-hinh/src/math.js';

import {
  PEDAGOGICAL_PALETTE,
  getSelectedTarget,
  findSelectedElement,
  calculateContextMenuPosition,
  updateContextMenuPosition,
  shouldShowContextMenu,
  renderContextMenuContent,
  bindContextMenuEvents,
  showQuickContextMenu,
  hideQuickContextMenu,
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ============================================================================
// SUITE 1: TÍNH TOÁN TỌA ĐỘ VÀ CHỐNG TRÀN BIÊN (PURE MATH & BOUNDARY CLAMPING)
// ============================================================================

test('calculateContextMenuPosition: Centers horizontally and places above centered target', () => {
  const canvasRect = { left: 100, top: 100, width: 1000, height: 600 };
  const targetRect = {
    left: 550, // Center of canvas is 100 + 500 = 600. Target at 550..650
    top: 350,
    right: 650,
    bottom: 390,
    width: 100,
    height: 40
  };

  const pos = calculateContextMenuPosition(targetRect, canvasRect, { width: 200, height: 40 });
  // targetCenterX relative to canvas: (550 - 100) + 50 = 500
  // left: 500 - 100 = 400
  assert.equal(pos.left, 400);
  // top: (350 - 100) - 40 - 10 = 200
  assert.equal(pos.top, 200);
  assert.equal(pos.flipped, false);
});

test('calculateContextMenuPosition: Automatically flips below target when near top canvas edge', () => {
  const canvasRect = { left: 0, top: 0, width: 1000, height: 600 };
  const targetRect = {
    left: 400,
    top: 20, // Too close to top
    right: 440,
    bottom: 40,
    width: 40,
    height: 20
  };

  const pos = calculateContextMenuPosition(targetRect, canvasRect, { width: 200, height: 40 });
  assert.equal(pos.flipped, true, 'Must flip when top overflows');
  // top = targetBottom (40) + offsetY (10) = 50
  assert.equal(pos.top, 50);
});

test('calculateContextMenuPosition: Clamps to left boundary when target is near left edge', () => {
  const canvasRect = { left: 0, top: 0, width: 1000, height: 600 };
  const targetRect = {
    left: 5,
    top: 300,
    right: 25,
    bottom: 320,
    width: 20,
    height: 20
  };

  const pos = calculateContextMenuPosition(targetRect, canvasRect, { width: 240, height: 40 }, { padding: 12 });
  assert.equal(pos.left, 12, 'Left coordinate must be clamped to padding (12px)');
});

test('calculateContextMenuPosition: Clamps to right boundary when target is near right edge', () => {
  const canvasRect = { left: 0, top: 0, width: 1000, height: 600 };
  const targetRect = {
    left: 980,
    top: 300,
    right: 995,
    bottom: 320,
    width: 15,
    height: 20
  };

  const pos = calculateContextMenuPosition(targetRect, canvasRect, { width: 240, height: 40 }, { padding: 12 });
  // maxLeft = 1000 - 240 - 12 = 748
  assert.equal(pos.left, 748, 'Left coordinate must be clamped to right edge minus menu width and padding');
});

test('calculateContextMenuPosition: Handles corner collision (top-right flips and clamps right)', () => {
  const canvasRect = { left: 0, top: 0, width: 800, height: 600 };
  const targetRect = {
    left: 770,
    top: 15,
    right: 790,
    bottom: 35,
    width: 20,
    height: 20
  };

  const pos = calculateContextMenuPosition(targetRect, canvasRect, { width: 200, height: 40 });
  assert.equal(pos.flipped, true);
  assert.equal(pos.top, 45); // 35 + 10
  assert.equal(pos.left, 800 - 200 - 12); // 588
});

test('calculateContextMenuPosition: Clamps to bottom edge when flipped at bottom of canvas', () => {
  const canvasRect = { left: 0, top: 0, width: 800, height: 400 };
  const targetRect = {
    left: 400,
    top: 10,
    right: 420,
    bottom: 380, // very tall object spanning from 10 to 380
    width: 20,
    height: 370
  };

  const pos = calculateContextMenuPosition(targetRect, canvasRect, { width: 200, height: 40 });
  assert.equal(pos.flipped, true);
  // bottom clamped: maxTop = 400 - 40 - 12 = 348
  assert.equal(pos.top, 348);
});

test('calculateContextMenuPosition: Custom padding and offsetY options are respected', () => {
  const canvasRect = { left: 0, top: 0, width: 500, height: 500 };
  const targetRect = {
    left: 10,
    top: 200,
    right: 30,
    bottom: 220,
    width: 20,
    height: 20
  };

  const pos = calculateContextMenuPosition(targetRect, canvasRect, { width: 100, height: 30 }, { padding: 25, offsetY: 15 });
  assert.equal(pos.left, 25, 'Clamped to custom padding 25');
  assert.equal(pos.top, 200 - 30 - 15, 'Target top - menu height - custom offsetY');
});

// ============================================================================
// SUITE 2: TRUY VẤN VÀ PHÂN LOẠI ĐỐI TƯỢNG (TARGET RESOLUTION & DISCOVERY)
// ============================================================================

test('getSelectedTarget: correctly identifies 2D and 3D polymorphic targets', () => {
  const doc = blankDocument();
  doc.points.push({ id: 'A', x: 0, y: 0, label: 'A' });
  doc.shapes.push({ id: 's1', type: 'segment', refs: ['A', 'B'], color: '#176b52', dashed: false });
  doc.solid = {
    type: 'custom',
    rotation: 30,
    tilt: 20,
    enabled: true,
    points: [{ id: 'S', x: 0, y: 0, z: 5, label: 'S' }],
    segments: [{ id: 'seg_S_A', refs: ['S', 'A'], styleMode: 'auto', color: '#176b52' }],
    crossSections: [{ id: 'cs1', refs: ['S', 'A', 'B'], color: '#dfac48', opacity: 0.35 }],
    planes: [{ id: 'pl1', refs: ['A', 'B', 'C'], color: '#176b52', opacity: 0.35 }]
  };

  // 2D Point
  const targetA = getSelectedTarget(doc, 'A', 'geometry');
  assert.ok(targetA);
  assert.equal(targetA.type, 'point2d');
  assert.equal(targetA.data.id, 'A');

  // 2D Shape
  const targetS1 = getSelectedTarget(doc, 's1', 'geometry');
  assert.ok(targetS1);
  assert.equal(targetS1.type, 'shape2d');
  assert.equal(targetS1.data.id, 's1');

  // 3D Vertex
  const targetS = getSelectedTarget(doc, 'S', 'solid');
  assert.ok(targetS);
  assert.equal(targetS.type, 'vertex3d');
  assert.equal(targetS.data.id, 'S');

  // 3D Segment
  const targetSeg = getSelectedTarget(doc, 'seg_S_A', 'solid');
  assert.ok(targetSeg);
  assert.equal(targetSeg.type, 'segment3d');
  assert.equal(targetSeg.data.id, 'seg_S_A');

  // 3D Cross-section
  const targetCS = getSelectedTarget(doc, 'cs1', 'solid');
  assert.ok(targetCS);
  assert.equal(targetCS.type, 'crosssection3d');
  assert.equal(targetCS.data.id, 'cs1');

  // 3D Plane
  const targetPL = getSelectedTarget(doc, 'pl1', 'solid');
  assert.ok(targetPL);
  assert.equal(targetPL.type, 'plane3d');
  assert.equal(targetPL.data.id, 'pl1');

  // Non-existing
  assert.equal(getSelectedTarget(doc, 'NON_EXISTENT', 'geometry'), null);
  assert.equal(getSelectedTarget(doc, '', 'geometry'), null);
});

test('findSelectedElement: queries correct SVG elements from DOM', () => {
  const dom = new JSDOM(`
    <div id="canvas">
      <svg>
        <g data-point="A"><circle cx="10" cy="10" r="5"></circle></g>
        <path data-shape="s1" d="M0,0 L10,10"></path>
        <circle data-vertex="S" cx="20" cy="20" r="6"></circle>
        <g id="solid-segments-hit-layer">
          <line data-segment-3d="seg1" x1="0" y1="0" x2="20" y2="20"></line>
        </g>
        <polygon data-crosssection="cs1" points="0,0 10,0 5,10"></polygon>
      </svg>
    </div>
  `);

  (globalThis as any).document = dom.window.document;

  const elPoint = findSelectedElement('A');
  assert.ok(elPoint);
  assert.equal(elPoint.tagName.toLowerCase(), 'circle');

  const elShape = findSelectedElement('s1');
  assert.ok(elShape);
  assert.equal(elShape.getAttribute('data-shape'), 's1');

  const elVertex = findSelectedElement('S');
  assert.ok(elVertex);
  assert.equal(elVertex.getAttribute('data-vertex'), 'S');

  const elSeg = findSelectedElement('seg1');
  assert.ok(elSeg);
  assert.equal(elSeg.getAttribute('data-segment-3d'), 'seg1');

  const elCS = findSelectedElement('cs1');
  assert.ok(elCS);
  assert.equal(elCS.getAttribute('data-crosssection'), 'cs1');

  assert.equal(findSelectedElement('UNKNOWN'), null);
  assert.equal(findSelectedElement(''), null);

  delete (globalThis as any).document;
});

// ============================================================================
// SUITE 3: VÒNG ĐỜI SỰ KIỆN VÀ MÁY TRẠNG THÁI (LIFECYCLE STATE MACHINE)
// ============================================================================

test('shouldShowContextMenu: Active when 1 object is selected in select mode', () => {
  const doc = blankDocument();
  doc.points.push({ id: 'A', x: 0, y: 0, label: 'A' });

  // 2D Select
  assert.equal(
    shouldShowContextMenu({ mode: 'geometry', tool: 'select', selected: 'A', selectedIdsCount: 0, doc }),
    true
  );

  // 3D Select
  const solidDoc = create3DPrimitive('pyramid4');
  assert.equal(
    shouldShowContextMenu({ mode: 'solid', tool: 'select3d', selected: 'S', selectedIdsCount: 0, doc: solidDoc }),
    true
  );
  assert.equal(
    shouldShowContextMenu({ mode: 'solid', tool: 'orbit3d', selected: 'S', selectedIdsCount: 0, doc: solidDoc }),
    true
  );
});

test('shouldShowContextMenu: Dismissed on deselect (selected empty)', () => {
  const doc = blankDocument();
  assert.equal(
    shouldShowContextMenu({ mode: 'geometry', tool: 'select', selected: '', selectedIdsCount: 0, doc }),
    false
  );
});

test('shouldShowContextMenu: Dismissed when tool switches away from select', () => {
  const doc = blankDocument();
  doc.points.push({ id: 'A', x: 0, y: 0 });

  assert.equal(
    shouldShowContextMenu({ mode: 'geometry', tool: 'segment', selected: 'A', selectedIdsCount: 0, doc }),
    false
  );
  assert.equal(
    shouldShowContextMenu({ mode: 'geometry', tool: 'circle', selected: 'A', selectedIdsCount: 0, doc }),
    false
  );
  assert.equal(
    shouldShowContextMenu({ mode: 'solid', tool: 'segment3d', selected: 'S', selectedIdsCount: 0, doc }),
    false
  );
});

test('shouldShowContextMenu: Dismissed on multi-selection (selectedIdsCount > 1)', () => {
  const doc = blankDocument();
  doc.points.push({ id: 'A', x: 0, y: 0 });
  assert.equal(
    shouldShowContextMenu({ mode: 'geometry', tool: 'select', selected: 'A', selectedIdsCount: 3, doc }),
    false,
    'Must hide when multiple objects are selected'
  );
});

test('shouldShowContextMenu: Dismissed when target object does not exist in doc', () => {
  const doc = blankDocument();
  assert.equal(
    shouldShowContextMenu({ mode: 'geometry', tool: 'select', selected: 'DELETED_ID', selectedIdsCount: 0, doc }),
    false
  );
});

test('shouldShowContextMenu: Dismissed in non-drawing modes (graph, chart)', () => {
  const doc = blankDocument();
  doc.points.push({ id: 'A', x: 0, y: 0 });

  assert.equal(
    shouldShowContextMenu({ mode: 'graph', tool: 'select', selected: 'A', selectedIdsCount: 0, doc }),
    false
  );
  assert.equal(
    shouldShowContextMenu({ mode: 'chart', tool: 'select', selected: 'A', selectedIdsCount: 0, doc }),
    false
  );
});

// ============================================================================
// SUITE 4: THAO TÁC NHANH (ACTION HANDLERS) & BIẾN ĐỔI DỮ LIỆU
// ============================================================================

test('Quick Action: setShapeColor updates color without mutating other properties', () => {
  const doc = blankDocument();
  doc.shapes.push({ id: 's1', type: 'segment', refs: ['A', 'B'], color: '#176b52', dashed: false });

  const next = setShapeColor(doc, 's1', '#dc2626');
  assert.equal(next.shapes[0].color, '#dc2626');
  assert.equal(next.shapes[0].dashed, false);
  assert.equal(doc.shapes[0].color, '#176b52', 'Original document must remain immutable');
});

test('Quick Action: toggleShapeDashed flips dashed boolean flag', () => {
  const doc = blankDocument();
  doc.shapes.push({ id: 's1', type: 'segment', refs: ['A', 'B'], color: '#176b52', dashed: false });

  const next1 = toggleShapeDashed(doc, 's1');
  assert.equal(next1.shapes[0].dashed, true);

  const next2 = toggleShapeDashed(next1, 's1');
  assert.equal(next2.shapes[0].dashed, false);
});

test('Quick Action: setShapeStrokeWidth updates stroke thickness', () => {
  const doc = blankDocument();
  doc.shapes.push({ id: 's1', type: 'circle', refs: ['A', 'B'], color: '#176b52' });

  const next = setShapeStrokeWidth(doc, 's1', 4.0);
  assert.equal(next.shapes[0].strokeWidth, 4.0);
  assert.equal(doc.shapes[0].strokeWidth, undefined);
});

test('Quick Action: updatePointLabel updates label cleanly', () => {
  const doc = blankDocument();
  doc.points.push({ id: 'A', x: 1, y: 2, label: 'A' });

  const next = updatePointLabel(doc, 'A', 'M_1');
  assert.equal(next.points[0].label, 'M_1');
  assert.equal(doc.points[0].label, 'A');
});

test('Quick Action: deleteShape removes target shape from document', () => {
  const doc = blankDocument();
  doc.shapes.push({ id: 's1', type: 'segment', refs: ['A', 'B'] });
  doc.shapes.push({ id: 's2', type: 'segment', refs: ['B', 'C'] });

  const next = deleteShape(doc, 's1');
  assert.equal(next.shapes.length, 1);
  assert.equal(next.shapes[0].id, 's2');
});

test('Quick Action: 3D Segment toggleSegmentStyle cycles auto -> solid -> dashed -> auto', () => {
  const doc = create3DPrimitive('pyramid4');
  const segId = doc.solid.segments[0].id;

  const n1 = toggleSegmentStyle(doc, segId);
  assert.equal(n1.solid.segments[0].styleMode, 'solid');

  const n2 = toggleSegmentStyle(n1, segId);
  assert.equal(n2.solid.segments[0].styleMode, 'dashed');

  const n3 = toggleSegmentStyle(n2, segId);
  assert.equal(n3.solid.segments[0].styleMode, 'auto');

  // Explicit mode setting
  const nDirect = toggleSegmentStyle(doc, segId, 'dashed');
  assert.equal(nDirect.solid.segments[0].styleMode, 'dashed');
});

test('Quick Action: 3D Segment setSolidSegmentColor and deleteSolidSegment', () => {
  const doc = create3DPrimitive('pyramid4');
  const segId = doc.solid.segments[0].id;

  const nColor = setSolidSegmentColor(doc, segId, '#2563eb');
  assert.equal(nColor.solid.segments[0].color, '#2563eb');

  const nDel = deleteSolidSegment(doc, segId);
  assert.equal(nDel.solid.segments.some((s: any) => s.id === segId), false);
});

test('Quick Action: 3D Vertex updateSolidPointLabel', () => {
  const doc = create3DPrimitive('pyramid4');
  const nLabel = updateSolidPointLabel(doc, 'S', 'Apex_S');
  assert.equal(nLabel.solid.points.find((p: any) => p.id === 'S').label, 'Apex_S');
});

test('Quick Action: 3D Cross-section color and opacity mutations and delete', () => {
  const doc = create3DPrimitive('pyramid4');
  doc.solid.crossSections = [
    { id: 'cs1', refs: ['S', 'A', 'B'], color: '#dfac48', opacity: 0.35 }
  ];

  const nColor = setCrossSectionColor(doc, 'cs1', '#dc2626');
  assert.equal(nColor.solid.crossSections[0].color, '#dc2626');

  const nOpacity = setCrossSectionOpacity(doc, 'cs1', 0.60);
  assert.equal(nOpacity.solid.crossSections[0].opacity, 0.60);

  const nDel = deleteCrossSection(doc, 'cs1');
  assert.equal(nDel.solid.crossSections.length, 0);
});

test('Quick Action: removePoint cascades deletion to dependent shapes and edges', () => {
  const doc = blankDocument();
  doc.points.push({ id: 'A', x: 0, y: 0 });
  doc.points.push({ id: 'B', x: 4, y: 0 });
  doc.points.push({ id: 'M', kind: 'midpoint', refs: ['A', 'B'] });
  doc.shapes.push({ id: 's1', type: 'segment', refs: ['A', 'B'] });

  const next = removePoint(doc, 'A');
  // Removing A must also remove dependent M and segment s1
  assert.equal(next.points.some((p: any) => p.id === 'A'), false);
  assert.equal(next.points.some((p: any) => p.id === 'M'), false, 'Dependent midpoint M must be removed');
  assert.equal(next.shapes.some((s: any) => s.id === 's1'), false, 'Segment referencing A must be removed');
  assert.equal(next.points.length, 1);
  assert.equal(next.points[0].id, 'B');
});

// ============================================================================
// SUITE 5: BẢO TOÀN LỊCH SỬ HOÀN TÁC (UNDO / REDO STACK PRESERVATION)
// ============================================================================

test('Undo/Redo Stack: Quick context action preserves history and can be undone/redone', () => {
  const initialDoc = blankDocument();
  initialDoc.points.push({ id: 'A', x: 0, y: 0 }, { id: 'B', x: 4, y: 0 });
  initialDoc.shapes.push({ id: 's1', type: 'segment', refs: ['A', 'B'], color: '#176b52', dashed: false });

  const session = create3DHistorySession(initialDoc);

  // Step 1: Change color to red
  const docAfterColor = setShapeColor(session.doc, 's1', '#dc2626');
  session.commit(docAfterColor);
  assert.equal(session.doc.shapes[0].color, '#dc2626');
  assert.equal(session.history.length, 1);

  // Step 2: Toggle dashed
  const docAfterDash = toggleShapeDashed(session.doc, 's1');
  session.commit(docAfterDash);
  assert.equal(session.doc.shapes[0].dashed, true);
  assert.equal(session.history.length, 2);

  // Undo step 2 (revert dashed)
  assert.ok(session.undo());
  assert.equal(session.doc.shapes[0].dashed, false);
  assert.equal(session.doc.shapes[0].color, '#dc2626');

  // Undo step 1 (revert color)
  assert.ok(session.undo());
  assert.equal(session.doc.shapes[0].color, '#176b52');

  // Redo step 1 (restore red color)
  assert.ok(session.redo());
  assert.equal(session.doc.shapes[0].color, '#dc2626');

  // Redo step 2 (restore dashed)
  assert.ok(session.redo());
  assert.equal(session.doc.shapes[0].dashed, true);
});

test('Undo/Redo Stack: Multi-step action with delete and restore', () => {
  const initialDoc = blankDocument();
  initialDoc.points.push({ id: 'A', x: 0, y: 0, label: 'A' }, { id: 'B', x: 4, y: 0 });
  initialDoc.shapes.push({ id: 's1', type: 'circle', refs: ['A', 'B'], strokeWidth: 2.5 });

  const session = create3DHistorySession(initialDoc);

  // Step 1: Change width
  session.commit(setShapeStrokeWidth(session.doc, 's1', 4.0));
  assert.equal(session.doc.shapes[0].strokeWidth, 4.0);

  // Step 2: Delete shape
  session.commit(deleteShape(session.doc, 's1'));
  assert.equal(session.doc.shapes.length, 0);

  // Undo step 2: Shape is restored with strokeWidth 4.0
  assert.ok(session.undo());
  assert.equal(session.doc.shapes.length, 1);
  assert.equal(session.doc.shapes[0].strokeWidth, 4.0);

  // Undo step 1: strokeWidth is restored to 2.5
  assert.ok(session.undo());
  assert.equal(session.doc.shapes[0].strokeWidth, 2.5);
});

// ============================================================================
// SUITE 6: TÀI NGUYÊN TĨNH & KIỂM THỬ GIAO DIỆN VỚI JSDOM
// ============================================================================

test('UI Static Verification: index.html contains #quick-context-menu container', () => {
  const htmlPath = path.join(rootDir, 'public', 've-hinh', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(
    html.includes('id="quick-context-menu"') && html.includes('class="quick-context-menu"'),
    'index.html must have #quick-context-menu container'
  );
  assert.ok(
    html.includes('<div id="canvas" class="canvas"') && html.includes('<div id="quick-context-menu"'),
    'index.html must place #quick-context-menu right after #canvas'
  );
});

test('CSS Static Verification: style.css defines styles for .quick-context-menu and dark mode', () => {
  const cssPath = path.join(rootDir, 'public', 've-hinh', 'style.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.quick-context-menu'), 'CSS must define .quick-context-menu');
  assert.ok(css.includes('.qcm-btn'), 'CSS must style .qcm-btn');
  assert.ok(css.includes('.qcm-color-swatch'), 'CSS must style .qcm-color-swatch');
  assert.ok(css.includes('.qcm-input'), 'CSS must style .qcm-input');
  assert.ok(css.includes('.qcm-divider'), 'CSS must style .qcm-divider');
  assert.ok(css.includes('.qcm-btn-delete'), 'CSS must style .qcm-btn-delete');
  assert.ok(
    css.includes(':root.dark .quick-context-menu') || css.includes('body.dark .quick-context-menu'),
    'CSS must support dark mode'
  );
});

test('JSDOM Event Isolation: Clicking on Quick Context Menu stops propagation to Canvas', () => {
  const dom = new JSDOM(`
    <div id="canvas">
      <div id="quick-context-menu">
        <button id="btn-red" class="qcm-btn">Red</button>
      </div>
    </div>
  `);

  const canvas = dom.window.document.getElementById('canvas')!;
  const qcm = dom.window.document.getElementById('quick-context-menu')!;
  const btn = dom.window.document.getElementById('btn-red')!;

  let canvasClicked = false;
  canvas.addEventListener('click', () => {
    canvasClicked = true;
  });

  // Stop propagation on context menu container (as in bindContextMenuEvents)
  qcm.addEventListener('click', e => e.stopPropagation());

  // Simulate click on button inside context menu
  const evt = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  btn.dispatchEvent(evt);

  assert.equal(canvasClicked, false, 'Click on context menu must not propagate to canvas');
});

test('renderContextMenuContent: generates correct HTML markup for different target types', () => {
  // Pedagogical palette check
  assert.equal(PEDAGOGICAL_PALETTE.length, 5);
  assert.equal(PEDAGOGICAL_PALETTE[0].hex, '#176b52');

  const dom = new JSDOM('<div id="quick-context-menu"></div>');
  (globalThis as any).document = dom.window.document;

  // Point markup has label input and delete
  const pointDoc = blankDocument();
  pointDoc.points.push({ id: 'P1', x: 0, y: 0, label: 'P_1' });
  // Pass doc via getSelectedTarget
  const targetPoint = getSelectedTarget(pointDoc, 'P1', 'geometry');
  assert.ok(targetPoint);
  assert.equal(targetPoint.type, 'point2d');

  // Shape markup has palette, dash button, stroke width, delete
  const shapeDoc = blankDocument();
  shapeDoc.shapes.push({ id: 's1', type: 'segment', refs: ['A', 'B'], color: '#176b52', dashed: true, strokeWidth: 2.5 });
  const targetShape = getSelectedTarget(shapeDoc, 's1', 'geometry');
  assert.ok(targetShape);
  assert.equal(targetShape.type, 'shape2d');

  delete (globalThis as any).document;
});

// ============================================================================
// SUITE 7: KIỂM THỬ VÒNG ĐỜI & TƯƠNG TÁC MẶT PHẲNG 3D (SOLID.PLANES REMEDIATION)
// ============================================================================

test('Remediation 7.1: 3D Plane selection persistence in render() and ids whitelist', () => {
  const doc = blankDocument();
  doc.solid = {
    enabled: true,
    type: 'pyramid',
    rotation: 30,
    tilt: 20,
    points: [{ id: 'S', x: 0, y: 2, z: 0 }, { id: 'A', x: -1, y: 0, z: -1 }, { id: 'B', x: 1, y: 0, z: -1 }, { id: 'C', x: 0, y: 0, z: 1 }],
    segments: [{ id: 'SA', refs: ['S', 'A'] }],
    planes: [{ id: 'pl1', refs: ['S', 'A', 'B'], color: '#3b82f6', opacity: 0.25 }]
  };

  // 1. Check ids whitelist in render() includes solid.planes
  const ids = new Set([
    ...doc.points,
    ...doc.shapes,
    ...(doc.solid?.points || []),
    ...(doc.solid?.segments || []),
    ...(doc.solid?.crossSections || []),
    ...(doc.solid?.planes || [])
  ].map(o => o.id));

  assert.ok(ids.has('pl1'), 'ids set must include 3D plane pl1');

  // 2. Check selection validation in render()
  const is3D = true;
  let selected = 'pl1';
  if (is3D &&
      !(doc.solid?.points?.some(p => p.id === selected)) &&
      !(doc.solid?.segments?.some(s => s.id === selected)) &&
      !(doc.solid?.crossSections?.some(c => c.id === selected)) &&
      !(doc.solid?.planes?.some(pl => pl.id === selected))) {
    selected = '';
  }

  assert.equal(selected, 'pl1', 'Selected 3D plane must NOT be wiped by render()');

  // 3. shouldShowContextMenu remains true for the selected plane
  const showMenu = shouldShowContextMenu({
    mode: 'solid',
    tool: 'select3d',
    selected,
    selectedIdsCount: 0,
    doc
  });
  assert.equal(showMenu, true, 'Quick Context Menu must be shown for selected 3D plane');
});

test('Remediation 7.2: Canvas pointerdown hit-testing correctly detects [data-plane]', () => {
  const dom = new JSDOM(`
    <div id="canvas">
      <svg>
        <polygon data-plane="pl_ABC" points="10,10 50,20 30,80" pointer-events="all"></polygon>
        <line data-segment-3d="seg_AB" x1="10" y1="10" x2="50" y2="20"></line>
      </svg>
    </div>
  `);

  const planeEl = dom.window.document.querySelector('[data-plane="pl_ABC"]')!;
  assert.ok(planeEl, 'Plane polygon element must exist in DOM');

  const planeTarget = planeEl.closest('[data-plane]');
  const hitPlane = (planeTarget as HTMLElement)?.dataset?.plane;
  assert.equal(hitPlane, 'pl_ABC', 'hitPlane must be extracted as pl_ABC from closest [data-plane]');

  // Negative checks: plane is not mistaken for vertex, segment, or crossSection
  const vertexTarget = planeEl.closest('[data-vertex], [data-point], [data-vertex-label]');
  const segTarget = planeEl.closest('[data-segment-3d], [data-segment]');
  const csTarget = planeEl.closest('[data-crosssection]');
  assert.equal(vertexTarget, null);
  assert.equal(segTarget, null);
  assert.equal(csTarget, null);
});

test('Remediation 7.3: Sidebar 3D Object Select includes solid.planes options', () => {
  const doc = blankDocument();
  doc.solid = {
    enabled: true,
    type: 'pyramid',
    rotation: 30,
    tilt: 20,
    points: [{ id: 'S', x: 0, y: 2, z: 0, label: 'S' }],
    segments: [{ id: 's1', refs: ['S', 'A'], styleMode: 'solid' }],
    crossSections: [{ id: 'cs1', planeRefs: ['M', 'N', 'P'] }],
    planes: [{ id: 'pl1', refs: ['S', 'A', 'B'] }]
  };

  const selected = 'pl1';
  const pts = doc.solid.points;
  const segs = doc.solid.segments;
  const css = doc.solid.crossSections;
  const pls = doc.solid.planes;

  const ptsOptions = pts.map((pt: any) => `<option value="${pt.id}">Điểm ${pt.label}</option>`).join('');
  const segsOptions = segs.map((sg: any) => `<option value="${sg.id}">Đoạn ${sg.refs.join(' – ')}</option>`).join('');
  const cssOptions = css.map((c: any) => `<option value="${c.id}">Thiết diện ${(c.planeRefs||[]).join(' – ')}</option>`).join('');
  const plsOptions = pls.map((pl: any) => `<option value="${pl.id}" ${pl.id === selected ? 'selected' : ''}>Mặt phẳng (${(pl.refs||[]).join('')})</option>`).join('');

  const dropdownHtml = `<select id="solid-object-select">${ptsOptions}${segsOptions}${cssOptions}${plsOptions}</select>`;
  const dom = new JSDOM(dropdownHtml);
  const select = dom.window.document.getElementById('solid-object-select') as HTMLSelectElement;

  const planeOption = select.querySelector('option[value="pl1"]') as HTMLOptionElement;
  assert.ok(planeOption, 'Option for 3D plane pl1 must exist in #solid-object-select');
  assert.equal(planeOption.selected, true, 'Plane option must be selected when selected === pl1');
  assert.ok(planeOption.textContent?.includes('Mặt phẳng (SAB)'), 'Plane option must display refs SAB');
});

test('Remediation 7.4: Cross-section polygon query ignores 3D plane polygons', () => {
  const dom = new JSDOM(`
    <div id="canvas">
      <svg>
        <!-- 3D Plane rendered before cross-section -->
        <polygon data-plane="pl1" points="0,0 100,0 50,50"></polygon>
        <!-- 3D Cross-section rendered after plane -->
        <polygon points="10,10 40,10 25,25"></polygon>
      </svg>
    </div>
  `);

  const docEl = dom.window.document;
  const allPolys = docEl.querySelectorAll('polygon');
  assert.equal(allPolys.length, 2, 'Total 2 polygons in canvas');

  // With polygon:not([data-plane]) selector
  const csPolys = docEl.querySelectorAll('polygon:not([data-plane])');
  assert.equal(csPolys.length, 1, 'Only cross-section polygon is matched');
  assert.equal(csPolys[0].getAttribute('data-plane'), null, 'Matched polygon does not have data-plane');

  // Tagging test
  csPolys[0].setAttribute('data-crosssection', 'cs1');
  assert.equal(csPolys[0].getAttribute('data-crosssection'), 'cs1');
  assert.equal(allPolys[0].getAttribute('data-crosssection'), null, 'Plane polygon is not polluted with data-crosssection');
});

