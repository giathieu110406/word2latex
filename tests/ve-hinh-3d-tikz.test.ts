import test from 'node:test';
import assert from 'node:assert/strict';
import { exportTikZ, exportTikZ3D } from '../public/ve-hinh/src/tikz.js';
import { exportSVG, solidSVG } from '../public/ve-hinh/src/render.js';
import { validateDocument } from '../public/ve-hinh/src/math.js';

test('exportTikZ3D produces valid LaTeX TikZ code for pyramid S.ABCD and segment AM', () => {
  const doc = {
    version: 1,
    title: 'Chóp S.ABCD có SA vuông góc đáy và M trung điểm SC',
    points: [],
    shapes: [
      { id: 'angleSAB', type: 'angle', mark: 'right', refs: ['S', 'A', 'B'], color: '#d09232' }
    ],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['A'], values: [1] },
    solid: {
      type: 'pyramid',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'A', x: 0, y: -1.5, z: -2.12, label: 'A' },
        { id: 'B', x: 2.12, y: -1.5, z: 0, label: 'B' },
        { id: 'C', x: 0, y: -1.5, z: 2.12, label: 'C' },
        { id: 'D', x: -2.12, y: -1.5, z: 0, label: 'D' },
        { id: 'S', x: 0, y: 2.0, z: -2.12, label: 'S' },
        { id: 'M', kind: 'midpoint', refs: ['S', 'C'], label: 'M' }
      ],
      segments: [
        { id: 'SA', refs: ['S', 'A'], styleMode: 'auto' },
        { id: 'SB', refs: ['S', 'B'], styleMode: 'auto' },
        { id: 'SC', refs: ['S', 'C'], styleMode: 'auto' },
        { id: 'SD', refs: ['S', 'D'], styleMode: 'auto' },
        { id: 'AB', refs: ['A', 'B'], styleMode: 'auto' },
        { id: 'BC', refs: ['B', 'C'], styleMode: 'auto' },
        { id: 'CD', refs: ['C', 'D'], styleMode: 'auto' },
        { id: 'DA', refs: ['D', 'A'], styleMode: 'auto' },
        { id: 'AM', refs: ['A', 'M'], styleMode: 'auto' }
      ],
      crossSections: [
        { id: 'secABM', planeRefs: ['A', 'B', 'M'], color: '#808080', opacity: 0.15 }
      ]
    }
  };

  validateDocument(doc);

  const tikz = exportTikZ3D(doc);

  // 1. Valid LaTeX tikzpicture environment
  assert.ok(tikz.startsWith('\\begin{tikzpicture}[scale=1, line join=round, line cap=round, >=stealth]'), 'Must begin with tikzpicture');
  assert.ok(tikz.endsWith('\\end{tikzpicture}'), 'Must end with \\end{tikzpicture}');

  // 2. Contains all projected coordinate definitions for S, A, B, C, D, M
  for (const id of ['S', 'A', 'B', 'C', 'D', 'M']) {
    assert.ok(
      tikz.includes(`\\coordinate (${id}) at (`),
      `TikZ output must define \\coordinate (${id})`
    );
  }

  // 3. Separation of dashed vs solid segments
  // At theta=30, phi=20: SA, AB, DA, AM are dashed
  assert.ok(tikz.includes('\\draw[dashed]'), 'Must contain \\draw[dashed] commands');
  assert.ok(tikz.includes('(S) -- (A)') || tikz.includes('(A) -- (S)'), 'Must draw segment SA');
  assert.ok(tikz.includes('(A) -- (M)') || tikz.includes('(M) -- (A)'), 'Must draw segment AM');

  // Verify SA and AM are in dashed group:
  const dashedSection = tikz.substring(tikz.indexOf('\\draw[dashed]'), tikz.indexOf('\\draw ('));
  assert.ok(dashedSection.includes('(A) -- (M)') || dashedSection.includes('(M) -- (A)'), 'AM must be in dashed section');
  assert.ok(dashedSection.includes('(S) -- (A)') || dashedSection.includes('(A) -- (S)'), 'SA must be in dashed section');

  // Solid lines for front edges (SB, SC, SD, BC, CD)
  assert.ok(tikz.includes('(S) -- (B)') || tikz.includes('(B) -- (S)'), 'SB must be drawn');
  assert.ok(tikz.includes('(B) -- (C)') || tikz.includes('(C) -- (B)'), 'BC must be drawn');

  // 4. Smart label placement: S should NOT be placed 'below right'
  assert.ok(
    !tikz.includes('(\\fill (S) circle (1.2pt) node[below right] {$S$};)'),
    'Label S must not use naive below right anchor'
  );
  assert.ok(
    tikz.includes('node[above] {$S$};') ||
    tikz.includes('node[above right] {$S$};') ||
    tikz.includes('node[above left] {$S$};'),
    'Apex S should have an above-based direction'
  );

  // 5. Does not require tikz-3dplot package
  assert.ok(!tikz.includes('tikz-3dplot'), 'Must NOT depend on external tikz-3dplot package');
  assert.ok(!tikz.includes('tdplot_set_main_coords'), 'Must NOT use tdplot_set_main_coords');

  // 6. Spatial right angle symbol
  assert.ok(
    tikz.includes('\\draw ($ (A)!8pt!(S) $) -- ($ (A)!8pt!(S) + (A)!8pt!(B) - (A) $) -- ($ (A)!8pt!(B) $);') ||
    tikz.includes('\\draw[dashed] ($ (A)!8pt!(S) $) -- ($ (A)!8pt!(S) + (A)!8pt!(B) - (A) $) -- ($ (A)!8pt!(B) $);'),
    'Must include spatial right angle marker'
  );

  // 7. Cross section fill
  assert.ok(
    tikz.includes('\\fill[fill=gray, fill opacity=0.15] (A) -- (B) -- (M) -- cycle;'),
    'Must include cross section fill'
  );
});

