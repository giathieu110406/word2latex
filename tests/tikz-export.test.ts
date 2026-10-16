import test from 'node:test';
import assert from 'node:assert/strict';
import { exportTikZ, formatTikZColor, buildTikZOptions } from '../public/ve-hinh/src/tikz.js';
import { exportTikZ3D, getStandardSolidGeometry } from '../public/ve-hinh/src/engine3d/tikz3d.js';
import { exportSVG } from '../public/ve-hinh/src/render.js';

// ==========================================
// 1. UNIT TESTS: TIKZ COLOR & OPTIONS HELPER
// ==========================================

test('formatTikZColor converts hex codes to {rgb,255:...} and preserves named colors', () => {
  assert.equal(formatTikZColor('#1d4ed8'), '{rgb,255:red,29;green,78;blue,216}');
  assert.equal(formatTikZColor('#ff0000'), '{rgb,255:red,255;green,0;blue,0}');
  assert.equal(formatTikZColor('#3b82f6'), '{rgb,255:red,59;green,130;blue,246}');
  assert.equal(formatTikZColor('#abc'), '{rgb,255:red,170;green,187;blue,204}');
  assert.equal(formatTikZColor('teal'), 'teal');
  assert.equal(formatTikZColor('blue'), 'blue');
  assert.equal(formatTikZColor('black'), 'black');
  assert.equal(formatTikZColor('teal!30'), 'teal!30');
  assert.equal(formatTikZColor('blue!50'), 'blue!50');
  assert.equal(formatTikZColor(null), null);
  assert.equal(formatTikZColor(''), null);
});

test('buildTikZOptions constructs correct option string for dashed, color, and strokeWidth', () => {
  assert.equal(buildTikZOptions({ dashed: true }), '[dashed]');
  assert.equal(buildTikZOptions({ color: 'blue' }), '[draw=blue]');
  assert.equal(buildTikZOptions({ color: '#ff0000' }), '[draw={rgb,255:red,255;green,0;blue,0}]');
  assert.equal(buildTikZOptions({ strokeWidth: 1.5 }), '[thin]');
  assert.equal(buildTikZOptions({ strokeWidth: 2.5 }), ''); // default stroke width
  assert.equal(buildTikZOptions({ strokeWidth: 4.0 }), '[ultra thick]');
  assert.equal(buildTikZOptions({ strokeWidth: 2.0 }), '[line width=2.0pt]');
  assert.equal(buildTikZOptions({ dashed: true, color: 'red', strokeWidth: 1.5 }), '[dashed, draw=red, thin]');
});

// ==========================================
// 2. 2D TIKZ EXPORT SUITE
// ==========================================

test('exportTikZ 2D converts hex color and strokeWidth in segments and tick marks', () => {
  const doc = {
    version: 1,
    points: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 4, y: 0, label: 'B' }
    ],
    shapes: [
      { id: 's1', type: 'segment', refs: ['A', 'B'], color: '#1d4ed8', strokeWidth: 1.5, mark: 'triple' }
    ]
  };

  const tikz = exportTikZ(doc);
  assert.ok(tikz.includes('\\draw[draw={rgb,255:red,29;green,78;blue,216}, thin] (A) -- (B);'), 'Segment must use rgb color and thin width');
  // Tick lines inherit options
  const tickMatches = tikz.match(/\\draw\[draw=\{rgb,255:red,29;green,78;blue,216\}, thin\]/g) || [];
  assert.ok(tickMatches.length >= 4, 'Base segment + 3 ticks must all have custom style options');
});

