import test from 'node:test';
import assert from 'node:assert/strict';
import {
  angleBetweenLines3D,
  angleLinePlane3D,
  dihedralAngle3D,
  distancePointToPlane3D
} from '../public/ve-hinh/src/math.js';
import {
  create3DPrimitive,
  measureAngle3D,
  measureDistance3D,
  showMeasureHUD
} from '../public/ve-hinh/src/app.js';

test('angleBetweenLines3D calculates spatial angles correctly', () => {
  const p0 = { x: 0, y: 0, z: 0 };
  const px = { x: 1, y: 0, z: 0 };
  const py = { x: 0, y: 1, z: 0 };
  const pz = { x: 0, y: 0, z: 1 };

  // 1. Parallel lines have angle 0
  const l1a = { x: 0, y: 0, z: 0 }, l1b = { x: 2, y: 0, z: 0 };
  const l2a = { x: 0, y: 1, z: 2 }, l2b = { x: 5, y: 1, z: 2 };
  assert.ok(Math.abs(angleBetweenLines3D(l1a, l1b, l2a, l2b)) < 1e-6, 'Parallel lines should have angle 0');

  // 2. Perpendicular lines (x-axis and y-axis) have angle pi/2
  const anglePerp = angleBetweenLines3D(p0, px, p0, py);
  assert.ok(Math.abs(anglePerp - Math.PI / 2) < 1e-6, 'Orthogonal lines should have angle pi/2');

  // 3. Skew perpendicular lines (no intersection)
  const skew1a = { x: 0, y: 0, z: 0 }, skew1b = { x: 1, y: 0, z: 0 };
  const skew2a = { x: 0, y: 1, z: 1 }, skew2b = { x: 0, y: 2, z: 1 };
  const angleSkew = angleBetweenLines3D(skew1a, skew1b, skew2a, skew2b);
  assert.ok(Math.abs(angleSkew - Math.PI / 2) < 1e-6, 'Skew orthogonal lines should have angle pi/2');

  // 4. Cube main diagonals AC' and BD' have angle arccos(1/3)
  const cA = { x: 0, y: 0, z: 0 };
  const cC1 = { x: 1, y: 1, z: 1 };
  const cB = { x: 1, y: 0, z: 0 };
  const cD1 = { x: 0, y: 1, z: 1 };
  const angleDiagonals = angleBetweenLines3D(cA, cC1, cB, cD1);
  const expectedDiagonals = Math.acos(1 / 3);
  assert.ok(Math.abs(angleDiagonals - expectedDiagonals) < 1e-5, 'Cube diagonals angle should be arccos(1/3)');

  // 5. Polymorphic call using arrays
  const angleArrayCall = angleBetweenLines3D([cA, cC1], [cB, cD1]);
  assert.ok(Math.abs(angleArrayCall - expectedDiagonals) < 1e-5, 'Array format call should produce identical angle');

  // 6. Degenerate line error check
  assert.throws(() => angleBetweenLines3D(p0, p0, px, py), /trùng nhau/i);
});