test('exportTikZ auto-detects 3D document and dispatches to exportTikZ3D', () => {
  const doc3D = {
    version: 1,
    title: '3D Document Auto Detection',
    points: [],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['A'], values: [1] },
    solid: {
      type: 'pyramid',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'S', x: 0, y: 2, z: -2 },
        { id: 'A', x: 0, y: -1.5, z: -2 }
      ],
      segments: [
        { id: 's1', refs: ['S', 'A'] }
      ]
    }
  };

  const code = exportTikZ(doc3D);
  assert.ok(code.includes('\\coordinate (S) at ('), 'exportTikZ must output 3D coordinates');
  assert.ok(code.includes('\\coordinate (A) at ('), 'exportTikZ must output 3D coordinates');
});

test('exportTikZ preserves 2D document export when not in 3D mode', () => {
  const doc2D = {
    version: 1,
    title: 'Tam giác ABC 2D',
    points: [
      { id: 'A', x: -2, y: -1, label: 'A' },
      { id: 'B', x: 2, y: -1, label: 'B' },
      { id: 'C', x: 0, y: 2, label: 'C' }
    ],
    shapes: [
      { id: 'tri', type: 'polygon', refs: ['A', 'B', 'C'] }
    ],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['A'], values: [1] },
    solid: { enabled: false, type: 'pyramid', rotation: 30, tilt: 20 }
  };

  const code = exportTikZ(doc2D);
  assert.ok(code.includes('\\coordinate (A) at (-2.00, -1.00);'), '2D coordinate export');
  assert.ok(code.includes('\\draw (A) -- (B) -- (C) -- cycle;'), '2D polygon export');
});

test('exportSVG in solid mode renders 3D entities with stroke-dasharray="8 7" for occluded segments', () => {
  const doc = {
    version: 1,
    title: '3D SVG Export',
    points: [],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['A'], values: [1] },
    solid: {
      type: 'pyramid',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'A', x: 0, y: -1.5, z: -2.12, label: 'A' },
        { id: 'B', x: 2.12, y: -1.5, z: 0, label: 'B' },
        { id: 'C', x: 0, y: -1.5, z: 2.12, label: 'C' },
        { id: 'D', x: -2.12, y: -1.5, z: 0, label: 'D' },
        { id: 'S', x: 0, y: 2.0, z: -2.12, label: 'S' },
        { id: 'M', kind: 'midpoint', refs: ['S', 'C'], label: 'M' }
      ],
      segments: [
        { id: 'SA', refs: ['S', 'A'], styleMode: 'auto' },
        { id: 'BC', refs: ['B', 'C'], styleMode: 'auto' },
        { id: 'AM', refs: ['A', 'M'], styleMode: 'auto' }
      ],
      crossSections: [
        { id: 'sec1', planeRefs: ['A', 'B', 'M'], color: '#176b52', opacity: 0.2 }
      ]
    }
  };

  validateDocument(doc);

  // 1. Test solidSVG directly
  const svg = solidSVG(doc.solid);
  assert.ok(svg.includes('stroke-dasharray="8 7"'), 'solidSVG must render stroke-dasharray="8 7" for occluded edges');
  assert.ok(svg.includes('data-vertex="A"'), 'solidSVG must render vertex A');
  assert.ok(svg.includes('data-vertex="S"'), 'solidSVG must render vertex S');
  assert.ok(svg.includes('data-vertex="M"'), 'solidSVG must render vertex M');
  assert.ok(svg.includes('<polygon points='), 'solidSVG must render crossSection polygon');

  // 2. Test exportSVG in 'solid' mode
  const cleanSVG = exportSVG(doc, 'solid');
  assert.ok(cleanSVG.includes('stroke-dasharray="8 7"'), 'exportSVG in solid mode must have dashed lines');
  assert.ok(!cleanSVG.includes('fill="url(#dots)"'), 'exportSVG must not contain background dots pattern');
});