test('exportTikZ 2D exports Arc with minor angle and converts full circle arc to circle', () => {
  // Case A: Partial arc
  const docPartial = {
    version: 1,
    points: [
      { id: 'O', x: 0, y: 0, label: 'O' },
      { id: 'A', x: 2, y: 0, label: 'A' },
      { id: 'B', x: 0, y: 2, label: 'B' }
    ],
    shapes: [
      { id: 'arc1', type: 'arc', refs: ['O', 'A', 'B'], color: 'blue' }
    ]
  };
  const tikzPartial = exportTikZ(docPartial);
  assert.ok(tikzPartial.includes('\\draw[draw=blue] (O) ++(0.0:2.00) arc (0.0:90.0:2.00);'), 'Partial arc must export correct arc path');

  // Case B: Full circle arc (a1 == a2)
  const docFull = {
    version: 1,
    points: [
      { id: 'O', x: 0, y: 0, label: 'O' },
      { id: 'A', x: 2, y: 0, label: 'A' },
      { id: 'B', x: 2, y: 0, label: 'B' }
    ],
    shapes: [
      { id: 'arcFull', type: 'arc', refs: ['O', 'A', 'B'], dashed: true }
    ]
  };
  const tikzFull = exportTikZ(docFull);
  assert.ok(tikzFull.includes('\\draw[dashed] (O) circle (2.00);'), '360 degree arc must convert to circle command');
});

test('exportTikZ 2D exports Sector with formatTikZColor fill, fill opacity and closed cycle', () => {
  const doc = {
    version: 1,
    points: [
      { id: 'O', x: 0, y: 0, label: 'O' },
      { id: 'A', x: 3, y: 0, label: 'A' },
      { id: 'B', x: 0, y: 3, label: 'B' }
    ],
    shapes: [
      { id: 'sec1', type: 'sector', refs: ['O', 'A', 'B'], fill: '#3b82f6', fillOpacity: 0.35, color: 'blue' }
    ]
  };

  const tikz = exportTikZ(doc);
  assert.ok(tikz.includes('\\fill[fill={rgb,255:red,59;green,130;blue,246}, fill opacity=0.35] (O) -- ++(0.0:3.00) arc (0.0:90.0:3.00) -- cycle;'), 'Sector must use formatted RGB fill');
  assert.ok(tikz.includes('\\draw[draw=blue] (O) -- ++(0.0:3.00) arc (0.0:90.0:3.00) -- cycle;'), 'Sector border must use draw=blue');
});

test('exportTikZ 2D exports Ellipse with rotate around center and formatted fill', () => {
  const doc = {
    version: 1,
    points: [
      { id: 'C', x: 2, y: 3, label: 'C' },
      { id: 'A', x: 5, y: 6, label: 'A' } // 45 degree tilt
    ],
    shapes: [
      { id: 'el1', type: 'ellipse', refs: ['C', 'A'], ry: 1.5, fill: '#ff0000', fillOpacity: 0.2 }
    ]
  };

  const tikz = exportTikZ(doc);
  assert.ok(tikz.includes('rotate around={45.0:(C)}'), 'Must rotate around ellipse center C, not (0,0)');
  assert.ok(tikz.includes('\\fill[rotate around={45.0:(C)}, fill={rgb,255:red,255;green,0;blue,0}, fill opacity=0.2] (C) ellipse'), 'Fill must include rotate around and rgb fill');
  assert.ok(tikz.includes('\\draw[rotate around={45.0:(C)}] (C) ellipse'), 'Draw must include rotate around');
});

