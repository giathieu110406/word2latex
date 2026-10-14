import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rotateEuler,
  project3D,
  screen3D,
  cavalierProject
} from '../public/ve-hinh/src/engine3d/projection.js';
import {
  pointInPolygon2D,
  computeSignedArea2D,
  evaluateFaceVisibility,
  evaluatePolyhedronEdges,
  evaluateSegmentOcclusion,
  resolveSegmentDashed,
  orientPolyhedronFaces,
  edgeKey
} from '../public/ve-hinh/src/engine3d/occlusion.js';

test('Euler rotation matrix: basic axis rotations', () => {
  const pX = { x: 1, y: 0, z: 0 };
  const pY = { x: 0, y: 1, z: 0 };
  const pZ = { x: 0, y: 0, z: 1 };

  // Yaw (rotation around Y-axis) by 90 degrees
  // x' = x*cos(90) + z*sin(90) = 0 + 1*1 = 1
  // z' = -x*sin(90) + z*cos(90) = -1 + 0 = -1
  const rY90 = rotateEuler(pX, { rotation: 90, tilt: 0 });
  assert.equal(Math.abs(rY90.x - 0) < 1e-6, true);
  assert.equal(Math.abs(rY90.y - 0) < 1e-6, true);
  assert.equal(Math.abs(rY90.z - (-1)) < 1e-6, true);

  // Pitch (tilt around X-axis) by 90 degrees
  // y' = y*cos(90) - z*sin(90) = 1*0 - 0 = 0
  // z' = y*sin(90) + z*cos(90) = 1*1 + 0 = 1
  const rX90 = rotateEuler(pY, { rotation: 0, tilt: 90 });
  assert.equal(Math.abs(rX90.x - 0) < 1e-6, true);
  assert.equal(Math.abs(rX90.y - 0) < 1e-6, true);
  assert.equal(Math.abs(rX90.z - 1) < 1e-6, true);
});

test('Euler rotation matrix: length preservation across theta in [-180, 180] and phi in [-80, 80]', () => {
  const testPoints = [
    { x: 2, y: 3, z: 4 },
    { x: -1.5, y: 2.5, z: -3.5 },
    { x: 0, y: -4, z: 1 }
  ];

  const thetas = [-180, -150, -90, -45, 0, 30, 45, 90, 135, 180];
  const phis = [-80, -60, -30, -20, 0, 20, 45, 60, 80];

  for (const p of testPoints) {
    const origLen = Math.hypot(p.x, p.y, p.z);
    for (const theta of thetas) {
      for (const phi of phis) {
        const rot = rotateEuler(p, { rotation: theta, tilt: phi });
        const rotLen = Math.hypot(rot.x, rot.y, rot.z);
        assert.equal(
          Math.abs(origLen - rotLen) < 1e-5,
          true,
          `Length not preserved at theta=${theta}, phi=${phi}: ${origLen} vs ${rotLen}`
        );
      }
    }
  }
});

test('Orthographic vs Perspective projection', () => {
  const p = { x: 2, y: 3, z: 5 };

  // Orthographic: u=x, v=y, depth=z
  const ortho = project3D(p, { rotation: 0, tilt: 0, projection: 'orthographic' });
  assert.equal(ortho.u, 2);
  assert.equal(ortho.v, 3);
  assert.equal(ortho.depth, 5);

  // Perspective: with dist=10, factor = 10 / (10 + 5) = 10/15 = 2/3
  const persp = project3D(p, { rotation: 0, tilt: 0, projection: 'perspective', dist: 10 });
  assert.equal(Math.abs(persp.u - (2 * 10 / 15)) < 1e-6, true);
  assert.equal(Math.abs(persp.v - (3 * 10 / 15)) < 1e-6, true);
  assert.equal(persp.depth, 5);
});

