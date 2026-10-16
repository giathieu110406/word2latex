import test from 'node:test';
import assert from 'node:assert/strict';
import { exportTikZ, formatTikZColor, buildTikZOptions } from '../public/ve-hinh/src/tikz.js';
import { exportTikZ3D, getStandardSolidGeometry } from '../public/ve-hinh/src/engine3d/tikz3d.js';
import { exportSVG } from '../public/ve-hinh/src/render.js';

// ============================================================================
// SUITE 1: ĐỐI KHÁNG MÃ MÀU LATEX & TÙY CHỌN FILL OPACITY (TIKZ 2D & 3D)
// ============================================================================

test('CHALLENGER-1.1: 2D TikZ export with Pedagogical Palette has 0 occurrences of "#"', () => {
  const palette = [
    '#176b52', // Xanh ngọc Word2LaTeX
    '#2563eb', // Xanh lam hình học
    '#dc2626', // Đỏ đường phụ
    '#d97706', // Vàng nghệ thiết diện
    '#1f2937'  // Đen in ấn
  ];

  for (const color of palette) {
    const doc = {
      version: 1,
      points: [
        { id: 'A', x: 0, y: 0, label: 'A' },
        { id: 'B', x: 3, y: 0, label: 'B' },
        { id: 'C', x: 1.5, y: 2.5, label: 'C' }
      ],
      shapes: [
        { id: 's_seg', type: 'segment', refs: ['A', 'B'], color, strokeWidth: 1.5, mark: 'triple' },
        { id: 's_line', type: 'line', refs: ['A', 'B'], color },
        { id: 's_ray', type: 'ray', refs: ['A', 'B'], color },
        { id: 's_poly', type: 'polygon', refs: ['A', 'B', 'C'], color, fill: color, fillOpacity: 0.25 },
        { id: 's_vec', type: 'vector', refs: ['A', 'C'], color },
        { id: 's_cir', type: 'circle', refs: ['A', 'B'], color },
        { id: 's_arc', type: 'arc', refs: ['A', 'B', 'C'], color },
        { id: 's_sec', type: 'sector', refs: ['A', 'B', 'C'], color, fill: color, fillOpacity: 0.3 },
        { id: 's_ell', type: 'ellipse', refs: ['A', 'B', 'C'], color, fill: color, fillOpacity: 0.15 },
        { id: 's_ang', type: 'angle', refs: ['B', 'A', 'C'], color, mark: 'double' }
      ]
    };

    const tikz = exportTikZ(doc);

    // BẮT BUỘC: Không còn bất kỳ dấu vết ký tự '#' trong chuỗi lệnh TikZ
    const hashIndex = tikz.indexOf('#');
    assert.equal(hashIndex, -1, `TikZ 2D output still contains '#' for palette color ${color}:\n${tikz.slice(Math.max(0, hashIndex - 20), hashIndex + 40)}`);

    // Kiểm tra định dạng fill opacity cho polygon, sector, ellipse
    assert.ok(tikz.includes('fill opacity=0.25'), 'Polygon must preserve fill opacity=0.25');
    assert.ok(tikz.includes('fill opacity=0.3'), 'Sector must preserve fill opacity=0.3');
    assert.ok(tikz.includes('fill opacity=0.15'), 'Ellipse must preserve fill opacity=0.15');
  }
});

test('CHALLENGER-1.2: 2D TikZ export with short hex (#RGB), full hex (#RRGGBB) and uppercase hex has 0 occurrences of "#"', () => {
  const testHexList = [
    '#f00', '#0f0', '#00f', '#abc', '#123',
    '#FF0000', '#00FF00', '#0000FF', '#3B82F6', '#D97706',
    '#AbC', '#1D4eD8'
  ];

  for (const hex of testHexList) {
    const doc = {
      version: 1,
      points: [
        { id: 'O', x: 0, y: 0 },
        { id: 'P1', x: 2, y: 0 },
        { id: 'P2', x: 0, y: 2 }
      ],
      shapes: [
        { id: 'sec', type: 'sector', refs: ['O', 'P1', 'P2'], fill: hex, fillOpacity: 0.4 },
        { id: 'el', type: 'ellipse', refs: ['O', 'P1'], fill: hex, color: hex }
      ]
    };

    const tikz = exportTikZ(doc);
    assert.equal(tikz.includes('#'), false, `TikZ 2D output must not contain '#' for hex ${hex}`);
    assert.ok(tikz.includes('{rgb,255:red,'), `Hex ${hex} must be converted to xcolor {rgb,255:red,...}`);
  }
});