test('exportTikZ 2D exports angle marks (single, double, triple, right) without reflex arc on inverted order', () => {
  // Triangle ABC with vertex B at origin. Ray BA at 40 deg, ray BC at 10 deg (inverted order: a2 < a1)
  const cos40 = Math.cos(40 * Math.PI / 180), sin40 = Math.sin(40 * Math.PI / 180);
  const cos10 = Math.cos(10 * Math.PI / 180), sin10 = Math.sin(10 * Math.PI / 180);
  const doc = {
    version: 1,
    points: [
      { id: 'A', x: 2 * cos40, y: 2 * sin40, label: 'A' },
      { id: 'B', x: 0, y: 0, label: 'B' },
      { id: 'C', x: 2 * cos10, y: 2 * sin10, label: 'C' }
    ],
    shapes: [
      { id: 'ang1', type: 'angle', refs: ['A', 'B', 'C'], mark: 'single', color: 'red' },
      { id: 'ang2', type: 'angle', refs: ['A', 'B', 'C'], mark: 'double', dashed: true },
      { id: 'ang3', type: 'angle', refs: ['A', 'B', 'C'], mark: 'triple' }
    ]
  };

  const tikz = exportTikZ(doc);
  // Interior angle is 30 degrees (from 10.0 to 40.0), NOT 330 degrees (from 40.0 to 370.0)
  assert.ok(tikz.includes('arc (10.0:40.0:0.35)'), 'Single mark must sweep minor interior angle (10 to 40 deg): ' + tikz);
  assert.ok(tikz.includes('arc (10.0:40.0:0.30)'), 'Double mark inner must sweep minor interior angle');
  assert.ok(tikz.includes('arc (10.0:40.0:0.38)'), 'Double mark outer must sweep minor interior angle');
  assert.ok(tikz.includes('arc (10.0:40.0:0.26)'), 'Triple mark must sweep minor interior angle');
  assert.ok(tikz.includes('\\draw[draw=red] (B) ++(10.0:0.35)'), 'Angle mark must inherit draw=red');
});

test('exportTikZ 2D respects point labelVisible: false', () => {
  const doc = {
    version: 1,
    points: [
      { id: 'A', x: 0, y: 0, label: 'A', labelVisible: true },
      { id: 'B', x: 2, y: 0, label: 'B', labelVisible: false }
    ],
    shapes: []
  };

  const tikz = exportTikZ(doc);
  assert.ok(tikz.includes('\\fill (A) circle (1.5pt) node[below right] {$A$};'), 'Visible label must have node');
  assert.ok(tikz.includes('\\fill (B) circle (1.5pt);\n'), 'Hidden label must NOT have node: ' + tikz);
});

// ==========================================
// 3. 3D TIKZ EXPORT SUITE
// ==========================================

test('exportTikZ3D Cone exports contour generators and perimeter-based ellipse arcs', () => {
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

  const tikz = exportTikZ3D(doc);

  // 1. Must contain 2 contour generators from apex S to base extreme edges
  assert.ok(tikz.includes('\\draw (0.00, 1.88) -- (-1.80, -1.13);'), 'Must have left contour generator: ' + tikz);
  assert.ok(tikz.includes('\\draw (0.00, 1.88) -- (1.80, -1.13);'), 'Must have right contour generator: ' + tikz);

  // 2. Base ellipse arcs must start at circumference edge, NOT at center O
  // Back dashed arc starts at (Ox + rx, Oy) = (1.80, -1.13)
  assert.ok(tikz.includes('\\draw[dashed] (1.80, -1.13) arc (0:180:1.80 and 0.62);'), 'Back dashed arc must start at perimeter (1.80, -1.13): ' + tikz);
  // Front solid arc starts at (Ox - rx, Oy) = (-1.80, -1.13)
  assert.ok(tikz.includes('\\draw (-1.80, -1.13) arc (180:360:1.80 and 0.62);'), 'Front solid arc must start at perimeter (-1.80, -1.13): ' + tikz);
});

