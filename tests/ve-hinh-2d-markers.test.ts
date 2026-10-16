import test from 'node:test';
import assert from 'node:assert/strict';
import { blankDocument } from '../public/ve-hinh/src/math.js';
import { renderSVG } from '../public/ve-hinh/src/render.js';

test('renderSVG renders arc element correctly with CCW sweep and normalized radius', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'O', x: 0, y: 0 },
    { id: 'A', x: 2, y: 0 }, // angle 0, R = 2
    { id: 'B', x: 0, y: 2 }  // angle 90 deg (CCW span = pi/2 <= pi -> largeArc = 0)
  ];
  doc.shapes = [
    { id: 'arc1', type: 'arc', refs: ['O', 'A', 'B'], color: '#176b52' }
  ];

  const svg = renderSVG(doc, { scale: 55, grid: false });
  assert.ok(!svg.includes('NaN'), 'SVG should not contain NaN');
  // Check for path element with arc command
  // scale 55: O=(500, 330), A=(610, 330), B'=(500, 220), R = 110
  assert.ok(svg.includes('M 610.00 330.00 A 110.00 110.00 0 0 0 500.00 220.00'), 'Should match expected minor arc path');
  assert.ok(svg.includes('data-shape="arc1"'), 'Should contain data-shape attribute');

  // Test major arc (> 180 deg)
  const docMajor = blankDocument();
  docMajor.points = [
    { id: 'O', x: 0, y: 0 },
    { id: 'A', x: 2, y: 0 },
    { id: 'B', x: 0, y: -2 } // angle 270 deg (CCW span = 3pi/2 > pi -> largeArc = 1)
  ];
  docMajor.shapes = [
    { id: 'arcMajor', type: 'arc', refs: ['O', 'A', 'B'] }
  ];
  const svgMajor = renderSVG(docMajor, { scale: 55, grid: false });
  assert.ok(!svgMajor.includes('NaN'), 'Major arc should not contain NaN');
  assert.ok(svgMajor.includes('0 1 0'), 'Should have largeArc=1 and sweep=0');
});

test('renderSVG renders sector with fill, fill-opacity and closed path through center', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'O', x: 0, y: 0 },
    { id: 'A', x: 2, y: 0 },
    { id: 'B', x: 0, y: 2 }
  ];
  doc.shapes = [
    { id: 'sec1', type: 'sector', refs: ['O', 'A', 'B'], color: '#1d4ed8', fill: '#2a9d8f', fillOpacity: 0.35 }
  ];

  const svg = renderSVG(doc, { scale: 55, grid: false });
  assert.ok(!svg.includes('NaN'), 'Sector SVG should not contain NaN');
  // Path starts at O, goes to A, arcs to B, closes with Z
  assert.ok(svg.includes('M 500.00 330.00 L 610.00 330.00 A 110.00 110.00 0 0 0 500.00 220.00 Z'), 'Should contain closed sector path');
  assert.ok(svg.includes('fill:#2a9d8f'), 'Should contain fill style');
  assert.ok(svg.includes('fill-opacity:0.35'), 'Should contain fillOpacity style');
  assert.ok(svg.includes('data-shape="sec1"'), 'Should contain data-shape attribute');
});

test('renderSVG renders ellipse with semi-axes and rotation transform', () => {
  // Horizontal ellipse
  const doc = blankDocument();
  doc.points = [
    { id: 'C', x: 0, y: 0 },
    { id: 'A', x: 3, y: 0 }, // rx = 3
    { id: 'B', x: 0, y: 1.5 } // ry = 1.5
  ];
  doc.shapes = [
    { id: 'ell1', type: 'ellipse', refs: ['C', 'A', 'B'], color: '#dc2626', fill: '#fee2e2', fillOpacity: 0.4 }
  ];

  const svg = renderSVG(doc, { scale: 55, grid: false });
  assert.ok(!svg.includes('NaN'), 'Ellipse SVG should not contain NaN');
  // rx = 3 * 55 = 165, ry = 1.5 * 55 = 82.5, rotation = 0 deg
  assert.ok(svg.includes('<ellipse cx="500.00" cy="330.00" rx="165.00" ry="82.50" transform="rotate(0.00 500.00 330.00)"'), 'Should match ellipse element');
  assert.ok(svg.includes('fill:#fee2e2'), 'Should contain fill color');
  assert.ok(svg.includes('fill-opacity:0.4'), 'Should contain fill opacity');

  // Rotated ellipse (45 deg)
  const docRot = blankDocument();
  docRot.points = [
    { id: 'C', x: 0, y: 0 },
    { id: 'A', x: 2, y: 2 } // direction (2, 2) in math -> on screen (110, -110), angle = -45 deg
  ];
  docRot.shapes = [
    { id: 'ell2', type: 'ellipse', refs: ['C', 'A'], ry: 1 }
  ];
  const svgRot = renderSVG(docRot, { scale: 55, grid: false });
  assert.ok(!svgRot.includes('NaN'), 'Rotated ellipse should not contain NaN');
  assert.ok(svgRot.includes('transform="rotate(-45.00 500.00 330.00)"'), 'Should have -45 deg screen rotation');
});