test('CHALLENGER-1.3: 3D TikZ export with Pedagogical Palette and hex colors has 0 occurrences of "#"', () => {
  const palette = ['#176b52', '#2563eb', '#dc2626', '#d97706', '#1f2937'];

  for (const color of palette) {
    const doc = {
      version: 1,
      mode: 'solid',
      solid: {
        type: 'pyramid',
        rotation: 30,
        tilt: 20,
        points: [
          { id: 'S', x: 0, y: 2, z: 0 },
          { id: 'A', x: -1.5, y: -1, z: -1 },
          { id: 'B', x: 1.5, y: -1, z: -1 },
          { id: 'C', x: 1.5, y: -1, z: 1 }
        ],
        segments: [
          { id: 's1', refs: ['S', 'A'], styleMode: 'dashed', color },
          { id: 's2', refs: ['S', 'B'], styleMode: 'solid', color },
          { id: 's3', refs: ['S', 'C'], styleMode: 'auto', color }
        ],
        planes: [
          { id: 'pl1', refs: ['S', 'A', 'B'], color, opacity: 0.35 }
        ],
        crossSections: [
          { id: 'cs1', refs: ['S', 'B', 'C'], color, opacity: 0.2 }
        ]
      }
    };

    const tikz = exportTikZ3D(doc);
    assert.equal(tikz.includes('#'), false, `TikZ 3D output must not contain '#' for color ${color}`);
    // Kiểm tra fill opacity trên plane và crossSection
    assert.ok(tikz.includes('fill opacity=0.35'), '3D Plane must preserve fill opacity=0.35');
    assert.ok(tikz.includes('fill opacity=0.2'), '3D Cross section must preserve fill opacity=0.2');
  }
});

// ============================================================================
// SUITE 2: ĐỐI KHÁNG CỜ styleMode TRÊN TỪNG CẠNH 3D (SOLID, DASHED, AUTO)
// ============================================================================

test('CHALLENGER-2.1: 3D styleMode override on Pyramid (S, A occluded vs S, C visible)', () => {
  const std = getStandardSolidGeometry('pyramid');

  const checkPyramidEdge = (edgeRefs, styleMode) => {
    const doc = {
      version: 1,
      mode: 'solid',
      solid: {
        type: 'pyramid',
        rotation: 30,
        tilt: 20,
        points: Object.values(std.verts),
        segments: std.edges.map(([a, b]) => {
          if ((a === edgeRefs[0] && b === edgeRefs[1]) || (a === edgeRefs[1] && b === edgeRefs[0])) {
            return { id: `seg_${a}_${b}`, refs: [a, b], styleMode };
          }
          return { id: `seg_${a}_${b}`, refs: [a, b], styleMode: 'auto' };
        })
      }
    };
    const tikz = exportTikZ3D(doc);
    const [u, v] = edgeRefs;
    const isDashed = tikz.includes(`\\draw[dashed] (${u}) -- (${v});`) || tikz.includes(`\\draw[dashed] (${v}) -- (${u});`);
    const isSolid = tikz.includes(`\\draw (${u}) -- (${v});`) || tikz.includes(`\\draw (${v}) -- (${u});`);
    return { isDashed, isSolid, tikz };
  };

  // 1. Cạnh khuất [S, A]:
  // - Khi auto: phải là dashed
  const saAuto = checkPyramidEdge(['S', 'A'], 'auto');
  assert.equal(saAuto.isDashed, true, 'Occluded edge [S, A] must be dashed when styleMode is auto');

  // - Khi override solid: phải là solid (nét liền)
  const saSolid = checkPyramidEdge(['S', 'A'], 'solid');
  assert.equal(saSolid.isSolid, true, 'Occluded edge [S, A] must be solid when styleMode is overridden to solid');
  assert.equal(saSolid.isDashed, false, 'Occluded edge [S, A] must NOT be dashed when styleMode is overridden to solid');

  // - Khi override dashed: phải là dashed
  const saDashed = checkPyramidEdge(['S', 'A'], 'dashed');
  assert.equal(saDashed.isDashed, true, 'Occluded edge [S, A] must be dashed when styleMode is dashed');

  // 2. Cạnh thấy [S, C]:
  // - Khi auto: phải là solid
  const scAuto = checkPyramidEdge(['S', 'C'], 'auto');
  assert.equal(scAuto.isSolid, true, 'Visible edge [S, C] must be solid when styleMode is auto');

  // - Khi override dashed: phải là dashed (nét đứt)
  const scDashed = checkPyramidEdge(['S', 'C'], 'dashed');
  assert.equal(scDashed.isDashed, true, 'Visible edge [S, C] must be dashed when styleMode is overridden to dashed');
  assert.equal(scDashed.isSolid, false, 'Visible edge [S, C] must NOT be solid when styleMode is overridden to dashed');

  // - Khi override solid: phải là solid
  const scSolid = checkPyramidEdge(['S', 'C'], 'solid');
  assert.equal(scSolid.isSolid, true, 'Visible edge [S, C] must be solid when styleMode is solid');
});