test('exportTikZ3D Cylinder exports 2 contour generators and perimeter-based base arcs', () => {
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

  const tikz = exportTikZ3D(doc);

  // 1. Must contain 2 contour generators connecting top and bottom base ellipses
  assert.ok(tikz.includes('--'), 'Must draw contour lines');
  assert.ok(tikz.includes('(-1.50, 1.22) -- (-1.50, -1.22);'), 'Left generator connecting (-rx, y1) to (-rx, y2): ' + tikz);
  assert.ok(tikz.includes('(1.50, 1.22) -- (1.50, -1.22);'), 'Right generator connecting (rx, y1) to (rx, y2): ' + tikz);

  // 2. Top base is full ellipse
  assert.ok(tikz.includes('\\draw (0.00, 1.22) ellipse (1.50 and 0.51);'), 'Top base must be full ellipse');

  // 3. Bottom base uses correct arc start points
  assert.ok(tikz.includes('\\draw[dashed] (1.50, -1.22) arc (0:180:1.50 and 0.51);'), 'Bottom dashed back arc must start at circumference (1.50, -1.22)');
  assert.ok(tikz.includes('\\draw (-1.50, -1.22) arc (180:360:1.50 and 0.51);'), 'Bottom solid front arc must start at circumference (-1.50, -1.22)');
});

test('exportTikZ3D Sphere exports silhouette circle and perimeter-based equator', () => {
  const doc = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'sphere',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'O', x: 0, y: 0, z: 0, label: 'O' }
      ]
    }
  };

  const tikz = exportTikZ3D(doc);
  assert.ok(tikz.includes('\\draw (0.00, 0.00) circle (1.80);'), 'Must draw outer silhouette circle');
  assert.ok(tikz.includes('\\draw[dashed] (1.80, 0.00) arc (0:180:1.80 and 0.62);'), 'Equator dashed arc must start at (1.80, 0.00)');
  assert.ok(tikz.includes('\\draw (-1.80, 0.00) arc (180:360:1.80 and 0.62);'), 'Equator solid arc must start at (-1.80, 0.00)');
});

test('exportTikZ3D regular-tetrahedron and frustum correctly detect occluded dashed edges', () => {
  // Test Regular Tetrahedron
  const docTetra = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'regular-tetrahedron',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'A', x: 2, y: -1.2, z: 0 },
        { id: 'B', x: -1, y: -1.2, z: 1.732 },
        { id: 'C', x: -1, y: -1.2, z: -1.732 },
        { id: 'S', x: 0, y: 1.8, z: 0 }
      ],
      segments: [
        { id: 'AB', refs: ['A', 'B'], styleMode: 'auto' },
        { id: 'BC', refs: ['B', 'C'], styleMode: 'auto' },
        { id: 'CA', refs: ['C', 'A'], styleMode: 'auto' },
        { id: 'SA', refs: ['S', 'A'], styleMode: 'auto' },
        { id: 'SB', refs: ['S', 'B'], styleMode: 'auto' },
        { id: 'SC', refs: ['S', 'C'], styleMode: 'auto' }
      ]
    }
  };

  const tikzTetra = exportTikZ3D(docTetra);
  assert.ok(tikzTetra.includes('\\draw[dashed]'), 'Regular tetrahedron must have dashed hidden edge: ' + tikzTetra);

  // Test Frustum
  const docFrustum = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'frustum',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'A', x: -1.8, y: -1.3, z: -1.2 },
        { id: 'B', x: 1.8, y: -1.3, z: -1.2 },
        { id: 'C', x: 1.8, y: -1.3, z: 1.2 },
        { id: 'D', x: -1.8, y: -1.3, z: 1.2 },
        { id: 'A1', x: -0.9, y: 1.2, z: -0.6 },
        { id: 'B1', x: 0.9, y: 1.2, z: -0.6 },
        { id: 'C1', x: 0.9, y: 1.2, z: 0.6 },
        { id: 'D1', x: -0.9, y: 1.2, z: 0.6 }
      ],
      segments: [
        { id: 'AB', refs: ['A', 'B'], styleMode: 'auto' },
        { id: 'BC', refs: ['B', 'C'], styleMode: 'auto' },
        { id: 'CD', refs: ['C', 'D'], styleMode: 'auto' },
        { id: 'DA', refs: ['D', 'A'], styleMode: 'auto' },
        { id: 'BB1', refs: ['B', 'B1'], styleMode: 'auto' }
      ]
    }
  };

  const tikzFrustum = exportTikZ3D(docFrustum);
  assert.ok(tikzFrustum.includes('\\draw[dashed]'), 'Frustum must have dashed occluded back edges: ' + tikzFrustum);
  assert.ok(tikzFrustum.includes('\\draw (C) -- (D);') || tikzFrustum.includes('\\draw (D) -- (A);'), 'Frustum must have visible front edges');
});

