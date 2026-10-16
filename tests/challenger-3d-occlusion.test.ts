import test from 'node:test';
import assert from 'node:assert/strict';
import {
  angleBetweenLines3D,
  angleLinePlane3D,
  dihedralAngle3D,
  distancePointToPlane3D,
  norm3D,
  sub,
  add,
  cross3D,
  dot,
  validateDocument
} from '../public/ve-hinh/src/math.js';
import {
  compute3DOcclusion,
  resolveSegmentDashed,
  evaluateSegmentOcclusion,
  pointInPolygon2D
} from '../public/ve-hinh/src/engine3d/occlusion.js';
import { solidSVG } from '../public/ve-hinh/src/render.js';
import {
  create3DPrimitive,
  createPlane3D,
  toggleSegmentStyle,
  apply3DOrbit,
  measureAngle3D,
  measureDistance3D
} from '../public/ve-hinh/src/app.js';

test('CHALLENGER 1.1: angleBetweenLines3D under degenerate and extreme spatial scenarios', () => {
  // 1. Parallel lines with arbitrary 3D direction vectors: angle must be 0
  const dir1 = { x: 3.5, y: -2.1, z: 4.8 };
  const pA = { x: 10, y: 20, z: -5 };
  const pB = add(pA, dir1);
  const pC = { x: -100, y: 50, z: 75 };
  const pD = add(pC, { x: dir1.x * 3.2, y: dir1.y * 3.2, z: dir1.z * 3.2 });
  const anglePar = angleBetweenLines3D(pA, pB, pC, pD);
  assert.ok(Math.abs(anglePar) < 1e-6, `Parallel lines angle must be 0, got ${anglePar}`);

  // 2. Anti-parallel lines (opposite direction vectors): angle must still be 0 (THPT acute/zero angle convention)
  const pE = { x: 0, y: 0, z: 0 };
  const pF = add(pE, { x: -dir1.x * 2.5, y: -dir1.y * 2.5, z: -dir1.z * 2.5 });
  const angleAntiPar = angleBetweenLines3D(pA, pB, pE, pF);
  assert.ok(Math.abs(angleAntiPar) < 1e-6, `Anti-parallel lines angle must be 0, got ${angleAntiPar}`);

  // 3. Perpendicular intersecting lines
  const o = { x: 1, y: 2, z: 3 };
  const uX = { x: 4, y: 2, z: 3 }; // direction (3, 0, 0)
  const uY = { x: 1, y: 7, z: 3 }; // direction (0, 5, 0)
  const anglePerpInter = angleBetweenLines3D(o, uX, o, uY);
  assert.ok(Math.abs(anglePerpInter - Math.PI / 2) < 1e-6, `Perpendicular intersecting lines must be pi/2, got ${anglePerpInter}`);

  // 4. Perpendicular non-intersecting / skew lines (chéo nhau và vuông góc)
  // Line 1 in plane z = 0 with direction (1, 1, 0)
  const s1a = { x: 0, y: 0, z: 0 };
  const s1b = { x: 2, y: 2, z: 0 };
  // Line 2 in plane z = 10 with direction (-1, 1, 0) -> dot product = -1*1 + 1*1 + 0 = 0
  const s2a = { x: 5, y: 1, z: 10 };
  const s2b = { x: 4, y: 2, z: 10 };
  const angleSkewPerp = angleBetweenLines3D(s1a, s1b, s2a, s2b);
  assert.ok(Math.abs(angleSkewPerp - Math.PI / 2) < 1e-6, `Skew perpendicular lines must be pi/2, got ${angleSkewPerp}`);

  // 5. Skew non-perpendicular lines (chéo nhau với góc xác định)
  // Line 1 along x-axis at z = 0: direction (1, 0, 0)
  // Line 2 at z = 5 with direction (1, 1, 1): cos(theta) = |1*1| / (1 * sqrt(3)) = 1/sqrt(3)
  const skewA1 = { x: 0, y: 0, z: 0 }, skewB1 = { x: 4, y: 0, z: 0 };
  const skewA2 = { x: 0, y: 3, z: 5 }, skewB2 = { x: 2, y: 5, z: 7 };
  const angleSkew = angleBetweenLines3D(skewA1, skewB1, skewA2, skewB2);
  const expectedSkew = Math.acos(1 / Math.sqrt(3));
  assert.ok(Math.abs(angleSkew - expectedSkew) < 1e-6, `Skew lines angle must be arccos(1/sqrt(3)), got ${angleSkew}`);

  // 6. Degenerate line error checks
  assert.throws(() => angleBetweenLines3D(pA, pA, pC, pD), /trùng nhau/i);
  assert.throws(() => angleBetweenLines3D(pA, pB, pC, pC), /trùng nhau/i);
  assert.throws(() => angleBetweenLines3D(null as any, pB, pC, pD), /Thiếu điểm/i);
});