test('CHALLENGER-2.2: 3D styleMode override on Cube (A-A1 occluded vs C-C1 visible)', () => {
  const std = getStandardSolidGeometry('cube');

  const checkCubeEdge = (edgeRefs, styleMode) => {
    const doc = {
      version: 1,
      mode: 'solid',
      solid: {
        type: 'cube',
        rotation: 30,
        tilt: 20,
        points: Object.values(std.verts),
        segments: std.edges.map(([a, b]) => {
          if ((a === edgeRefs[0] && b === edgeRefs[1]) || (a === edgeRefs[1] && b === edgeRefs[0])) {
            return { id: `seg_${a}_${b}`, refs: [a, b], styleMode };
          }
          return { id: `seg_${a}_${b}`, refs: [a, b], styleMode: 'auto' };
        })
      }
    };
    const tikz = exportTikZ3D(doc);
    const [u, v] = edgeRefs;
    const isDashed = tikz.includes(`\\draw[dashed] (${u}) -- (${v});`) || tikz.includes(`\\draw[dashed] (${v}) -- (${u});`);
    const isSolid = tikz.includes(`\\draw (${u}) -- (${v});`) || tikz.includes(`\\draw (${v}) -- (${u});`);
    return { isDashed, isSolid };
  };

  // Cạnh sau A-A1 bị khuất: override thành solid
  const aa1Solid = checkCubeEdge(['A', 'A1'], 'solid');
  assert.equal(aa1Solid.isSolid, true, 'Occluded edge [A, A1] must be solid when styleMode=solid');
  assert.equal(aa1Solid.isDashed, false, 'Occluded edge [A, A1] must not be dashed when styleMode=solid');

  // Cạnh trước C-C1 nhìn thấy: override thành dashed
  const cc1Dashed = checkCubeEdge(['C', 'C1'], 'dashed');
  assert.equal(cc1Dashed.isDashed, true, 'Front visible edge [C, C1] must be dashed when styleMode=dashed');
  assert.equal(cc1Dashed.isSolid, false, 'Front visible edge [C, C1] must not be solid when styleMode=dashed');
});