test('exportTikZ3D transparent planes convert hex colors and ignore virtual curved planes', () => {
  const doc = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'cone',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'S', x: 0, y: 2, z: 0 },
        { id: 'O', x: 0, y: -1.2, z: 0 },
        { id: 'A', x: -1.8, y: -1.2, z: 0 },
        { id: 'B', x: 1.8, y: -1.2, z: 0 },
        { id: 'P', x: 0, y: 0.5, z: 1 }
      ],
      planes: [
        { id: 'base', refs: ['A', 'B', 'O'], color: '#176b52' }, // virtual bottom plane -> must be skipped
        { id: 'secPAB', refs: ['P', 'A', 'B'], color: '#ef4444', opacity: 0.4 } // user-created plane -> must be kept
      ]
    }
  };

  const tikz = exportTikZ3D(doc);
  assert.ok(!tikz.includes('(A) -- (B) -- (O) -- cycle;'), 'Virtual bottom plane on cone must be skipped');
  assert.ok(tikz.includes('\\fill[fill={rgb,255:red,239;green,68;blue,68}, fill opacity=0.4] (P) -- (A) -- (B) -- cycle;'), 'User plane must use RGB color {rgb,255:red,239;green,68;blue,68}');
});

test('exportTikZ3D respects custom segment styleMode (solid, dashed, auto) and custom colors', () => {
  const doc = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'pyramid',
      points: [
        { id: 'S', x: 0, y: 2, z: 0 },
        { id: 'A', x: -1.5, y: -1, z: -1 },
        { id: 'B', x: 1.5, y: -1, z: -1 }
      ],
      segments: [
        { id: 's1', refs: ['S', 'A'], styleMode: 'dashed', color: '#ff0000', strokeWidth: 1.5 },
        { id: 's2', refs: ['S', 'B'], styleMode: 'solid', color: 'blue' }
      ]
    }
  };

  const tikz = exportTikZ3D(doc);
  assert.ok(tikz.includes('\\draw[dashed, draw={rgb,255:red,255;green,0;blue,0}, thin] (S) -- (A);'), 'Dashed segment must respect styleMode and color/width');
  assert.ok(tikz.includes('\\draw[draw=blue] (S) -- (B);'), 'Solid segment must respect styleMode: solid and color');
});

// ==========================================
// 4. VECTOR EXPORT CLEANUP SUITE
// ==========================================

test('exportSVG strips background rect and dots pattern in both geometry and solid modes', () => {
  const doc2D = {
    version: 1,
    points: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 2, y: 0 }],
    shapes: [{ id: 's1', type: 'segment', refs: ['A', 'B'] }]
  };
  const svg2D = exportSVG(doc2D, 'geometry');
  assert.ok(!svg2D.includes('fill="#ffffff"'), '2D SVG must not have white background rect');
  assert.ok(!svg2D.includes('fill="url(#dots)"'), '2D SVG must not have dots pattern');
  assert.ok(!svg2D.includes('quick-context-menu'), '2D SVG must not contain quick context menu');

  const doc3D = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'cone',
      points: [{ id: 'S', x: 0, y: 2, z: 0 }, { id: 'O', x: 0, y: -1.2, z: 0 }]
    }
  };
  const svg3D = exportSVG(doc3D, 'solid');
  assert.ok(!svg3D.includes('fill="url(#dots)"'), '3D SVG must not have dots pattern');
  assert.ok(!svg3D.includes('quick-context-menu'), '3D SVG must not contain quick context menu');
});