test('CHALLENGER 1.2: angleLinePlane3D under degenerate, in-plane and perpendicular conditions', () => {
  const plO = { x: 0, y: 0, z: 0 };
  const plX = { x: 1, y: 0, z: 0 };
  const plY = { x: 0, y: 1, z: 0 };
  // Plane Oxy has normal (0, 0, 1)

  // 1. Line parallel to plane (distance z = 4): phi = 0
  const parA = { x: 2, y: 3, z: 4 };
  const parB = { x: 7, y: 8, z: 4 };
  const anglePar = angleLinePlane3D(parA, parB, plO, plX, plY);
  assert.ok(Math.abs(anglePar) < 1e-6, `Line parallel to plane must have angle 0, got ${anglePar}`);

  // 2. Line lying IN the plane (nằm trong mặt phẳng z = 0): phi = 0
  const inPlaneA = { x: 1, y: 2, z: 0 };
  const inPlaneB = { x: 6, y: -4, z: 0 };
  const angleInPlane = angleLinePlane3D(inPlaneA, inPlaneB, plO, plX, plY);
  assert.ok(Math.abs(angleInPlane) < 1e-6, `Line lying in plane must have angle 0, got ${angleInPlane}`);

  // 3. Line perpendicular to plane (along z axis): phi = pi/2
  const perpA = { x: 3, y: 4, z: -5 };
  const perpB = { x: 3, y: 4, z: 15 };
  const anglePerp = angleLinePlane3D(perpA, perpB, plO, plX, plY);
  assert.ok(Math.abs(anglePerp - Math.PI / 2) < 1e-6, `Line perpendicular to plane must have angle pi/2, got ${anglePerp}`);

  // 4. Line inclined at 30 degrees to plane
  // Direction u = (sqrt(3), 0, 1): |u| = 2. Normal n = (0, 0, 1). sin(phi) = 1/2 -> phi = pi/6
  const l30A = { x: 0, y: 0, z: 0 };
  const l30B = { x: Math.sqrt(3), y: 0, z: 1 };
  const angle30 = angleLinePlane3D(l30A, l30B, plO, plX, plY);
  assert.ok(Math.abs(angle30 - Math.PI / 6) < 1e-6, `Line at 30 deg must have angle pi/6, got ${angle30}`);

  // 5. Line pointing downward into plane: u = (1, 0, -1) -> sin(phi) = |-1|/sqrt(2) -> pi/4
  const lDownA = { x: 0, y: 0, z: 10 };
  const lDownB = { x: 5, y: 0, z: 5 };
  const angleDown = angleLinePlane3D(lDownA, lDownB, plO, plX, plY);
  assert.ok(Math.abs(angleDown - Math.PI / 4) < 1e-6, `Downward line must still yield acute angle pi/4, got ${angleDown}`);

  // 6. Collinear plane points error check
  assert.throws(() => angleLinePlane3D(perpA, perpB, plO, plX, { x: 5, y: 0, z: 0 }), /thẳng hàng|trùng nhau/i);
});