test('screen3D maps camera coordinates to SVG canvas coordinates', () => {
  // Origin (0, 0, 0) maps to center (500, 330)
  const center = screen3D({ x: 0, y: 0, z: 0 });
  assert.equal(center.x, 500);
  assert.equal(center.y, 330);

  // Point (1, 1, 0) with scale=85:
  // x_svg = 500 + 1 * 85 = 585
  // y_svg = 330 - 1 * 85 = 245
  const s = screen3D({ x: 1, y: 1, z: 0 }, { scale: 85 });
  assert.equal(s.x, 585);
  assert.equal(s.y, 245);
});

test('cavalierProject performs 45-degree oblique projection', () => {
  const p = { x: 2, y: 3, z: 2 };
  const cav = cavalierProject(p, { angle: 45, ratio: 0.5 });
  // u = x - 0.5 * z * cos(45) = 2 - 0.5 * 2 * sqrt(2)/2 = 2 - sqrt(2)/2
  const expectedU = 2 - 0.5 * Math.SQRT2;
  const expectedV = 3 - 0.5 * Math.SQRT2;
  assert.equal(Math.abs(cav.u - expectedU) < 1e-6, true);
  assert.equal(Math.abs(cav.v - expectedV) < 1e-6, true);
});

test('Occlusion Engine: Point-in-polygon 2D and signed area', () => {
  const tri = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 2, y: 4 }
  ];

  // Signed area is positive for CCW triangle
  const area = computeSignedArea2D(tri);
  assert.equal(area, 8);

  // Point inside
  assert.equal(pointInPolygon2D({ x: 2, y: 1 }, tri), true);
  assert.equal(pointInPolygon2D({ x: 2, y: 2 }, tri), true);

  // Point outside
  assert.equal(pointInPolygon2D({ x: 5, y: 1 }, tri), false);
  assert.equal(pointInPolygon2D({ x: 2, y: -1 }, tri), false);
  assert.equal(pointInPolygon2D({ x: 2, y: 5 }, tri), false);
});