test('CHALLENGER-2.3: 3D styleMode override on Cone and Cylinder internal segments', () => {
  // Trục khối nón S-O
  const docCone = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'cone',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'S', x: 0, y: 2, z: 0 },
        { id: 'O', x: 0, y: -1.2, z: 0 }
      ],
      segments: [
        { id: 'SO', refs: ['S', 'O'], styleMode: 'dashed' }
      ]
    }
  };
  const tikzConeDashed = exportTikZ3D(docCone);
  assert.ok(tikzConeDashed.includes('\\draw[dashed] (S) -- (O);'), 'Cone axis with styleMode=dashed must export as dashed');

  docCone.solid.segments[0].styleMode = 'solid';
  const tikzConeSolid = exportTikZ3D(docCone);
  assert.ok(tikzConeSolid.includes('\\draw (S) -- (O);'), 'Cone axis with styleMode=solid must export as solid');

  // Trục khối trụ O1-O2
  const docCylinder = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'cylinder',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'O1', x: 0, y: 1.3, z: 0 },
        { id: 'O2', x: 0, y: -1.3, z: 0 }
      ],
      segments: [
        { id: 'O1O2', refs: ['O1', 'O2'], styleMode: 'dashed' }
      ]
    }
  };
  const tikzCylDashed = exportTikZ3D(docCylinder);
  assert.ok(tikzCylDashed.includes('\\draw[dashed] (O1) -- (O2);'), 'Cylinder axis with styleMode=dashed must export as dashed');

  docCylinder.solid.segments[0].styleMode = 'solid';
  const tikzCylSolid = exportTikZ3D(docCylinder);
  assert.ok(tikzCylSolid.includes('\\draw (O1) -- (O2);'), 'Cylinder axis with styleMode=solid must export as solid');
});

// ============================================================================
// SUITE 3: ĐỐI KHÁNG VECTOR EXPORT: LOẠI BỎ HOÀN TOÀN WATERMARK TEXT TIÊU ĐỀ
// ============================================================================

test('CHALLENGER-3.1: 3D SVG export for Cone must completely eliminate "Hình nón" watermark text', () => {
  const doc = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'cone',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'S', x: 0, y: 2, z: 0, label: 'S' },
        { id: 'O', x: 0, y: -1.2, z: 0, label: 'O' }
      ],
      segments: [
        { id: 'SO', refs: ['S', 'O'], styleMode: 'dashed' }
      ]
    }
  };

  const svg = exportSVG(doc, 'solid');

  // Kiểm tra không còn watermark tiêu đề "Hình nón"
  assert.equal(svg.includes('Hình nón'), false, 'Exported 3D Cone SVG must NOT contain title watermark text "Hình nón"');
  // Kiểm tra không còn thẻ <text x="30" y="40">
  assert.equal(/<text x="30" y="40"[^>]*>/i.test(svg), false, 'Exported 3D Cone SVG must NOT contain text header at coordinates (30, 40)');
});

test('CHALLENGER-3.2: 3D SVG export for Cylinder must completely eliminate "Hình trụ" watermark text', () => {
  const doc = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'cylinder',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'O1', x: 0, y: 1.3, z: 0, label: 'O1' },
        { id: 'O2', x: 0, y: -1.3, z: 0, label: 'O2' }
      ],
      segments: [
        { id: 'O1O2', refs: ['O1', 'O2'], styleMode: 'dashed' }
      ]
    }
  };

  const svg = exportSVG(doc, 'solid');

  // Kiểm tra không còn watermark tiêu đề "Hình trụ"
  assert.equal(svg.includes('Hình trụ'), false, 'Exported 3D Cylinder SVG must NOT contain title watermark text "Hình trụ"');
  // Kiểm tra không còn thẻ <text x="30" y="40">
  assert.equal(/<text x="30" y="40"[^>]*>/i.test(svg), false, 'Exported 3D Cylinder SVG must NOT contain text header at coordinates (30, 40)');
});

test('CHALLENGER-3.3: 3D SVG export across all 3D solid types must not contain watermark header text at (30, 40)', () => {
  const solidTypes = ['sphere', 'pyramid', 'cube', 'regular-tetrahedron', 'frustum'];

  for (const type of solidTypes) {
    const doc = {
      version: 1,
      mode: 'solid',
      solid: {
        type,
        rotation: 30,
        tilt: 20
      }
    };

    const svg = exportSVG(doc, 'solid');
    assert.equal(/<text x="30" y="40"[^>]*>/i.test(svg), false, `Exported 3D SVG for type "${type}" must NOT contain title header text at (30, 40)`);
  }
});