test('CHALLENGER 1.3: dihedralAngle3D between planes (parallel, orthogonal, regular tetrahedron)', () => {
  const o = { x: 0, y: 0, z: 0 };
  const px = { x: 2, y: 0, z: 0 };
  const py = { x: 0, y: 3, z: 0 };
  const pz = { x: 0, y: 0, z: 4 };

  // 1. Parallel planes at different z heights: angle = 0
  const oxyPlane1 = [o, px, py];
  const oxyPlane2 = [{ x: 5, y: 5, z: 8 }, { x: 7, y: 5, z: 8 }, { x: 5, y: 9, z: 8 }];
  const anglePar = dihedralAngle3D(oxyPlane1, oxyPlane2);
  assert.ok(Math.abs(anglePar) < 1e-6, `Parallel planes dihedral angle must be 0, got ${anglePar}`);

  // 2. Coincident planes: angle = 0
  const oxyCoincident = [{ x: -2, y: 1, z: 0 }, { x: 4, y: 4, z: 0 }, { x: 1, y: -3, z: 0 }];
  const angleCoin = dihedralAngle3D(oxyPlane1, oxyCoincident);
  assert.ok(Math.abs(angleCoin) < 1e-6, `Coincident planes dihedral angle must be 0, got ${angleCoin}`);

  // 3. Orthogonal planes (Oxy and Oxz): angle = pi/2
  const oxzPlane = [o, px, pz];
  const angleOrtho = dihedralAngle3D(oxyPlane1, oxzPlane);
  assert.ok(Math.abs(angleOrtho - Math.PI / 2) < 1e-6, `Orthogonal planes dihedral angle must be pi/2, got ${angleOrtho}`);

  // 4. Regular tetrahedron dihedral angle (every pair of faces has angle arccos(1/3) ≈ 70.528779°)
  const docTetra = create3DPrimitive('regular-tetrahedron');
  const ptsMap: Record<string, any> = {};
  for (const pt of docTetra.solid.points) {
    ptsMap[pt.id] = pt;
  }
  const expectedTetraAngle = Math.acos(1 / 3);
  const expectedDeg = (expectedTetraAngle * 180 / Math.PI).toFixed(4);

  // Test face (ABC) with face (SAB)
  const angleAB = dihedralAngle3D([ptsMap['A'], ptsMap['B'], ptsMap['C']], [ptsMap['S'], ptsMap['A'], ptsMap['B']]);
  assert.ok(Math.abs(angleAB - expectedTetraAngle) < 1e-5, `(ABC)-(SAB) dihedral angle must be arccos(1/3) (~${expectedDeg}°), got ${(angleAB * 180 / Math.PI).toFixed(4)}°`);

  // Test face (SAB) with face (SBC)
  const angleSideSide = dihedralAngle3D([ptsMap['S'], ptsMap['A'], ptsMap['B']], [ptsMap['S'], ptsMap['B'], ptsMap['C']]);
  assert.ok(Math.abs(angleSideSide - expectedTetraAngle) < 1e-5, `(SAB)-(SBC) dihedral angle must be arccos(1/3) (~${expectedDeg}°), got ${(angleSideSide * 180 / Math.PI).toFixed(4)}°`);

  // Test face (SBC) with face (SCA)
  const angleSideSide2 = dihedralAngle3D([ptsMap['S'], ptsMap['B'], ptsMap['C']], [ptsMap['S'], ptsMap['C'], ptsMap['A']]);
  assert.ok(Math.abs(angleSideSide2 - expectedTetraAngle) < 1e-5, `(SBC)-(SCA) dihedral angle must be arccos(1/3) (~${expectedDeg}°), got ${(angleSideSide2 * 180 / Math.PI).toFixed(4)}°`);
});

test('CHALLENGER 1.4: distancePointToPlane3D under coplanar and arbitrary spatial positions', () => {
  const pA = { x: 2, y: 0, z: 0 };
  const pB = { x: 0, y: 3, z: 0 };
  const pC = { x: 0, y: 0, z: 4 };
  // Plane equation: x/2 + y/3 + z/4 = 1  <=>  6x + 4y + 3z - 12 = 0
  // Normal n = (6, 4, 3), |n| = sqrt(36 + 16 + 9) = sqrt(61)

  // 1. Points lying on the plane: d = 0
  const dA = distancePointToPlane3D(pA, pA, pB, pC);
  const dB = distancePointToPlane3D(pB, pA, pB, pC);
  const dC = distancePointToPlane3D(pC, pA, pB, pC);
  assert.ok(dA < 1e-6, `Point A on plane must have distance 0, got ${dA}`);
  assert.ok(dB < 1e-6, `Point B on plane must have distance 0, got ${dB}`);
  assert.ok(dC < 1e-6, `Point C on plane must have distance 0, got ${dC}`);

  // Linear combination of plane points: 0.2*A + 0.3*B + 0.5*C
  const pComb = {
    x: 0.2 * pA.x + 0.3 * pB.x + 0.5 * pC.x,
    y: 0.2 * pA.y + 0.3 * pB.y + 0.5 * pC.y,
    z: 0.2 * pA.z + 0.3 * pB.z + 0.5 * pC.z
  };
  const dComb = distancePointToPlane3D(pComb, pA, pB, pC);
  assert.ok(dComb < 1e-6, `Convex combination on plane must have distance 0, got ${dComb}`);

  // 2. Origin (0,0,0) to plane 6x + 4y + 3z - 12 = 0: d = 12 / sqrt(61)
  const dOrigin = distancePointToPlane3D({ x: 0, y: 0, z: 0 }, pA, pB, pC);
  const expectedOrigin = 12 / Math.sqrt(61);
  assert.ok(Math.abs(dOrigin - expectedOrigin) < 1e-6, `Origin distance must be 12/sqrt(61), got ${dOrigin}`);

  // 3. Degenerate plane (collinear points): throws Error
  assert.throws(() => distancePointToPlane3D({ x: 0, y: 0, z: 0 }, pA, pB, { x: 4, y: -3, z: 0 }), /thẳng hàng|trùng nhau/i);
});