test('angleLinePlane3D calculates line-to-plane angles correctly', () => {
  const oxy1 = { x: 0, y: 0, z: 0 };
  const oxy2 = { x: 1, y: 0, z: 0 };
  const oxy3 = { x: 0, y: 1, z: 0 };

  // 1. Line parallel to plane has angle 0
  const parLineA = { x: 0, y: 0, z: 2 };
  const parLineB = { x: 3, y: 1, z: 2 };
  const anglePar = angleLinePlane3D(parLineA, parLineB, oxy1, oxy2, oxy3);
  assert.ok(Math.abs(anglePar) < 1e-6, 'Line parallel to plane should have angle 0');

  // 2. Line perpendicular to plane has angle pi/2
  const perpLineA = { x: 1, y: 1, z: 0 };
  const perpLineB = { x: 1, y: 1, z: 4 };
  const anglePerp = angleLinePlane3D(perpLineA, perpLineB, oxy1, oxy2, oxy3);
  assert.ok(Math.abs(anglePerp - Math.PI / 2) < 1e-6, 'Line perpendicular to plane should have angle pi/2');

  // 3. Line at 45 degrees to Oxy plane
  const line45A = { x: 0, y: 0, z: 0 };
  const line45B = { x: 1, y: 0, z: 1 };
  const angle45 = angleLinePlane3D(line45A, line45B, oxy1, oxy2, oxy3);
  assert.ok(Math.abs(angle45 - Math.PI / 4) < 1e-6, 'Line (1,0,1) with Oxy should have angle pi/4');

  // 4. Polymorphic format: ([l1, l2], [p1, p2, p3])
  const angleArr = angleLinePlane3D([line45A, line45B], [oxy1, oxy2, oxy3]);
  assert.ok(Math.abs(angleArr - Math.PI / 4) < 1e-6, 'Polymorphic array call should match');

  // 5. Error handling for collinear plane points
  assert.throws(() => angleLinePlane3D(line45A, line45B, oxy1, oxy2, { x: 2, y: 0, z: 0 }), /thẳng hàng|trùng nhau/i);
});

test('dihedralAngle3D calculates angle between two planes correctly', () => {
  const o = { x: 0, y: 0, z: 0 };
  const px = { x: 1, y: 0, z: 0 };
  const py = { x: 0, y: 1, z: 0 };
  const pz = { x: 0, y: 0, z: 1 };

  // 1. Parallel planes have dihedral angle 0
  const pl1 = [o, px, py];
  const pl2 = [{ x: 0, y: 0, z: 3 }, { x: 1, y: 0, z: 3 }, { x: 0, y: 1, z: 3 }];
  assert.ok(Math.abs(dihedralAngle3D(pl1, pl2)) < 1e-6, 'Parallel planes should have angle 0');

  // 2. Perpendicular planes Oxy and Oxz have dihedral angle pi/2
  const oxy = [o, px, py];
  const oxz = [o, px, pz];
  assert.ok(Math.abs(dihedralAngle3D(oxy, oxz) - Math.PI / 2) < 1e-6, 'Oxy and Oxz planes should have angle pi/2');

  // 3. Regular Tetrahedron faces dihedral angle is arccos(1/3)
  const docTetra = create3DPrimitive('regular-tetrahedron');
  const ptsMap = {};
  for (const pt of docTetra.solid.points) {
    ptsMap[pt.id] = pt;
  }
  const basePlane = [ptsMap['A'], ptsMap['B'], ptsMap['C']];
  const sidePlane = [ptsMap['S'], ptsMap['A'], ptsMap['B']];
  const angleTetra = dihedralAngle3D(basePlane, sidePlane);
  const expectedTetra = Math.acos(1 / 3);
  assert.ok(
    Math.abs(angleTetra - expectedTetra) < 1e-5,
    `Tetrahedron dihedral angle should be arccos(1/3) (~70.53°), got ${(angleTetra * 180 / Math.PI).toFixed(2)}°`
  );

  // 4. String IDs with pointsMap
  const angleTetraWithMap = dihedralAngle3D(['A', 'B', 'C'], ['S', 'A', 'B'], ptsMap);
  assert.ok(Math.abs(angleTetraWithMap - expectedTetra) < 1e-5, 'dihedralAngle3D with string IDs should match');
});

