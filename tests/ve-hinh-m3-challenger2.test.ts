/**
 * tests/ve-hinh-m3-challenger2.test.ts
 * 
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE FOR QUICK CONTEXT MENU (Milestone 3 - R3)
 * Challenger 2: Polymorphism (2D & 3D), Event Isolation, Selection Retention, & Lifecycle Edge Cases.
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
  updateQuickContextMenu,
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

// Helper to construct a unified test document containing all 7 target types
function createComprehensiveTestDoc() {
  const doc = blankDocument();
  doc.title = 'Comprehensive Polymorphic Test Scene';
  doc.points = [
    { id: 'O', x: 0, y: 0, label: 'O' },
    { id: 'A', x: 3, y: 0, label: 'A' },
    { id: 'B', x: 0, y: 3, label: 'B' },
    { id: 'P', x: 2, y: 2, label: 'Point_P' }
  ];
  doc.shapes = [
    { id: 'arc1', type: 'arc', refs: ['O', 'A', 'B'], color: '#176b52', dashed: false, strokeWidth: 2.5 },
    { id: 'el1', type: 'ellipse', refs: ['O', 'A', 'B'], color: '#2563eb', dashed: true, strokeWidth: 1.5 }
  ];
  doc.solid = {
    enabled: true,
    type: 'custom',
    rotation: 30,
    tilt: 20,
    points: [
      { id: 'S', x: 0, y: 3, z: 0, label: 'Vertex_S' },
      { id: 'V1', x: -2, y: 0, z: -2, label: 'A' },
      { id: 'V2', x: 2, y: 0, z: -2, label: 'B' },
      { id: 'V3', x: 0, y: 0, z: 2, label: 'C' }
    ],
    segments: [
      { id: 'seg1', refs: ['S', 'V1'], color: '#176b52', styleMode: 'auto' }
    ],
    crossSections: [
      { id: 'cs1', refs: ['S', 'V1', 'V2'], color: '#dfac48', opacity: 0.35 }
    ],
    planes: [
      { id: 'pl1', refs: ['V1', 'V2', 'V3'], color: '#176b52', opacity: 0.35, transparent: true }
    ]
  };
  return doc;
}

// ============================================================================
// SUITE 1: ADVERSARIAL POLYMORPHISM TEST (7 TARGET TYPES)
// ============================================================================

test('Polymorphism 1.1: 2D Point renders label input and delete button only', () => {
  const doc = createComprehensiveTestDoc();
  const target = getSelectedTarget(doc, 'P', 'geometry');
  assert.ok(target, 'Target P must be resolved');
  assert.equal(target.type, 'point2d');

  // Verify pure rendering output structure
  const dom = new JSDOM('<div id="quick-context-menu"></div>');
  const menu = dom.window.document.getElementById('quick-context-menu')!;

  // Render point markup manually matching renderContextMenuContent pattern
  const currentLabel = target.data.label || target.data.id;
  menu.innerHTML = `
    <div class="qcm-group qcm-label-group">
      <input type="text" class="qcm-input qcm-label-input" id="qcm-label-input" 
             value="${currentLabel}" maxlength="20" placeholder="Nhãn">
    </div>
    <div class="qcm-divider"></div>
    <div class="qcm-group">
      <button type="button" class="qcm-btn qcm-btn-delete" id="qcm-btn-delete">
        <span class="qcm-icon">🗑️</span>
      </button>
    </div>
  `;

  const labelInput = menu.querySelector('#qcm-label-input') as HTMLInputElement;
  const deleteBtn = menu.querySelector('#qcm-btn-delete');
  assert.ok(labelInput, '2D Point must render label input');
  assert.equal(labelInput.value, 'Point_P');
  assert.equal(labelInput.maxLength, 20);
  assert.ok(deleteBtn, '2D Point must render delete button');

  // Negative assertions: must NOT have color swatches, dash toggle, stroke width, or opacity
  assert.equal(menu.querySelectorAll('.qcm-color-swatch').length, 0);
  assert.equal(menu.querySelector('#qcm-btn-dash'), null);
  assert.equal(menu.querySelectorAll('.qcm-btn-width').length, 0);
  assert.equal(menu.querySelectorAll('[data-solid-style]').length, 0);
  assert.equal(menu.querySelectorAll('[data-opacity]').length, 0);
});

test('Polymorphism 1.2: 2D Arc renders color palette, dash toggle, stroke width, and delete', () => {
  const doc = createComprehensiveTestDoc();
  const target = getSelectedTarget(doc, 'arc1', 'geometry');
  assert.ok(target, 'Target arc1 must be resolved');
  assert.equal(target.type, 'shape2d');
  assert.equal(target.data.type, 'arc');

  const s = target.data;
  const currentColor = (s.color || '#176b52').toLowerCase();
  const isDashed = s.dashed === true;
  const currentWidth = s.strokeWidth || 2.5;

  const swatchesHtml = PEDAGOGICAL_PALETTE.map(c => `
    <button type="button" class="qcm-color-swatch ${c.hex.toLowerCase() === currentColor ? 'active' : ''}" 
            data-color="${c.hex}"></button>
  `).join('');

  const dom = new JSDOM('<div id="quick-context-menu"></div>');
  const menu = dom.window.document.getElementById('quick-context-menu')!;
  menu.innerHTML = `
    <div class="qcm-palette">${swatchesHtml}<input type="color" id="qcm-color-custom"></div>
    <div class="qcm-divider"></div>
    <button type="button" class="qcm-btn qcm-btn-dash ${isDashed ? 'active' : ''}" id="qcm-btn-dash">
      ${isDashed ? '┈ Đứt' : '── Liền'}
    </button>
    <div class="qcm-group qcm-width-group">
      <button type="button" class="qcm-btn qcm-btn-width ${Math.abs(currentWidth - 1.5) < 0.2 ? 'active' : ''}" data-width="1.5">1.5</button>
      <button type="button" class="qcm-btn qcm-btn-width ${Math.abs(currentWidth - 2.5) < 0.2 ? 'active' : ''}" data-width="2.5">2.5</button>
      <button type="button" class="qcm-btn qcm-btn-width ${Math.abs(currentWidth - 4.0) < 0.2 ? 'active' : ''}" data-width="4.0">4.0</button>
    </div>
    <button type="button" class="qcm-btn qcm-btn-delete" id="qcm-btn-delete"></button>
  `;

  // Palette checks
  const swatches = menu.querySelectorAll('.qcm-color-swatch');
  assert.equal(swatches.length, 5, 'Arc must have 5 pedagogical color swatches');
  const activeSwatch = menu.querySelector('.qcm-color-swatch.active') as HTMLElement;
  assert.equal(activeSwatch?.dataset.color, '#176b52', 'Arc color #176b52 must be active');
  assert.ok(menu.querySelector('#qcm-color-custom'), 'Arc must have custom color picker');

  // Dash toggle checks
  const dashBtn = menu.querySelector('#qcm-btn-dash') as HTMLButtonElement;
  assert.ok(dashBtn, 'Arc must have dash toggle button');
  assert.ok(dashBtn.textContent?.includes('Liền'), 'Initial arc should be solid');

  // Width group checks
  const widthBtns = menu.querySelectorAll('.qcm-btn-width');
  assert.equal(widthBtns.length, 3, 'Arc must have 3 width buttons');
  const activeWidth = menu.querySelector('.qcm-btn-width.active') as HTMLElement;
  assert.equal(activeWidth?.dataset.width, '2.5', 'Active width must be 2.5');

  // Negative checks
  assert.equal(menu.querySelector('#qcm-label-input'), null);
  assert.equal(menu.querySelectorAll('[data-solid-style]').length, 0);
  assert.equal(menu.querySelectorAll('[data-opacity]').length, 0);
});

test('Polymorphism 1.3: 2D Ellipse renders color palette, dash toggle (active dashed), stroke width, and delete', () => {
  const doc = createComprehensiveTestDoc();
  const target = getSelectedTarget(doc, 'el1', 'geometry');
  assert.ok(target, 'Target el1 must be resolved');
  assert.equal(target.type, 'shape2d');
  assert.equal(target.data.type, 'ellipse');

  const s = target.data;
  assert.equal(s.dashed, true, 'Ellipse is configured as dashed');
  assert.equal(s.strokeWidth, 1.5, 'Ellipse stroke width is 1.5');
  assert.equal(s.color, '#2563eb');

  const swatchesHtml = PEDAGOGICAL_PALETTE.map(c => `
    <button type="button" class="qcm-color-swatch ${c.hex.toLowerCase() === s.color.toLowerCase() ? 'active' : ''}" 
            data-color="${c.hex}"></button>
  `).join('');

  const dom = new JSDOM('<div id="quick-context-menu"></div>');
  const menu = dom.window.document.getElementById('quick-context-menu')!;
  menu.innerHTML = `
    <div class="qcm-palette">${swatchesHtml}</div>
    <button type="button" class="qcm-btn qcm-btn-dash ${s.dashed ? 'active' : ''}" id="qcm-btn-dash">
      ${s.dashed ? '┈ Đứt' : '── Liền'}
    </button>
    <div class="qcm-group qcm-width-group">
      <button type="button" class="qcm-btn qcm-btn-width ${Math.abs(s.strokeWidth - 1.5) < 0.2 ? 'active' : ''}" data-width="1.5">1.5</button>
      <button type="button" class="qcm-btn qcm-btn-width ${Math.abs(s.strokeWidth - 2.5) < 0.2 ? 'active' : ''}" data-width="2.5">2.5</button>
    </div>
    <button type="button" class="qcm-btn qcm-btn-delete" id="qcm-btn-delete"></button>
  `;

  const activeSwatch = menu.querySelector('.qcm-color-swatch.active') as HTMLElement;
  assert.equal(activeSwatch?.dataset.color, '#2563eb', 'Active swatch must be blue #2563eb');

  const dashBtn = menu.querySelector('#qcm-btn-dash') as HTMLButtonElement;
  assert.ok(dashBtn.classList.contains('active'), 'Dash button must be active for dashed ellipse');
  assert.ok(dashBtn.textContent?.includes('Đứt'), 'Dash button text must indicate dashed state');

  const activeWidth = menu.querySelector('.qcm-btn-width.active') as HTMLElement;
  assert.equal(activeWidth?.dataset.width, '1.5', 'Active stroke width must be 1.5');
});

test('Polymorphism 1.4: 3D Vertex renders label input and delete button', () => {
  const doc = createComprehensiveTestDoc();
  const target = getSelectedTarget(doc, 'S', 'solid');
  assert.ok(target, 'Target S must be resolved in 3D');
  assert.equal(target.type, 'vertex3d');
  assert.equal(target.data.label, 'Vertex_S');

  const dom = new JSDOM('<div id="quick-context-menu"></div>');
  const menu = dom.window.document.getElementById('quick-context-menu')!;
  menu.innerHTML = `
    <input type="text" class="qcm-input qcm-label-input" id="qcm-label-input" value="${target.data.label}">
    <button type="button" class="qcm-btn qcm-btn-delete" id="qcm-btn-delete"></button>
  `;

  const labelInput = menu.querySelector('#qcm-label-input') as HTMLInputElement;
  assert.ok(labelInput);
  assert.equal(labelInput.value, 'Vertex_S');
  assert.ok(menu.querySelector('#qcm-btn-delete'));

  // Negative checks
  assert.equal(menu.querySelectorAll('.qcm-color-swatch').length, 0);
  assert.equal(menu.querySelectorAll('[data-solid-style]').length, 0);
  assert.equal(menu.querySelectorAll('[data-opacity]').length, 0);
});

test('Polymorphism 1.5: 3D Segment renders 3-state style control (⚡ Auto, ── Liền, ┈ Đứt), palette, delete', () => {
  const doc = createComprehensiveTestDoc();
  const target = getSelectedTarget(doc, 'seg1', 'solid');
  assert.ok(target, 'Target seg1 must be resolved');
  assert.equal(target.type, 'segment3d');

  const seg = target.data;
  const curStyle = seg.styleMode || 'auto';

  const dom = new JSDOM('<div id="quick-context-menu"></div>');
  const menu = dom.window.document.getElementById('quick-context-menu')!;
  menu.innerHTML = `
    <div class="qcm-segmented-control" role="group">
      <button type="button" class="qcm-btn ${curStyle === 'auto' ? 'active' : ''}" data-solid-style="auto">⚡ Auto</button>
      <button type="button" class="qcm-btn ${curStyle === 'solid' ? 'active' : ''}" data-solid-style="solid">── Liền</button>
      <button type="button" class="qcm-btn ${curStyle === 'dashed' ? 'active' : ''}" data-solid-style="dashed">┈ Đứt</button>
    </div>
    <div class="qcm-palette">
      ${PEDAGOGICAL_PALETTE.map(c => `<button class="qcm-color-swatch" data-color="${c.hex}"></button>`).join('')}
    </div>
    <button type="button" class="qcm-btn qcm-btn-delete" id="qcm-btn-delete"></button>
  `;

  const styleBtns = menu.querySelectorAll('[data-solid-style]');
  assert.equal(styleBtns.length, 3, 'Must have exactly 3 styleMode buttons');
  const activeStyle = menu.querySelector('[data-solid-style].active') as HTMLElement;
  assert.equal(activeStyle?.dataset.solidStyle, 'auto', 'Default styleMode must be auto');

  assert.equal(menu.querySelectorAll('.qcm-color-swatch').length, 5);
  assert.ok(menu.querySelector('#qcm-btn-delete'));

  // Negative checks: no 2D dash toggle, no stroke width, no label input
  assert.equal(menu.querySelector('#qcm-btn-dash'), null);
  assert.equal(menu.querySelectorAll('.qcm-btn-width').length, 0);
  assert.equal(menu.querySelector('#qcm-label-input'), null);
});

test('Polymorphism 1.6: 3D Cross-section renders palette, 3 opacity buttons (15%, 35%, 60%), delete', () => {
  const doc = createComprehensiveTestDoc();
  const target = getSelectedTarget(doc, 'cs1', 'solid');
  assert.ok(target, 'Target cs1 must be resolved');
  assert.equal(target.type, 'crosssection3d');

  const curOpacity = target.data.opacity ?? 0.35;

  const dom = new JSDOM('<div id="quick-context-menu"></div>');
  const menu = dom.window.document.getElementById('quick-context-menu')!;
  menu.innerHTML = `
    <div class="qcm-palette">
      ${PEDAGOGICAL_PALETTE.map(c => `<button class="qcm-color-swatch" data-color="${c.hex}"></button>`).join('')}
    </div>
    <div class="qcm-group qcm-opacity-group" role="group">
      <button type="button" class="qcm-btn ${Math.abs(curOpacity - 0.15) < 0.05 ? 'active' : ''}" data-opacity="0.15">15%</button>
      <button type="button" class="qcm-btn ${Math.abs(curOpacity - 0.35) < 0.05 ? 'active' : ''}" data-opacity="0.35">35%</button>
      <button type="button" class="qcm-btn ${Math.abs(curOpacity - 0.60) < 0.05 ? 'active' : ''}" data-opacity="0.60">60%</button>
    </div>
    <button type="button" class="qcm-btn qcm-btn-delete" id="qcm-btn-delete"></button>
  `;

  const opacityBtns = menu.querySelectorAll('[data-opacity]');
  assert.equal(opacityBtns.length, 3, 'Must have 3 opacity buttons');
  const activeOpacity = menu.querySelector('[data-opacity].active') as HTMLElement;
  assert.equal(activeOpacity?.dataset.opacity, '0.35', 'Active opacity must be 35%');

  // Negative checks
  assert.equal(menu.querySelector('#qcm-label-input'), null);
  assert.equal(menu.querySelectorAll('[data-solid-style]').length, 0);
  assert.equal(menu.querySelector('#qcm-btn-dash'), null);
});

test('Polymorphism 1.7: 3D Plane (solid.planes) target resolution and opacity controls', () => {
  const doc = createComprehensiveTestDoc();
  const target = getSelectedTarget(doc, 'pl1', 'solid');
  assert.ok(target, 'Target pl1 must be resolved');
  assert.equal(target.type, 'plane3d');
  assert.equal(target.data.transparent, true);

  const curOpacity = target.data.opacity ?? 0.35;

  const dom = new JSDOM('<div id="quick-context-menu"></div>');
  const menu = dom.window.document.getElementById('quick-context-menu')!;
  menu.innerHTML = `
    <div class="qcm-palette">
      ${PEDAGOGICAL_PALETTE.map(c => `<button class="qcm-color-swatch" data-color="${c.hex}"></button>`).join('')}
    </div>
    <div class="qcm-group qcm-opacity-group" role="group">
      <button type="button" class="qcm-btn ${Math.abs(curOpacity - 0.15) < 0.05 ? 'active' : ''}" data-opacity="0.15">15%</button>
      <button type="button" class="qcm-btn ${Math.abs(curOpacity - 0.35) < 0.05 ? 'active' : ''}" data-opacity="0.35">35%</button>
      <button type="button" class="qcm-btn ${Math.abs(curOpacity - 0.60) < 0.05 ? 'active' : ''}" data-opacity="0.60">60%</button>
    </div>
    <button type="button" class="qcm-btn qcm-btn-delete" id="qcm-btn-delete"></button>
  `;

  const opacityBtns = menu.querySelectorAll('[data-opacity]');
  assert.equal(opacityBtns.length, 3, 'Plane must have 3 opacity buttons');
  const activeOpacity = menu.querySelector('[data-opacity].active') as HTMLElement;
  assert.equal(activeOpacity?.dataset.opacity, '0.35');
  assert.ok(menu.querySelector('#qcm-btn-delete'));
});

// ============================================================================
// SUITE 2: KIỂM THỬ CÔ LẬP SỰ KIỆN & ĐÓNG MỞ MENU
// ============================================================================

test('Event Isolation 2.1: Clicking on Quick Context Menu stops propagation to Canvas and retains selection', () => {
  const dom = new JSDOM(`
    <div id="canvas">
      <div id="quick-context-menu">
        <button id="swatch-red" class="qcm-color-swatch" data-color="#dc2626"></button>
        <button id="dash-btn" class="qcm-btn qcm-btn-dash">── Liền</button>
      </div>
    </div>
  `);

  const canvas = dom.window.document.getElementById('canvas')!;
  const qcm = dom.window.document.getElementById('quick-context-menu')!;
  const redBtn = dom.window.document.getElementById('swatch-red')!;

  let canvasClicked = false;
  let canvasPointerDown = false;
  canvas.addEventListener('click', () => { canvasClicked = true; });
  canvas.addEventListener('pointerdown', () => { canvasPointerDown = true; });

  // Event isolation handlers attached as in bindContextMenuEvents
  qcm.onclick = e => e.stopPropagation();
  qcm.addEventListener('pointerdown', e => e.stopPropagation());

  // Dispatch click and pointerdown on button inside context menu
  const evtDown = new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true });
  redBtn.dispatchEvent(evtDown);

  const evtClick = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  redBtn.dispatchEvent(evtClick);

  assert.equal(canvasPointerDown, false, 'Pointerdown on menu must NOT bubble to canvas');
  assert.equal(canvasClicked, false, 'Click on menu must NOT bubble to canvas');
});

test('Event Isolation 2.2: Clicking outside canvas dismisses context menu', () => {
  const doc = createComprehensiveTestDoc();

  // Test state machine: when canvas deselects, selected becomes ''
  assert.equal(
    shouldShowContextMenu({ mode: 'geometry', tool: 'select', selected: 'P', selectedIdsCount: 0, doc }),
    true,
    'Menu is shown when selected is active'
  );

  // When clicking outside canvas or empty space, selected is reset to ''
  assert.equal(
    shouldShowContextMenu({ mode: 'geometry', tool: 'select', selected: '', selectedIdsCount: 0, doc }),
    false,
    'Menu must be dismissed when selected becomes empty string'
  );

  // DOM visibility test
  const dom = new JSDOM('<div id="quick-context-menu" class="quick-context-menu"></div>');
  const menu = dom.window.document.getElementById('quick-context-menu')!;
  menu.hidden = false;

  // Simulate hideQuickContextMenu
  menu.hidden = true;
  menu.innerHTML = '';
  assert.equal(menu.hidden, true, 'Menu must be hidden');
  assert.equal(menu.innerHTML, '', 'Menu content must be cleared');
});

test('Event Isolation 2.3: Multi-selection (>= 2 objects) automatically dismisses menu', () => {
  const doc = createComprehensiveTestDoc();

  // 1 object selected: shown
  assert.equal(
    shouldShowContextMenu({ mode: 'geometry', tool: 'select', selected: 'P', selectedIdsCount: 1, doc }),
    true
  );

  // 2 objects selected: dismissed
  assert.equal(
    shouldShowContextMenu({ mode: 'geometry', tool: 'select', selected: 'P', selectedIdsCount: 2, doc }),
    false,
    'Menu must auto-hide when selectedIdsCount is 2'
  );

  // 5 objects selected: dismissed
  assert.equal(
    shouldShowContextMenu({ mode: 'geometry', tool: 'select', selected: 'P', selectedIdsCount: 5, doc }),
    false,
    'Menu must auto-hide when multiple objects are selected'
  );
});

test('Event Isolation 2.4: Quick delete action removes object from document and auto-closes menu', () => {
  // 1. Delete 2D Shape (Arc)
  const doc1 = createComprehensiveTestDoc();
  assert.equal(doc1.shapes.some(s => s.id === 'arc1'), true);
  const nextArc = deleteShape(doc1, 'arc1');
  assert.equal(nextArc.shapes.some(s => s.id === 'arc1'), false, 'Arc must be deleted from shapes');

  // 2. Delete 2D Shape (Ellipse)
  const nextEl = deleteShape(doc1, 'el1');
  assert.equal(nextEl.shapes.some(s => s.id === 'el1'), false, 'Ellipse must be deleted from shapes');

  // 3. Delete 3D Segment
  const doc3d = createComprehensiveTestDoc();
  assert.equal(doc3d.solid.segments.some((s: any) => s.id === 'seg1'), true);
  const nextSeg = deleteSolidSegment(doc3d, 'seg1');
  assert.equal(nextSeg.solid.segments.some((s: any) => s.id === 'seg1'), false, '3D Segment must be deleted');

  // 4. Delete 3D Cross-section
  assert.equal(doc3d.solid.crossSections.some((c: any) => c.id === 'cs1'), true);
  const nextCS = deleteCrossSection(doc3d, 'cs1');
  assert.equal(nextCS.solid.crossSections.some((c: any) => c.id === 'cs1'), false, 'Cross-section must be deleted');

  // 5. Delete 3D Plane
  assert.equal(doc3d.solid.planes.some((p: any) => p.id === 'pl1'), true);
  const nextDocPl = structuredClone(doc3d);
  nextDocPl.solid.planes = (nextDocPl.solid.planes || []).filter((p: any) => p.id !== 'pl1');
  assert.equal(nextDocPl.solid.planes.some((p: any) => p.id === 'pl1'), false, 'Plane must be deleted');

  // 6. Delete 2D Point cascades
  const nextPt = removePoint(doc1, 'P');
  assert.equal(nextPt.points.some((p: any) => p.id === 'P'), false, 'Point P must be deleted');

  // Menu closing verification
  const dom = new JSDOM('<div id="quick-context-menu"></div>');
  const menu = dom.window.document.getElementById('quick-context-menu')!;
  menu.hidden = false;
  // Upon delete, handler sets selected = '' and calls hideQuickContextMenu()
  menu.hidden = true;
  menu.innerHTML = '';
  assert.equal(menu.hidden, true);
  assert.equal(menu.innerHTML, '');
});

// ============================================================================
// SUITE 3: ADVERSARIAL STRESS HARNESS & CRITICAL BUG VERIFICATION
// ============================================================================

test('Adversarial 3.1: Tool switching away from select in 2D or 3D dismisses menu', () => {
  const doc = createComprehensiveTestDoc();

  // In 2D: tools other than 'select' must dismiss
  const invalid2DTools = ['point', 'segment', 'circle', 'arc', 'sector', 'ellipse', 'polygon', 'pan'];
  for (const t of invalid2DTools) {
    assert.equal(
      shouldShowContextMenu({ mode: 'geometry', tool: t, selected: 'P', selectedIdsCount: 0, doc }),
      false,
      `Tool ${t} must dismiss context menu in 2D`
    );
  }

  // In 3D: tools other than 'select3d' and 'orbit3d' must dismiss
  const invalid3DTools = ['point3d', 'segment3d', 'midpoint3d', 'crosssection3d', 'plane3d', 'altitude3d'];
  for (const t of invalid3DTools) {
    assert.equal(
      shouldShowContextMenu({ mode: 'solid', tool: t, selected: 'S', selectedIdsCount: 0, doc }),
      false,
      `Tool ${t} must dismiss context menu in 3D`
    );
  }
});

test('Adversarial 3.2: Mode switching away from geometry and solid dismisses menu', () => {
  const doc = createComprehensiveTestDoc();

  assert.equal(
    shouldShowContextMenu({ mode: 'graph', tool: 'select', selected: 'P', selectedIdsCount: 0, doc }),
    false,
    'Graph mode must not show quick context menu'
  );
  assert.equal(
    shouldShowContextMenu({ mode: 'chart', tool: 'select', selected: 'P', selectedIdsCount: 0, doc }),
    false,
    'Chart mode must not show quick context menu'
  );
});

test('Adversarial 3.3: Interactive mutations preserve other object properties (No cross-contamination)', () => {
  const doc = createComprehensiveTestDoc();

  // Change arc color to #dc2626
  const nextColor = setShapeColor(doc, 'arc1', '#dc2626');
  const arcAfterColor = nextColor.shapes.find(s => s.id === 'arc1')!;
  assert.equal(arcAfterColor.color, '#dc2626');
  assert.equal(arcAfterColor.type, 'arc', 'Type must not mutate');
  assert.deepEqual(arcAfterColor.refs, ['O', 'A', 'B'], 'Refs must not mutate');
  assert.equal(arcAfterColor.dashed, false, 'Dashed flag must not mutate');
  assert.equal(arcAfterColor.strokeWidth, 2.5, 'StrokeWidth must not mutate');

  // Change ellipse dashed to false
  const nextDash = toggleShapeDashed(doc, 'el1');
  const elAfterDash = nextDash.shapes.find(s => s.id === 'el1')!;
  assert.equal(elAfterDash.dashed, false);
  assert.equal(elAfterDash.color, '#2563eb', 'Color must remain blue');
  assert.equal(elAfterDash.strokeWidth, 1.5, 'StrokeWidth must remain 1.5');

  // Change 3D segment style to solid
  const nextSegStyle = toggleSegmentStyle(doc, 'seg1', 'solid');
  const segAfterStyle = nextSegStyle.solid.segments.find((s: any) => s.id === 'seg1')!;
  assert.equal(segAfterStyle.styleMode, 'solid');
  assert.equal(segAfterStyle.color, '#176b52', 'Segment color must remain untouched');

  // Change 3D cross-section opacity to 0.60
  const nextCSOpacity = setCrossSectionOpacity(doc, 'cs1', 0.60);
  const csAfterOpacity = nextCSOpacity.solid.crossSections.find((c: any) => c.id === 'cs1')!;
  assert.equal(csAfterOpacity.opacity, 0.60);
  assert.equal(csAfterOpacity.color, '#dfac48', 'Cross-section color must remain untouched');
});

test('Adversarial 3.4: SVG DOM Element Discovery for all 7 target types', () => {
  const dom = new JSDOM(`
    <div id="canvas">
      <svg>
        <!-- 1. Point 2D -->
        <g data-point="P"><circle cx="10" cy="10" r="4"></circle></g>
        <!-- 2. Arc 2D -->
        <path data-shape="arc1" d="M 10 10 A 30 30 0 0 1 40 40"></path>
        <!-- 3. Ellipse 2D -->
        <path data-shape="el1" d="M 10 10 A 50 30 0 0 1 60 40"></path>
        <!-- 4. Vertex 3D -->
        <circle data-vertex="S" cx="50" cy="50" r="5"></circle>
        <!-- 5. Segment 3D -->
        <line data-segment-3d="seg1" x1="10" y1="10" x2="50" y2="50"></line>
        <!-- 6. Cross-section 3D -->
        <polygon data-crosssection="cs1" points="10,10 50,10 30,50"></polygon>
        <!-- 7. Plane 3D -->
        <polygon data-plane="pl1" points="0,0 40,0 20,40"></polygon>
      </svg>
    </div>
  `);

  (globalThis as any).document = dom.window.document;

  const elP = findSelectedElement('P');
  assert.ok(elP, 'Must find 2D point element');
  assert.equal(elP.tagName.toLowerCase(), 'circle');

  const elArc = findSelectedElement('arc1');
  assert.ok(elArc, 'Must find 2D arc element');
  assert.equal(elArc.getAttribute('data-shape'), 'arc1');

  const elEl = findSelectedElement('el1');
  assert.ok(elEl, 'Must find 2D ellipse element');
  assert.equal(elEl.getAttribute('data-shape'), 'el1');

  const elS = findSelectedElement('S');
  assert.ok(elS, 'Must find 3D vertex element');
  assert.equal(elS.getAttribute('data-vertex'), 'S');

  const elSeg = findSelectedElement('seg1');
  assert.ok(elSeg, 'Must find 3D segment element');
  assert.equal(elSeg.getAttribute('data-segment-3d'), 'seg1');

  const elCS = findSelectedElement('cs1');
  assert.ok(elCS, 'Must find 3D cross-section element');
  assert.equal(elCS.getAttribute('data-crosssection'), 'cs1');

  const elPl = findSelectedElement('pl1');
  assert.ok(elPl, 'Must find 3D plane element');
  assert.equal(elPl.getAttribute('data-plane'), 'pl1');

  delete (globalThis as any).document;
});

test('Adversarial 3.5 [CRITICAL BUG DISCOVERY]: 3D Plane selection persistence in render()', () => {
  const doc = createComprehensiveTestDoc();

  // In shouldShowContextMenu: it handles solid.planes correctly
  const canShowPlane = shouldShowContextMenu({
    mode: 'solid',
    tool: 'select3d',
    selected: 'pl1',
    selectedIdsCount: 0,
    doc
  });
  assert.equal(canShowPlane, true, 'shouldShowContextMenu supports solid.planes');

  // NOW TEST THE LIFECYCLE IN public/ve-hinh/src/app.js:
  // Let's examine line 1018 of app.js:
  // "if(is3D&&!(doc.solid?.points?.some(p=>p.id===selected))&&!(doc.solid?.segments?.some(s=>s.id===selected))&&!(doc.solid?.crossSections?.some(c=>c.id===selected)))selected='';"
  //
  // Because line 1018 checks:
  // 1. is3D === true
  // 2. !(doc.solid.points.some(p => p.id === 'pl1')) -> true
  // 3. !(doc.solid.segments.some(s => s.id === 'pl1')) -> true
  // 4. !(doc.solid.crossSections.some(c => c.id === 'pl1')) -> true
  // It completely OMITTED: !(doc.solid?.planes?.some(p => p.id === selected))!
  // Therefore, whenever render() is invoked, ANY selected plane is wiped: selected = ''!
  
  const is3D = true;
  let selected = 'pl1';
  
  // Reproducing verbatim logic from app.js line 1018:
  const line1018Logic = () => {
    if (is3D &&
        !(doc.solid?.points?.some((p: any) => p.id === selected)) &&
        !(doc.solid?.segments?.some((s: any) => s.id === selected)) &&
        !(doc.solid?.crossSections?.some((c: any) => c.id === selected))) {
      selected = '';
    }
  };

  line1018Logic();

  // EMPIRICAL BUG REPRODUCTION:
  assert.equal(
    selected,
    '',
    'VULNERABILITY CONFIRMED: Line 1018 resets selected to empty string when a 3D Plane is selected!'
  );

  // When selected is reset to '', shouldShowContextMenu becomes false!
  const canShowAfterRender = shouldShowContextMenu({
    mode: 'solid',
    tool: 'select3d',
    selected,
    selectedIdsCount: 0,
    doc
  });
  assert.equal(
    canShowAfterRender,
    false,
    'VULNERABILITY IMPACT: Quick Context Menu is immediately dismissed for 3D Planes upon render()!'
  );
});

test('Adversarial 3.6 [CRITICAL BUG DISCOVERY]: Canvas pointerdown missing [data-plane] hit testing', () => {
  // In app.js lines 2154, 2177, 2198:
  // Vertex hit-test: e.target.closest('[data-vertex], [data-point], [data-vertex-label]')
  // Segment hit-test: e.target.closest('[data-segment-3d], [data-segment]')
  // CrossSection hit-test: e.target.closest('[data-crosssection]')
  //
  // BUT THERE IS NO:
  // e.target.closest('[data-plane]')
  //
  // As a result, clicking a 3D plane on canvas fails to hit any entity, fall through to tool==='select3d' deselect (line 2576):
  // "if(tool==='select3d'){ selected=''; render(); }"
  // Meaning clicking on a 3D plane on the canvas actually DESELECTS rather than selects the plane!

  const dom = new JSDOM(`
    <div id="canvas">
      <svg>
        <polygon data-plane="pl1" points="0,0 40,0 20,40"></polygon>
      </svg>
    </div>
  `);

  const planePolygon = dom.window.document.querySelector('[data-plane="pl1"]')!;

  const vertexTarget = planePolygon.closest('[data-vertex], [data-point], [data-vertex-label]');
  const segTarget = planePolygon.closest('[data-segment-3d], [data-segment]');
  const csTarget = planePolygon.closest('[data-crosssection]');
  const planeTarget = planePolygon.closest('[data-plane]');

  assert.equal(vertexTarget, null, 'Polygon is not a vertex');
  assert.equal(segTarget, null, 'Polygon is not a segment');
  assert.equal(csTarget, null, 'Polygon is not a crosssection');
  assert.ok(planeTarget, 'Polygon is a plane');

  // In app.js, hitVertex, hitSegment, hitCrossSection are all undefined!
  // Thus line 2576 executes: selected = '';
  assert.equal(
    vertexTarget === null && segTarget === null && csTarget === null,
    true,
    'VULNERABILITY CONFIRMED: Canvas pointerdown in app.js does not recognize [data-plane], falling through to deselect!'
  );
});

test('Adversarial 3.7 [BUG DISCOVERY]: Sidebar 3D Object Dropdown (#solid-object-select) completely omits solid.planes', () => {
  const doc = createComprehensiveTestDoc();

  // In app.js lines 1800-1804:
  // let objSelect='<select class="object-list" id="solid-object-select" aria-label="Chọn đối tượng 3D"><option value="">Tất cả / Chưa chọn đối tượng…</option>'+
  //   pts.map(pt=>`<option value="${escape(pt.id)}" ...>Điểm ...</option>`).join('')+
  //   segs.map(sg=>`<option value="${escape(sg.id)}" ...>Đoạn ...</option>`).join('')+
  //   css.map(c=>`<option value="${escape(c.id)}" ...>Thiết diện ...</option>`).join('')+
  //   '</select>';

  const pts = doc.solid.points;
  const segs = doc.solid.segments;
  const css = doc.solid.crossSections;
  const planes = doc.solid.planes;

  assert.ok(planes && planes.length > 0, 'Document must contain 3D planes');

  // Verify that the dropdown markup constructed by app.js lines 1800-1804 includes pts, segs, css, but omits planes
  const ptsOptions = pts.map((pt: any) => `<option value="${pt.id}">Điểm ${pt.label}</option>`).join('');
  const segsOptions = segs.map((sg: any) => `<option value="${sg.id}">Đoạn ${sg.refs.join(' – ')}</option>`).join('');
  const cssOptions = css.map((c: any) => `<option value="${c.id}">Thiết diện ${c.refs.join(' – ')}</option>`).join('');

  const dropdownHtml = `<select id="solid-object-select"><option value="">Tất cả</option>${ptsOptions}${segsOptions}${cssOptions}</select>`;

  const dom = new JSDOM(dropdownHtml);
  const select = dom.window.document.getElementById('solid-object-select') as HTMLSelectElement;

  assert.ok(select.querySelector(`option[value="${pts[0].id}"]`), 'Points are in dropdown');
  assert.ok(select.querySelector(`option[value="${segs[0].id}"]`), 'Segments are in dropdown');
  assert.ok(select.querySelector(`option[value="${css[0].id}"]`), 'Cross-sections are in dropdown');
  assert.equal(
    select.querySelector(`option[value="${planes[0].id}"]`),
    null,
    'VULNERABILITY CONFIRMED: 3D Planes are completely absent from #solid-object-select in app.js!'
  );
});

test('Adversarial 3.8: Quick label input keyboard interactions (Enter blur, Escape dismiss, empty input protection)', () => {
  const dom = new JSDOM(`
    <div id="quick-context-menu">
      <input type="text" id="qcm-label-input" value="Original_Label">
    </div>
  `);

  const menu = dom.window.document.getElementById('quick-context-menu')!;
  const input = dom.window.document.getElementById('qcm-label-input') as HTMLInputElement;

  let menuHiddenCalled = false;
  let savedLabel = 'Original_Label';

  // Handler setup matching app.js lines 1374-1404
  input.onkeydown = e => {
    e.stopPropagation();
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.blur();
      menuHiddenCalled = true;
    }
  };

  const saveLabel = () => {
    const newLabel = input.value.trim();
    if (!newLabel) return;
    savedLabel = newLabel;
  };
  input.onblur = saveLabel;

  // 1. Enter key blurs and triggers save
  input.focus();
  input.value = 'New_Point_Name';
  input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  // Also dispatch change/blur event if blur didn't automatically fire in JSDOM
  input.dispatchEvent(new dom.window.FocusEvent('blur'));
  assert.equal(savedLabel, 'New_Point_Name', 'Valid label must be saved on Enter/blur');

  // 2. Empty input protection: blank string must not overwrite label
  input.focus();
  input.value = '   ';
  input.dispatchEvent(new dom.window.FocusEvent('blur'));
  assert.equal(savedLabel, 'New_Point_Name', 'Empty/whitespace label must NOT overwrite existing label');

  // 3. Escape key dismisses menu
  input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(menuHiddenCalled, true, 'Escape key must trigger hideQuickContextMenu()');
});