test('CHALLENGER 2: Empirical Translucent Plane Non-Occlusion (Mặt phẳng bán trong suốt không cản quang)', () => {
  // Scenario A: Cube with translucent cross-section plane
  const cubeDoc = create3DPrimitive('cube');
  const cam = { rotation: 30, tilt: 20 };

  // Occlusion baseline without any plane
  const baselineOcc = compute3DOcclusion(cubeDoc.solid, cam);
  assert.ok(baselineOcc.solidSegmentIds.size > 0, 'Baseline cube must have visible solid segments');
  assert.ok(baselineOcc.dashedSegmentIds.size > 0, 'Baseline cube must have hidden dashed segments');

  // Add translucent plane across the cube (e.g. plane A-B1-D1)
  const cubeWithTransPlane = createPlane3D(cubeDoc, ['A', 'B1', 'D1'], {
    id: 'sec_plane',
    color: '#3b82f6',
    opacity: 0.3,
    transparent: true
  });
  assert.doesNotThrow(() => validateDocument(cubeWithTransPlane));

  const transOcc = compute3DOcclusion(cubeWithTransPlane.solid, cam);

  // CRITICAL EMPIRICAL INVARIANT:
  // Every segment that was visible (solid) before adding the translucent plane
  // MUST REMAIN visible (solid) after adding the translucent plane!
  for (const segId of baselineOcc.solidSegmentIds) {
    assert.ok(
      transOcc.solidSegmentIds.has(segId),
      `Segment ${segId} was wrongly demoted to dashed behind translucent plane!`
    );
    assert.ok(
      !transOcc.dashedSegmentIds.has(segId),
      `Segment ${segId} must NOT appear in dashedSegmentIds when plane is transparent!`
    );
  }

  // Check SVG output: Translucent plane polygon must be rendered AND solid segments must not have dashed stroke
  const svgOut = solidSVG(cubeWithTransPlane.solid);
  assert.ok(svgOut.includes('data-plane="sec_plane"'), 'SVG must render translucent plane polygon');
  assert.ok(svgOut.includes('fill="#3b82f6"'), 'SVG plane must have fill color');

  // Scenario B: Pyramid S.ABCD with translucent cross-section plane
  const pyrDoc = create3DPrimitive('pyramid');
  const pyrWithTransPlane = createPlane3D(pyrDoc, ['A', 'B', 'S'], {
    id: 'pyr_plane',
    transparent: true
  });
  const pyrBaseline = compute3DOcclusion(pyrDoc.solid, cam);
  const pyrTransOcc = compute3DOcclusion(pyrWithTransPlane.solid, cam);

  for (const segId of pyrBaseline.solidSegmentIds) {
    assert.ok(
      pyrTransOcc.solidSegmentIds.has(segId),
      `Pyramid segment ${segId} was wrongly occluded by translucent plane!`
    );
  }

  // Scenario C: Contrast test with OPAQUE plane (transparent: false)
  // When an opaque plane is placed in front of an internal segment, it MUST occlude it
  const sceneWithOpaque = {
    type: 'custom',
    rotation: 0,
    tilt: 0,
    points: [
      { id: 'O1', x: -3, y: -3, z: 0 },
      { id: 'O2', x: 3, y: -3, z: 0 },
      { id: 'O3', x: 0, y: 3, z: 0 },
      { id: 'T1', x: 0, y: 0, z: -2 },
      { id: 'T2', x: 0, y: 1, z: -2 }
    ],
    segments: [
      { id: 'internal_target', refs: ['T1', 'T2'], styleMode: 'auto' }
    ],
    planes: [
      { id: 'wall', refs: ['O1', 'O2', 'O3'], transparent: false }
    ]
  };
  const occOpaque = compute3DOcclusion(sceneWithOpaque, { rotation: 0, tilt: 0 });
  assert.ok(
    occOpaque.dashedSegmentIds.has('internal_target'),
    'Opaque plane (transparent: false) SHOULD occlude segment behind it'
  );

  // Now change wall to transparent: true -> segment becomes solid
  const sceneWithTrans = structuredClone(sceneWithOpaque);
  sceneWithTrans.planes[0].transparent = true;
  const occTrans = compute3DOcclusion(sceneWithTrans, { rotation: 0, tilt: 0 });
  assert.ok(
    occTrans.solidSegmentIds.has('internal_target'),
    'Translucent plane (transparent: true) MUST NOT occlude segment behind it'
  );
});

