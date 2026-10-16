import test from 'node:test';
import assert from 'node:assert/strict';
import { exportTikZ } from '../public/ve-hinh/src/tikz.js';
import { exportTikZ3D } from '../public/ve-hinh/src/engine3d/tikz3d.js';

test('exportTikZ 2D exports Arc correctly with sweep angles and radius', () => {
  const doc = {
    version: 1,
    points: [
      { id: 'O', x: 0, y: 0, label: 'O' },
      { id: 'A', x: 2, y: 0, label: 'A' },
      { id: 'B', x: 0, y: 2, label: 'B' }
    ],
    shapes: [
      { id: 'arc1', type: 'arc', refs: ['O', 'A', 'B'] }
    ]
  };

  const tikz = exportTikZ(doc);
  assert.ok(tikz.includes('\\begin{tikzpicture}'), 'Must begin with tikzpicture');
  assert.ok(tikz.includes('arc (0.0:90.0:2.00)'), 'Must contain valid TikZ arc syntax: ' + tikz);
  assert.ok(tikz.includes('\\end{tikzpicture}'), 'Must end with tikzpicture');
});

test('exportTikZ 2D exports Sector correctly with fill and closed path', () => {
  const doc = {
    version: 1,
    points: [
      { id: 'O', x: 0, y: 0, label: 'O' },
      { id: 'A', x: 3, y: 0, label: 'A' },
      { id: 'B', x: 0, y: 3, label: 'B' }
    ],
    shapes: [
      { id: 'sec1', type: 'sector', refs: ['O', 'A', 'B'], fill: 'teal', fillOpacity: 0.25 }
    ]
  };

  const tikz = exportTikZ(doc);
  assert.ok(tikz.includes('\\fill[fill=teal, fill opacity=0.25] (O) -- ++(0.0:3.00) arc (0.0:90.0:3.00) -- cycle;'), 'Must contain sector fill: ' + tikz);
  assert.ok(tikz.includes('\\draw (O) -- ++(0.0:3.00) arc (0.0:90.0:3.00) -- cycle;'), 'Must contain sector outline: ' + tikz);
});

test('exportTikZ 2D exports Ellipse with rx, ry and rotation', () => {
  const doc = {
    version: 1,
    points: [
      { id: 'O', x: 1, y: 1, label: 'O' },
      { id: 'A', x: 4, y: 1, label: 'A' },
      { id: 'B', x: 1, y: 3, label: 'B' }
    ],
    shapes: [
      { id: 'el1', type: 'ellipse', refs: ['O', 'A', 'B'] }
    ]
  };

  const tikz = exportTikZ(doc);
  assert.ok(tikz.includes('ellipse (3.00 and 2.00);'), 'Must contain ellipse with calculated semi-axes: ' + tikz);
});

test('exportTikZ 2D exports segment tick markers (triple, double, single)', () => {
  const doc = {
    version: 1,
    points: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 4, y: 0, label: 'B' }
    ],
    shapes: [
      { id: 's1', type: 'segment', refs: ['A', 'B'], mark: 'triple' }
    ]
  };

  const tikz = exportTikZ(doc);
  assert.ok(tikz.includes('\\draw (A) -- (B);'), 'Must draw base segment');
  // Must draw 3 ticks
  const tickMatches = tikz.match(/\\draw \(-?[\d.]+, -?[\d.]+\) -- \(-?[\d.]+, -?[\d.]+\);/g) || [];
  assert.ok(tickMatches.length >= 3, 'Must draw at least 3 tick lines for triple mark');
});

test('exportTikZ 2D exports right angle mark correctly', () => {
  const doc = {
    version: 1,
    points: [
      { id: 'A', x: 0, y: 3, label: 'A' },
      { id: 'B', x: 0, y: 0, label: 'B' },
      { id: 'C', x: 4, y: 0, label: 'C' }
    ],
    shapes: [
      { id: 'ang1', type: 'angle', refs: ['A', 'B', 'C'], mark: 'right' }
    ]
  };

  const tikz = exportTikZ(doc);
  assert.ok(tikz.includes('\\draw (0.00, 0.25) -- (0.25, 0.25) -- (0.25, 0.00);'), 'Must contain right angle bracket: ' + tikz);
});

test('exportTikZ3D exports 3D transparent planes (solid.planes)', () => {
  const doc = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'pyramid',
      points: [
        { id: 'S', x: 0, y: 2, z: 0, label: 'S' },
        { id: 'A', x: -1.5, y: -1, z: -1, label: 'A' },
        { id: 'B', x: 1.5, y: -1, z: -1, label: 'B' },
        { id: 'C', x: 1.5, y: -1, z: 1, label: 'C' }
      ],
      segments: [
        { id: 'SA', refs: ['S', 'A'] }
      ],
      planes: [
        { id: 'pSAB', refs: ['S', 'A', 'B'], color: 'teal!30', opacity: 0.3 }
      ]
    }
  };

  const tikz = exportTikZ3D(doc);
  assert.ok(tikz.includes('\\fill[fill=teal!30, fill opacity=0.3] (S) -- (A) -- (B) -- cycle;'), 'Must contain 3D transparent plane fill: ' + tikz);
  assert.ok(tikz.includes('\\draw[dashed, opacity=0.6] (S) -- (A) -- (B) -- cycle;'), 'Must contain plane border');
});

test('exportTikZ3D exports Cone base ellipses and generators', () => {
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
  assert.ok(tikz.includes('\\draw[dashed]'), 'Cone must contain dashed back arc');
  assert.ok(tikz.includes('arc (0:180:'), 'Must contain arc for back half of base ellipse');
  assert.ok(tikz.includes('arc (180:360:'), 'Must contain arc for front half of base ellipse');
});
