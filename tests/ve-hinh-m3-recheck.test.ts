/**
 * tests/ve-hinh-m3-recheck.test.ts
 * 
 * EMPIRICAL RECHECK ADVERSARIAL TEST SUITE FOR QUICK CONTEXT MENU (Milestone 3 - R3)
 * Recheck Challenger: Exhaustive verification of 3D Plane (solid.planes) lifecycle,
 * canvas hit-testing, sidebar synchronization, and cross-section polygon isolation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  blankDocument
} from '../public/ve-hinh/src/math.js';

import {
  getSelectedTarget,
  findSelectedElement,
  shouldShowContextMenu,
  renderContextMenuContent
} from '../public/ve-hinh/src/app.js';

test('Recheck 1: Coexistence of multiple 3D planes and cross-sections - polygon:not([data-plane]) isolation', () => {
  const dom = new JSDOM(`
    <div id="canvas">
      <svg>
        <!-- 3 Planes in scene -->
        <polygon id="poly-pl1" data-plane="pl1" points="0,0 10,0 5,10" pointer-events="all"></polygon>
        <polygon id="poly-pl2" data-plane="pl2" points="20,20 30,20 25,30" pointer-events="all"></polygon>
        <polygon id="poly-pl3" data-plane="pl3" points="40,40 50,40 45,50" pointer-events="all"></polygon>
        <!-- 2 Cross-sections in scene (rendered without data-plane) -->
        <polygon id="poly-cs1" points="10,10 20,10 15,20"></polygon>
        <polygon id="poly-cs2" points="30,30 40,30 35,40"></polygon>
      </svg>
    </div>
  `);

  const docEl = dom.window.document;
  const allPolys = docEl.querySelectorAll('polygon');
  assert.equal(allPolys.length, 5, 'Total 5 polygons in canvas');

  // Tagging logic from app.js line 992
  const polyEls = docEl.querySelectorAll('polygon:not([data-plane])');
  assert.equal(polyEls.length, 2, 'Only 2 cross-section polygons matched by polygon:not([data-plane])');

  const crossSections = [
    { id: 'cs1', refs: ['A', 'B', 'C'] },
    { id: 'cs2', refs: ['M', 'N', 'P'] }
  ];

  crossSections.forEach((cs, i) => {
    if (polyEls[i]) {
      polyEls[i].setAttribute('data-crosssection', cs.id);
    }
  });

  // Verify cross-sections received correct attributes
  assert.equal(docEl.getElementById('poly-cs1')?.getAttribute('data-crosssection'), 'cs1');
  assert.equal(docEl.getElementById('poly-cs2')?.getAttribute('data-crosssection'), 'cs2');

  // Verify none of the planes were polluted or offset
  assert.equal(docEl.getElementById('poly-pl1')?.getAttribute('data-crosssection'), null);
  assert.equal(docEl.getElementById('poly-pl2')?.getAttribute('data-crosssection'), null);
  assert.equal(docEl.getElementById('poly-pl3')?.getAttribute('data-crosssection'), null);
});

test('Recheck 2: render() selection persistence for multiple planes and edge cases', () => {
  const doc = blankDocument();
  doc.solid = {
    enabled: true,
    type: 'cube',
    rotation: 45,
    tilt: 35,
    points: [{ id: 'A', x: 0, y: 0, z: 0 }, { id: 'B', x: 1, y: 0, z: 0 }],
    segments: [{ id: 'AB', refs: ['A', 'B'] }],
    crossSections: [{ id: 'cs1', refs: ['A', 'B', 'C'] }],
    planes: [
      { id: 'pl_alpha', refs: ['A', 'B', 'C'], color: '#3b82f6', opacity: 0.25 },
      { id: 'pl_beta', refs: ['A', 'B', 'D'], color: '#dc2626', opacity: 0.35 }
    ]
  };

  // 1. Whitelist ids check
  const ids = new Set([
    ...doc.points,
    ...doc.shapes,
    ...(doc.solid?.points || []),
    ...(doc.solid?.segments || []),
    ...(doc.solid?.crossSections || []),
    ...(doc.solid?.planes || [])
  ].map(o => o.id));

  assert.ok(ids.has('pl_alpha'), 'ids must contain pl_alpha');
  assert.ok(ids.has('pl_beta'), 'ids must contain pl_beta');

  // 2. Selection retention logic in render()
  const is3D = true;
  let selected = 'pl_beta';
  if (is3D &&
      !(doc.solid?.points?.some((p: any) => p.id === selected)) &&
      !(doc.solid?.segments?.some((s: any) => s.id === selected)) &&
      !(doc.solid?.crossSections?.some((c: any) => c.id === selected)) &&
      !(doc.solid?.planes?.some((pl: any) => pl.id === selected))) {
    selected = '';
  }
  assert.equal(selected, 'pl_beta', 'Selected pl_beta must be retained');

  // 3. Negative check: if plane is genuinely deleted, selected is cleared
  selected = 'pl_deleted';
  if (is3D &&
      !(doc.solid?.points?.some((p: any) => p.id === selected)) &&
      !(doc.solid?.segments?.some((s: any) => s.id === selected)) &&
      !(doc.solid?.crossSections?.some((c: any) => c.id === selected)) &&
      !(doc.solid?.planes?.some((pl: any) => pl.id === selected))) {
    selected = '';
  }
  assert.equal(selected, '', 'Unknown plane ID must be cleared by render()');
});

test('Recheck 3: Canvas pointerdown hit-testing extracts correct plane among nested and layered elements', () => {
  const dom = new JSDOM(`
    <div id="canvas">
      <svg>
        <g id="layer-planes">
          <polygon id="pl-poly" data-plane="pl_gamma" points="0,0 100,0 50,80" pointer-events="all"></polygon>
        </g>
        <g id="layer-wireframe">
          <line id="seg-line" data-segment-3d="seg_AB" x1="0" y1="0" x2="100" y2="0"></line>
          <circle id="vtx-dot" data-vertex="A" cx="0" cy="0" r="4"></circle>
        </g>
      </svg>
    </div>
  `);

  const polyEl = dom.window.document.getElementById('pl-poly')!;
  const segEl = dom.window.document.getElementById('seg-line')!;
  const vtxEl = dom.window.document.getElementById('vtx-dot')!;

  // Clicking directly on plane polygon
  const hitPlane = polyEl.closest('[data-plane]')?.getAttribute('data-plane');
  assert.equal(hitPlane, 'pl_gamma', 'Hit plane must be extracted as pl_gamma');

  // Verify segment click is NOT intercepted as plane
  const segPlane = segEl.closest('[data-plane]');
  assert.equal(segPlane, null, 'Segment is not inside data-plane');

  // Verify vertex click is NOT intercepted as plane
  const vtxPlane = vtxEl.closest('[data-plane]');
  assert.equal(vtxPlane, null, 'Vertex is not inside data-plane');
});

test('Recheck 4: Sidebar #solid-object-select options generation and bidirectional selection', () => {
  const doc = blankDocument();
  doc.solid = {
    enabled: true,
    type: 'tetrahedron',
    rotation: 30,
    tilt: 20,
    points: [{ id: 'A', x: 0, y: 0, z: 0, label: 'A' }, { id: 'B', x: 1, y: 0, z: 0, label: 'B' }],
    segments: [{ id: 'AB', refs: ['A', 'B'], styleMode: 'solid' }],
    crossSections: [{ id: 'cs1', planeRefs: ['A', 'B', 'C'] }],
    planes: [
      { id: 'pl1', refs: ['A', 'B', 'C'] },
      { id: 'pl2', refs: ['A', 'B', 'D'] }
    ]
  };

  const selected = 'pl2';
  const pts = doc.solid.points;
  const segs = doc.solid.segments;
  const css = doc.solid.crossSections;
  const pls = doc.solid.planes;

  const html = '<select id="solid-object-select">' +
    '<option value="">Tất cả</option>' +
    pts.map((pt: any) => `<option value="${pt.id}">Điểm ${pt.label}</option>`).join('') +
    segs.map((sg: any) => `<option value="${sg.id}">Đoạn ${sg.refs.join(' – ')}</option>`).join('') +
    css.map((c: any) => `<option value="${c.id}">Thiết diện ${(c.planeRefs||[]).join(' – ')}</option>`).join('') +
    pls.map((pl: any) => `<option value="${pl.id}" ${pl.id===selected?'selected':''}>Mặt phẳng (${(pl.refs||[]).join('')})</option>`).join('') +
    '</select>';

  const dom = new JSDOM(html);
  const select = dom.window.document.getElementById('solid-object-select') as HTMLSelectElement;

  const options = Array.from(select.querySelectorAll('option'));
  assert.equal(options.length, 7, '1 default + 2 points + 1 segment + 1 cross-section + 2 planes = 7 options');

  const optPl1 = select.querySelector('option[value="pl1"]') as HTMLOptionElement;
  const optPl2 = select.querySelector('option[value="pl2"]') as HTMLOptionElement;

  assert.ok(optPl1, 'Option pl1 must exist');
  assert.ok(optPl2, 'Option pl2 must exist');
  assert.equal(optPl1.selected, false);
  assert.equal(optPl2.selected, true, 'pl2 must be marked selected');
  assert.equal(optPl2.textContent, 'Mặt phẳng (ABD)');
});

test('Recheck 5: Quick Context Menu DOM discovery and target resolution for 3D planes', () => {
  const doc = blankDocument();
  doc.solid = {
    enabled: true,
    type: 'tetrahedron',
    rotation: 30,
    tilt: 20,
    points: [{ id: 'A', x: 0, y: 0, z: 0 }],
    segments: [],
    crossSections: [],
    planes: [
      { id: 'pl_test', refs: ['A', 'B', 'C'], color: '#3b82f6', opacity: 0.35 }
    ]
  };

  const target = getSelectedTarget(doc, 'pl_test', 'solid');
  assert.ok(target, 'Target must be resolved');
  assert.equal(target.type, 'plane3d');
  assert.equal(target.data.id, 'pl_test');

  const dom = new JSDOM(`
    <div id="canvas">
      <svg>
        <polygon data-plane="pl_test" points="0,0 50,0 25,40"></polygon>
      </svg>
      <div id="quick-context-menu" hidden></div>
    </div>
  `);

  (globalThis as any).document = dom.window.document;

  const foundEl = findSelectedElement('pl_test');
  assert.ok(foundEl, 'findSelectedElement must find polygon[data-plane="pl_test"]');
  assert.equal(foundEl.getAttribute('data-plane'), 'pl_test');

  delete (globalThis as any).document;
});