test('CHALLENGER 3: styleMode override ("solid" | "dashed") persists across 360-degree camera orbit', () => {
  const pyrDoc = create3DPrimitive('pyramid');

  // Let's manually override two segments:
  // 1. Force normally occluded back edge 'AB' to 'solid'
  // 2. Force normally visible front edge 'SC' to 'dashed'
  let modifiedDoc = toggleSegmentStyle(pyrDoc, 'AB', 'solid');
  modifiedDoc = toggleSegmentStyle(modifiedDoc, 'SC', 'dashed');

  const segAB = modifiedDoc.solid.segments.find((s: any) => s.id === 'AB');
  const segSC = modifiedDoc.solid.segments.find((s: any) => s.id === 'SC');
  assert.equal(segAB?.styleMode, 'solid', 'seg_AB must have styleMode solid');
  assert.equal(segSC?.styleMode, 'dashed', 'seg_SC must have styleMode dashed');

  // Test full 360-degree rotation yaw sweep (-180 to +180 in 20-deg steps)
  // and multiple tilt pitches (-60, -30, 0, 20, 45, 75)
  const tilts = [-60, -30, 0, 20, 45, 75];
  for (let rot = -180; rot <= 180; rot += 20) {
    for (const tilt of tilts) {
      const camera = { rotation: rot, tilt };
      const orbitDoc = apply3DOrbit(modifiedDoc, 0, 0); // test camera object directly
      orbitDoc.solid.rotation = rot;
      orbitDoc.solid.tilt = tilt;

      const occ = compute3DOcclusion(orbitDoc.solid, camera);

      // Invariant 1: AB has styleMode 'solid' -> MUST BE SOLID at all camera angles
      assert.ok(
        occ.solidSegmentIds.has('AB'),
        `AB with styleMode 'solid' turned dashed at rot=${rot}, tilt=${tilt}`
      );
      assert.ok(
        !occ.dashedSegmentIds.has('AB'),
        `AB with styleMode 'solid' found in dashedSegmentIds at rot=${rot}, tilt=${tilt}`
      );

      // Invariant 2: SC has styleMode 'dashed' -> MUST BE DASHED at all camera angles
      assert.ok(
        occ.dashedSegmentIds.has('SC'),
        `SC with styleMode 'dashed' turned solid at rot=${rot}, tilt=${tilt}`
      );
      assert.ok(
        !occ.solidSegmentIds.has('SC'),
        `SC with styleMode 'dashed' found in solidSegmentIds at rot=${rot}, tilt=${tilt}`
      );

      // Invariant 3: SVG rendering preserves stroke-dasharray contract
      const svg = solidSVG(orbitDoc.solid);
      // AB should be rendered as a solid line WITHOUT stroke-dasharray="8 7"
      // Note: svg contains line with data-segment-3d="AB"
      const abMatch = svg.match(/<line[^>]*data-segment-3d="AB"[^>]*>/);
      assert.ok(abMatch, `SVG must render AB at rot=${rot}, tilt=${tilt}`);
      assert.ok(!abMatch[0].includes('stroke-dasharray="8 7"'), `AB solid line must NOT have stroke-dasharray="8 7" at rot=${rot}, tilt=${tilt}`);

      // SC should be rendered as a dashed line WITH stroke-dasharray="8 7"
      const scMatch = svg.match(/<line[^>]*data-segment-3d="SC"[^>]*>/);
      assert.ok(scMatch, `SVG must render SC at rot=${rot}, tilt=${tilt}`);
      assert.ok(scMatch[0].includes('stroke-dasharray="8 7"'), `SC dashed line MUST have stroke-dasharray="8 7" at rot=${rot}, tilt=${tilt}`);
    }
  }
});

