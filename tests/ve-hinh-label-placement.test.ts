import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLabelPlacement, distToSegment, renderSVG, solidSVG } from '../public/ve-hinh/src/render.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

test('distToSegment calculates correct perpendicular distance', () => {
  // Point (5, 5) to segment from (0, 0) to (10, 0)
  const d = distToSegment(5, 5, 0, 0, 10, 0);
  assert.equal(Math.round(d), 5);
  // Point outside segment endpoint: (15, 0)
  const d2 = distToSegment(15, 0, 0, 0, 10, 0);
  assert.equal(Math.round(d2), 5);
});

test('computeLabelPlacement places corner vertex away from incident edges', () => {
  // Point A at (100, 100), incident edges go right to B (200, 100) and down to C (100, 200)
  const p = { x: 100, y: 100 };
  const neighbors = [{ x: 200, y: 100 }, { x: 100, y: 200 }];
  const segments = [
    { a: { x: 100, y: 100 }, b: { x: 200, y: 100 } },
    { a: { x: 100, y: 100 }, b: { x: 100, y: 200 } }
  ];
  const placement = computeLabelPlacement(p, neighbors, segments, [], [], 'A');

  // Should NOT point into the quadrant x > 100, y > 100
  // Rather, it should point up-left (x < 100, y < 100)
  assert.ok(placement.x < 100, `Expected label x (${placement.x}) to be to the left of 100`);
  assert.ok(placement.y < 100, `Expected label y (${placement.y}) to be above 100`);

  // Clearance from both segments must be >= 10px
  const distAB = distToSegment(placement.centerX, placement.centerY, 100, 100, 200, 100);
  const distAC = distToSegment(placement.centerX, placement.centerY, 100, 100, 100, 200);
  assert.ok(distAB >= 10, `Label too close to AB: ${distAB}`);
  assert.ok(distAC >= 10, `Label too close to AC: ${distAC}`);
});

test('computeLabelPlacement avoids circle perimeter for vertices on circle', () => {
  // Circle at (500, 330) with r = 100
  // Point C on top of circle at (500, 230)
  const circle = { center: { x: 500, y: 330 }, r: 100 };
  const p = { x: 500, y: 230 };
  const placement = computeLabelPlacement(p, [], [], [circle], [], 'C');

  // Distance from label center to circle circumference should be >= 10px
  const distToCircle = Math.abs(Math.hypot(placement.centerX - circle.center.x, placement.centerY - circle.center.y) - circle.r);
  assert.ok(distToCircle >= 10, `Label overlaps circle arc: dist = ${distToCircle}`);
});

test('solidSVG does not draw leader lines and places vertex labels close to vertices', () => {
  const solidDoc = { enabled: true, type: 'cube', rotation: 30, tilt: 20 };
  const svg = solidSVG(solidDoc);

  // Leader lines with stroke="#8bada0" and stroke-width=".8" should NOT exist
  assert.ok(!svg.includes('stroke-width=".8"'), 'solidSVG should not contain leader lines for vertices');
  // Should contain data-vertex-label attributes
  assert.ok(svg.includes('data-vertex-label="0"'), 'solidSVG should render vertex labels');
});

test('index.html layout adheres to UI cleanup requirements', () => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(join(currentDir, '../public/ve-hinh/index.html'), 'utf-8');

  // Task 2: No Save JSON button in main UI
  assert.ok(!html.includes('id="save"'), 'index.html should not have id="save" button');
  // Task 2: No save-state text
  assert.ok(!html.includes('id="save-state"'), 'index.html should not have id="save-state"');
  // Task 2: No footer
  assert.ok(!html.includes('<footer>'), 'index.html should not have footer element');
  assert.ok(!html.includes('Vẽ Hình · Toán THCS / THPT'), 'index.html should not have footer text');

  // Task 3: AI panel is collapsed by default (no open attribute on ai-panel)
  assert.ok(html.includes('<details class="panel ai-panel">'), 'ai-panel details element should not have open attribute');
});