test('renderSVG renders segment tick markers including triple tick', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 4, y: 0 },
    { id: 'C', x: 0, y: 2 },
    { id: 'D', x: 4, y: 2 },
    { id: 'E', x: 0, y: 4 },
    { id: 'F', x: 4, y: 4 }
  ];
  doc.shapes = [
    { id: 's1', type: 'segment', refs: ['A', 'B'], mark: 'tick', color: '#176b52' },
    { id: 's2', type: 'segment', refs: ['C', 'D'], mark: 'double', color: '#176b52' },
    { id: 's3', type: 'segment', refs: ['E', 'F'], mark: 'triple', color: '#176b52' }
  ];

  const svg = renderSVG(doc, { scale: 55, grid: false });
  assert.ok(!svg.includes('NaN'), 'SVG should not contain NaN');

  // Segment AB midpoint at (500 + 2*55, 330) = (610, 330).
  // Tick for s1: offset 0 -> x = 610, y from 330-7=323 to 330+7=337
  assert.ok(svg.includes('x1="610" y1="323" x2="610" y2="337"') || svg.includes('x1="610" y1="337" x2="610" y2="323"'), 'Single tick at midpoint');

  // Triple tick for s3: midpoint at (610, 330 - 4*55) = (610, 110).
  // Offsets: -6, 0, 6 -> x = 604, 610, 616; y spans from 103 to 117
  assert.ok(svg.includes('x1="604"') && svg.includes('x2="604"') && (svg.includes('y1="103"') || svg.includes('y1="117"')), 'Triple tick offset -6');
  assert.ok(svg.includes('x1="610"') && svg.includes('x2="610"') && (svg.includes('y1="103"') || svg.includes('y1="117"')), 'Triple tick offset 0');
  assert.ok(svg.includes('x1="616"') && svg.includes('x2="616"') && (svg.includes('y1="103"') || svg.includes('y1="117"')), 'Triple tick offset +6');
});

test('renderSVG renders angle markers: right angle square, double concentric arc, single marked arc', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'A', x: 2, y: 0 },
    { id: 'O', x: 0, y: 0 },
    { id: 'B', x: 0, y: 2 },
    { id: 'C', x: 2, y: 2 }
  ];
  doc.shapes = [
    // Right angle at O (A-O-B)
    { id: 'angRight', type: 'angle', refs: ['A', 'O', 'B'], mark: 'right', color: '#d09232' },
    // Double arc at O (A-O-C)
    { id: 'angDouble', type: 'angle', refs: ['A', 'O', 'C'], mark: 'double', color: '#7c3aed' },
    // Single arc with slash at O (C-O-B)
    { id: 'angSingle', type: 'angle', refs: ['C', 'O', 'B'], mark: 'single', color: '#0ea5e9' }
  ];

  const svg = renderSVG(doc, { scale: 55, grid: false });
  assert.ok(!svg.includes('NaN'), 'SVG should not contain NaN');

  // Right angle: square path with side 18px. O is at (500, 330), A is at (610, 330) [dx>0], B is at (500, 220) [dy<0]
  // p1 = (518.00, 330.00), p2 = (518.00, 312.00), p3 = (500.00, 312.00)
  assert.ok(svg.includes('M 518.00 330.00 L 518.00 312.00 L 500.00 312.00'), 'Right angle 18px square marker');

  // Double arc: concentric arcs with r=20 and r=26
  assert.ok(svg.includes('A 20 20 0 0'), 'Double angle inner concentric arc r=20');
  assert.ok(svg.includes('A 26 26 0 0'), 'Double angle outer concentric arc r=26');

  // Single marked arc: arc with r=24 + tick line across bisector
  assert.ok(svg.includes('A 24 24 0 0'), 'Single angle arc r=24');

  // None of the marked angles should display degree text
  assert.ok(!svg.includes('°'), 'Marked angles should suppress numerical degree text');

  // Unmarked non-right angle displays numerical degree text (e.g. 60 deg)
  const docUnmarked = blankDocument();
  docUnmarked.points = [
    { id: 'A', x: 2, y: 0 },
    { id: 'O', x: 0, y: 0 },
    { id: 'B', x: 1, y: 1.73205 } // 60 degrees
  ];
  docUnmarked.shapes = [
    { id: 'angPlain', type: 'angle', refs: ['A', 'O', 'B'], mark: 'none' }
  ];
  const svgPlain = renderSVG(docUnmarked, { scale: 55, grid: false });
  assert.ok(svgPlain.includes('60°'), 'Unmarked 60 degree angle should show degree label');
});

test('renderSVG safely handles degenerate cases without throw or NaN', () => {
  const doc = blankDocument();
  doc.points = [
    { id: 'O', x: 0, y: 0 },
    { id: 'A', x: 0, y: 0 }, // Coinciding with O
    { id: 'B', x: 1, y: 1 }
  ];
  doc.shapes = [
    { id: 'degArc', type: 'arc', refs: ['O', 'A', 'B'] },
    { id: 'degSec', type: 'sector', refs: ['O', 'A', 'B'] },
    { id: 'degEll', type: 'ellipse', refs: ['O', 'A'] },
    { id: 'degAng', type: 'angle', refs: ['O', 'A', 'B'] }
  ];

  assert.doesNotThrow(() => {
    const svg = renderSVG(doc, { scale: 55, grid: false });
    assert.ok(!svg.includes('NaN'), 'Degenerate SVG should not contain NaN');
  });
});