test('CHALLENGER 4: Multi-angle dihedral angles (30°, 45°, 60°) and far-field distancePointToPlane3D', () => {
  const o = { x: 0, y: 0, z: 0 };
  const px = { x: 1, y: 0, z: 0 };
  const py = { x: 0, y: 1, z: 0 };
  const oxy = [o, px, py]; // plane z = 0, normal (0, 0, 1)

  // 1. Plane inclined at 45° to Oxy: y - z = 0 (contains x-axis)
  // Points: (0,0,0), (1,0,0), (0, 1, 1) -> normal = (0, -1, 1)
  const pl45 = [o, px, { x: 0, y: 1, z: 1 }];
  const angle45 = dihedralAngle3D(oxy, pl45);
  assert.ok(Math.abs(angle45 - Math.PI / 4) < 1e-6, `Dihedral 45° must be pi/4, got ${angle45}`);

  // 2. Plane inclined at 30° to Oxy: normal (0, -1, sqrt(3))
  // Points: (0,0,0), (1,0,0), (0, sqrt(3), 1) -> normal (0, -1, sqrt(3)) -> cos = sqrt(3)/2 -> 30°
  const pl30 = [o, px, { x: 0, y: Math.sqrt(3), z: 1 }];
  const angle30 = dihedralAngle3D(oxy, pl30);
  assert.ok(Math.abs(angle30 - Math.PI / 6) < 1e-6, `Dihedral 30° must be pi/6, got ${angle30}`);

  // 3. Plane inclined at 60° to Oxy:
  // Points: (0,0,0), (1,0,0), (0, 1, Math.sqrt(3)) -> normal (0, -sqrt(3), 1) -> cos = 1/2 -> 60°
  const pl60 = [o, px, { x: 0, y: 1, z: Math.sqrt(3) }];
  const angle60 = dihedralAngle3D(oxy, pl60);
  assert.ok(Math.abs(angle60 - Math.PI / 3) < 1e-6, `Dihedral 60° must be pi/3, got ${angle60}`);

  // 4. Far-field point distance: point (500, -800, -14.5) to Oxy defined by tiny triangle (0,0,0), (0.1, 0, 0), (0, 0.1, 0)
  const tinyOxyA = { x: 0, y: 0, z: 0 };
  const tinyOxyB = { x: 0.1, y: 0, z: 0 };
  const tinyOxyC = { x: 0, y: 0.1, z: 0 };
  const farPt = { x: 500, y: -800, z: -14.5 };
  const dFar = distancePointToPlane3D(farPt, tinyOxyA, tinyOxyB, tinyOxyC);
  assert.ok(Math.abs(dFar - 14.5) < 1e-6, `Far-field distance must be 14.5, got ${dFar}`);

  // 5. Point on negative coordinate side to general plane x + y + z = 3
  const p1 = { x: 3, y: 0, z: 0 };
  const p2 = { x: 0, y: 3, z: 0 };
  const p3 = { x: 0, y: 0, z: 3 };
  const negPt = { x: -2, y: -2, z: -2 };
  // d = |-2 -2 -2 - 3| / sqrt(3) = |-9| / sqrt(3) = 9 / sqrt(3) = 3*sqrt(3) ≈ 5.1961524
  const dNeg = distancePointToPlane3D(negPt, p1, p2, p3);
  const expectedDNeg = 3 * Math.sqrt(3);
  assert.ok(Math.abs(dNeg - expectedDNeg) < 1e-6, `Distance from (-2,-2,-2) must be 3*sqrt(3), got ${dNeg}`);
});