test('Occlusion Engine: Pyramid S.ABCD with SA perpendicular to base and M midpoint of SC', () => {
  // Standard pyramid geometry with square base ABCD in horizontal plane y = -1.5
  // S directly above A: SA is vertical altitude (SA perpendicular to base)
  const A = { id: 'A', x: 0, y: -1.5, z: -2.12 };
  const B = { id: 'B', x: 2.12, y: -1.5, z: 0 };
  const C = { id: 'C', x: 0, y: -1.5, z: 2.12 };
  const D = { id: 'D', x: -2.12, y: -1.5, z: 0 };
  const S = { id: 'S', x: 0, y: 2.0, z: -2.12 };

  // M is midpoint of SC
  const M = {
    id: 'M',
    x: (S.x + C.x) / 2, // 0
    y: (S.y + C.y) / 2, // 0.25
    z: (S.z + C.z) / 2  // 0
  };

  const points = { A, B, C, D, S, M };

  const rawFaces = [
    { name: 'base', verts: [A, B, C, D] },
    { name: 'SAB', verts: [S, A, B] },
    { name: 'SBC', verts: [S, B, C] },
    { name: 'SCD', verts: [S, C, D] },
    { name: 'SDA', verts: [S, D, A] }
  ];

  const orientedFaces = orientPolyhedronFaces(rawFaces, points);

  // Case 1: Standard perspective angle (rotation = 30, tilt = 20)
  // Vertex A is at the back-left corner
  // Edges SA, AB, AD should be DASHED (hidden)
  // Segment AM passes through the interior and is occluded by front face SCD -> DASHED
  // Outer visible edges BC, CD, SB, SC, SD should be SOLID
  const cameraNormal = { rotation: 30, tilt: 20 };
  const occNormal = evaluatePolyhedronEdges(orientedFaces, cameraNormal);

  // Polyhedral edges connected to A:
  const isSA_Solid_30 = occNormal.edgeVisibility.get(edgeKey('S', 'A'));
  const isAB_Solid_30 = occNormal.edgeVisibility.get(edgeKey('A', 'B'));
  const isAD_Solid_30 = occNormal.edgeVisibility.get(edgeKey('A', 'D'));

  assert.equal(isSA_Solid_30, false, 'Edge SA must be dashed at theta=30, phi=20');
  assert.equal(isAB_Solid_30, false, 'Edge AB must be dashed at theta=30, phi=20');
  assert.equal(isAD_Solid_30, false, 'Edge AD must be dashed at theta=30, phi=20');

  // Outer edges should be solid
  assert.equal(occNormal.edgeVisibility.get(edgeKey('B', 'C')), true, 'Edge BC must be solid at theta=30');
  assert.equal(occNormal.edgeVisibility.get(edgeKey('C', 'D')), true, 'Edge CD must be solid at theta=30');
  assert.equal(occNormal.edgeVisibility.get(edgeKey('S', 'C')), true, 'Edge SC must be solid at theta=30');

  // Free / internal segment AM: Raycast occlusion test
  const isAM_Occluded_30 = evaluateSegmentOcclusion(A, M, orientedFaces, cameraNormal);
  assert.equal(isAM_Occluded_30, true, 'Internal segment AM must be occluded (dashed) at theta=30, phi=20');

  // Case 2: Opposite angle (rotation = -150, tilt = 20)
  // The pyramid is viewed from the opposite side, bringing vertex A to the front!
  // Edges SA, AB, AD connected to A change state and become front visible edges (SOLID)
  const cameraOpposite = { rotation: -150, tilt: 20 };
  const occOpposite = evaluatePolyhedronEdges(orientedFaces, cameraOpposite);

  const isSA_Solid_150 = occOpposite.edgeVisibility.get(edgeKey('S', 'A'));
  const isAB_Solid_150 = occOpposite.edgeVisibility.get(edgeKey('A', 'B'));
  const isAD_Solid_150 = occOpposite.edgeVisibility.get(edgeKey('A', 'D'));

  assert.equal(isSA_Solid_150, true, 'Edge SA must flip to solid at theta=-150, phi=20');
  assert.equal(isAB_Solid_150, true, 'Edge AB must flip to solid at theta=-150, phi=20');
  assert.equal(isAD_Solid_150, true, 'Edge AD must flip to solid at theta=-150, phi=20');

  // Internal segment AM auto vs manual override:
  // Under auto mode, AM remains inside the polyhedron
  const isAM_Occluded_150 = evaluateSegmentOcclusion(A, M, orientedFaces, cameraOpposite);
  // Manual override: when AM.styleMode is set to 'solid', resolveSegmentDashed returns false (solid) at both angles
  const segAM_Solid = { id: 'AM', refs: ['A', 'M'], styleMode: 'solid' as const };
  assert.equal(resolveSegmentDashed(segAM_Solid, isAM_Occluded_30), false, 'AM with styleMode=solid must be solid at theta=30');
  assert.equal(resolveSegmentDashed(segAM_Solid, isAM_Occluded_150), false, 'AM with styleMode=solid must be solid at theta=-150');
});

test('Manual override: styleMode solid/dashed overrides auto occlusion calculation', () => {
  const segAuto = { id: 'AM1', refs: ['A', 'M'], styleMode: 'auto' as const };
  const segSolid = { id: 'AM2', refs: ['A', 'M'], styleMode: 'solid' as const };
  const segDashed = { id: 'AM3', refs: ['A', 'M'], styleMode: 'dashed' as const };

  // When segment is occluded by geometry (isOccluded = true):
  assert.equal(resolveSegmentDashed(segAuto, true), true, 'Auto style with occluded=true must be dashed');
  assert.equal(resolveSegmentDashed(segSolid, true), false, 'Manual solid must remain solid even when occluded');
  assert.equal(resolveSegmentDashed(segDashed, true), true, 'Manual dashed must remain dashed');

  // When segment is NOT occluded by geometry (isOccluded = false):
  assert.equal(resolveSegmentDashed(segAuto, false), false, 'Auto style with occluded=false must be solid');
  assert.equal(resolveSegmentDashed(segSolid, false), false, 'Manual solid must remain solid');
  assert.equal(resolveSegmentDashed(segDashed, false), true, 'Manual dashed must remain dashed even when visible');
});