test('distancePointToPlane3D calculates distance accurately', () => {
  const o = { x: 0, y: 0, z: 0 };
  const px = { x: 1, y: 0, z: 0 };
  const py = { x: 0, y: 1, z: 0 };

  // 1. Point on plane has distance 0
  assert.ok(distancePointToPlane3D({ x: 3, y: 4, z: 0 }, o, px, py) < 1e-6);

  // 2. Point (2, 3, 5) to Oxy plane has distance 5
  const d5 = distancePointToPlane3D({ x: 2, y: 3, z: 5 }, o, px, py);
  assert.ok(Math.abs(d5 - 5) < 1e-6);

  // 3. Point (0, 0, 0) to plane x + y + z = 1: distance = 1 / sqrt(3)
  const plA = { x: 1, y: 0, z: 0 };
  const plB = { x: 0, y: 1, z: 0 };
  const plC = { x: 0, y: 0, z: 1 };
  const dDiag = distancePointToPlane3D(o, plA, plB, plC);
  assert.ok(Math.abs(dDiag - 1 / Math.sqrt(3)) < 1e-6);

  // 4. Height of regular tetrahedron from apex S to base (A, B, C)
  const docTetra = create3DPrimitive('regular-tetrahedron');
  const ptsMap = {};
  for (const pt of docTetra.solid.points) {
    ptsMap[pt.id] = pt;
  }
  const hTetra = distancePointToPlane3D('S', ['A', 'B', 'C'], ptsMap);
  // Theoretical height: a * sqrt(6) / 3 = 1.8 * sqrt(3) * sqrt(6) / 3 = 1.8 * sqrt(2) ≈ 2.5455844
  const expectedH = 1.8 * Math.sqrt(2);
  assert.ok(Math.abs(hTetra - expectedH) < 1e-5, `Tetrahedron height should be ${expectedH}, got ${hTetra}`);
});

test('app.js measureAngle3D and measureDistance3D integrate smoothly with solid document', () => {
  const docCube = create3DPrimitive('cube');

  // Cube edge AB is along x-axis, BC is along z-axis -> angle should be 90°
  const angleEdge = measureAngle3D(docCube, 'A', 'B', 'B', 'C');
  assert.ok(Math.abs(angleEdge.deg - 90) < 1e-5);
  assert.ok(Math.abs(angleEdge.rad - Math.PI / 2) < 1e-5);

  // Distance between adjacent cube vertices A and B with s = 1.3 -> side length = 2 * 1.3 = 2.6
  const distEdge = measureDistance3D(docCube, 'A', 'B');
  assert.ok(Math.abs(distEdge - 2.6) < 1e-5);

  // Distance from vertex A1 to bottom base plane (A, B, C) -> height = 2.6
  const distPlane = measureDistance3D(docCube, 'A1', 'A', 'B', 'C');
  assert.ok(Math.abs(distPlane - 2.6) < 1e-5);
});

test('showMeasureHUD renders measurement toast into DOM', () => {
  // Setup minimal DOM mock if in Node test environment
  const originalDoc = globalThis.document;
  try {
    const mockElements = new Map();
    const mockDoc = {
      getElementById(id: string) {
        return mockElements.get(id) || null;
      },
      createElement(tag: string) {
        const el = {
          tagName: tag,
          id: '',
          className: '',
          innerHTML: '',
          style: { cssText: '' },
          hidden: false,
          querySelector(sel: string) {
            return {
              addEventListener: () => {}
            };
          }
        };
        return el;
      },
      querySelector() {
        return {
          appendChild(child: any) {
            mockElements.set(child.id, child);
          }
        };
      },
      body: {
        appendChild(child: any) {
          mockElements.set(child.id, child);
        }
      }
    };
    globalThis.document = mockDoc as any;

    showMeasureHUD('Khoảng cách', '2.60', 'Từ đỉnh A1 đến mặt đáy');
    const hud = mockDoc.getElementById('measure-hud-3d');
    assert.ok(hud, 'HUD element should be created in DOM');
    assert.ok(hud.innerHTML.includes('Khoảng cách'), 'HUD should display title');
    assert.ok(hud.innerHTML.includes('2.60'), 'HUD should display measurement value');
    assert.ok(hud.innerHTML.includes('đến mặt đáy'), 'HUD should display detail text');
  } finally {
    globalThis.document = originalDoc;
  }
});