test('CHALLENGER 5: Scene with 5 overlapping translucent planes does not occlude internal geometry', () => {
  // Construct scene with 5 translucent planes and 3 segments
  const scene = {
    type: 'custom',
    rotation: 45,
    tilt: 30,
    points: [
      // Base cube vertices
      { id: 'A', x: -1, y: -1, z: -1 },
      { id: 'B', x: 1, y: -1, z: -1 },
      { id: 'C', x: 1, y: 1, z: -1 },
      { id: 'D', x: -1, y: 1, z: -1 },
      { id: 'A1', x: -1, y: -1, z: 1 },
      { id: 'B1', x: 1, y: -1, z: 1 },
      { id: 'C1', x: 1, y: 1, z: 1 },
      { id: 'D1', x: -1, y: 1, z: 1 },
      // Internal line
      { id: 'P', x: -0.5, y: -0.5, z: 0 },
      { id: 'Q', x: 0.5, y: 0.5, z: 0 }
    ],
    segments: [
      { id: 'PQ', refs: ['P', 'Q'], styleMode: 'auto' },
      { id: 'A1C1', refs: ['A1', 'C1'], styleMode: 'auto' }
    ],
    planes: [
      { id: 'pl1', refs: ['A', 'B', 'C1'], transparent: true },
      { id: 'pl2', refs: ['B', 'C', 'D1'], transparent: true },
      { id: 'pl3', refs: ['C', 'D', 'A1'], transparent: true },
      { id: 'pl4', refs: ['D', 'A', 'B1'], transparent: true },
      { id: 'pl5', refs: ['A', 'C', 'B1'], transparent: true }
    ]
  };

  const cam = { rotation: 45, tilt: 30 };
  const occ = compute3DOcclusion(scene, cam);

  // Since all 5 planes are transparent: true, none of them act as occlusion occluders
  // And there is no solid bounding hull, so PQ and A1C1 must be solid
  assert.ok(occ.solidSegmentIds.has('PQ'), 'Internal segment PQ must remain solid through 5 transparent planes');
  assert.ok(occ.solidSegmentIds.has('A1C1'), 'Top diagonal A1C1 must remain solid through 5 transparent planes');
  assert.equal(occ.dashedSegmentIds.size, 0, 'No segment should be dashed when all planes are translucent');

  // Verify SVG renders all 5 plane polygons
  const svg = solidSVG(scene);
  for (let i = 1; i <= 5; i++) {
    assert.ok(svg.includes(`data-plane="pl${i}"`), `SVG must render plane pl${i}`);
  }
});

test('CHALLENGER 6: Cyclic toggleSegmentStyle (auto -> solid -> dashed -> auto) and dynamic occlusion restoration', () => {
  const pyr = create3DPrimitive('pyramid');
  const edgeId = 'AB'; // back bottom edge

  // Camera at rot=30, tilt=20: back edge AB is naturally occluded by the pyramid
  const cam = { rotation: 30, tilt: 20 };
  const occInitial = compute3DOcclusion(pyr.solid, cam);
  assert.ok(occInitial.dashedSegmentIds.has(edgeId), 'AB is initially dashed in auto mode');

  // Step 1: toggle to 'solid'
  const step1 = toggleSegmentStyle(pyr, edgeId);
  assert.equal(step1.solid.segments.find((s: any) => s.id === edgeId).styleMode, 'solid');
  const occ1 = compute3DOcclusion(step1.solid, cam);
  assert.ok(occ1.solidSegmentIds.has(edgeId), 'AB becomes solid after 1st toggle');

  // Step 2: toggle to 'dashed'
  const step2 = toggleSegmentStyle(step1, edgeId);
  assert.equal(step2.solid.segments.find((s: any) => s.id === edgeId).styleMode, 'dashed');
  const occ2 = compute3DOcclusion(step2.solid, cam);
  assert.ok(occ2.dashedSegmentIds.has(edgeId), 'AB becomes dashed after 2nd toggle');

  // Step 3: toggle to 'auto' (completing the 3-state cycle)
  const step3 = toggleSegmentStyle(step2, edgeId);
  assert.equal(step3.solid.segments.find((s: any) => s.id === edgeId).styleMode, 'auto');

  // Now verify dynamic occlusion is fully restored:
  // When viewed from front (rot=30, tilt=20), AB is in the back -> DASHED
  const occBack = compute3DOcclusion(step3.solid, { rotation: 30, tilt: 20 });
  assert.ok(occBack.dashedSegmentIds.has(edgeId), 'AB dynamically becomes dashed when behind pyramid');

  // When rotated around to back (rot=180, tilt=20), AB is now in the FRONT -> SOLID
  const occFront = compute3DOcclusion(step3.solid, { rotation: 180, tilt: 20 });
  assert.ok(occFront.solidSegmentIds.has(edgeId), 'AB dynamically becomes solid when rotated to front');
});

