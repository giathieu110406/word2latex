import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDocument,
  resolve,
  norm3D,
  sub,
  add,
  mul,
  dot,
  cross3D,
  angleBetweenLines3D,
  angleLinePlane3D,
  dihedralAngle3D,
  distancePointToPlane3D
} from '../public/ve-hinh/src/math.js';
import { create3DPrimitive } from '../public/ve-hinh/src/app.js';
import { solidSVG } from '../public/ve-hinh/src/render.js';
import { rotateEuler, project3D, screen3D } from '../public/ve-hinh/src/engine3d/projection.js';
import { compute3DOcclusion } from '../public/ve-hinh/src/engine3d/occlusion.js';
import { exportTikZ } from '../public/ve-hinh/src/tikz.js';

// ============================================================================
// SUITE 1: CAMERA ANGLE EXTREMES AND DEGENERATE PROJECTIONS
// ============================================================================

test('Challenge 1.1: Horizontal front view (beta = 0 deg) compresses base ellipse without NaN or crash', () => {
  const solids = ['cone', 'cylinder', 'sphere', 'regular-tetrahedron', 'frustum'];

  for (const type of solids) {
    const doc = create3DPrimitive(type);
    doc.solid.tilt = 0; // beta = 0 deg
    doc.solid.rotation = 30;

    assert.doesNotThrow(() => validateDocument(doc), `validateDocument should pass for ${type} at tilt=0`);
    const svg = solidSVG(doc.solid);

    assert.ok(!svg.includes('NaN'), `SVG for ${type} at beta=0 must not contain NaN`);
    assert.ok(!svg.includes('Infinity'), `SVG for ${type} at beta=0 must not contain Infinity`);
    assert.ok(!svg.includes('undefined'), `SVG for ${type} at beta=0 must not contain undefined`);

    // Verify occlusion engine does not crash at beta = 0
    assert.doesNotThrow(() => compute3DOcclusion(doc.solid, { rotation: 30, tilt: 0 }));
  }

  // Specific check for cone at beta = 0: ry must be clamped to minimum 1.0 (flat line segment)
  const coneDoc = create3DPrimitive('cone');
  coneDoc.solid.tilt = 0;
  const coneSvg = solidSVG(coneDoc.solid);
  assert.ok(coneSvg.includes('A 153.0 1.0 0 0 1'), 'Cone base ellipse must clamp ry to 1.0 when beta=0');
  assert.ok(coneSvg.includes('data-cone-generator="left"'), 'Cone must render left generator');
  assert.ok(coneSvg.includes('data-cone-generator="right"'), 'Cone must render right generator');

  // Cylinder at beta = 0: top ellipse ry=1.0, vertical generator lines
  const cylDoc = create3DPrimitive('cylinder');
  cylDoc.solid.tilt = 0;
  const cylSvg = solidSVG(cylDoc.solid);
  assert.ok(cylSvg.includes('rx="127.5" ry="1.0"'), 'Cylinder top ellipse ry must be clamped to 1.0 when beta=0');
  assert.ok(cylSvg.includes('data-cylinder-generator="left"'), 'Cylinder must render left generator');
  assert.ok(cylSvg.includes('data-cylinder-generator="right"'), 'Cylinder must render right generator');

  // Sphere at beta = 0: silhouette circle r=153.0, equator ry=1.0
  const sphDoc = create3DPrimitive('sphere');
  sphDoc.solid.tilt = 0;
  const sphSvg = solidSVG(sphDoc.solid);
  assert.ok(sphSvg.includes('r="153.0"'), 'Sphere silhouette radius must remain 153.0');
  assert.ok(sphSvg.includes('A 153.0 1.0 0 0 1'), 'Sphere equator arc ry must clamp to 1.0 when beta=0');
});

test('Challenge 1.2: Vertical top-down view (beta = 90 deg) renders circular bases and coaxial projection', () => {
  const solids = ['cone', 'cylinder', 'sphere', 'regular-tetrahedron', 'frustum'];

  for (const type of solids) {
    const doc = create3DPrimitive(type);
    doc.solid.tilt = 90; // beta = 90 deg
    doc.solid.rotation = 0;

    assert.doesNotThrow(() => validateDocument(doc));
    const svg = solidSVG(doc.solid);

    assert.ok(!svg.includes('NaN'), `SVG for ${type} at beta=90 must not contain NaN`);
    assert.ok(!svg.includes('Infinity'), `SVG for ${type} at beta=90 must not contain Infinity`);
    assert.ok(!svg.includes('undefined'), `SVG for ${type} at beta=90 must not contain undefined`);
  }

  // Cone at beta = 90: ry = rx = 153.0 (circle)
  const coneDoc = create3DPrimitive('cone');
  coneDoc.solid.tilt = 90;
  coneDoc.solid.rotation = 0;
  const coneSvg = solidSVG(coneDoc.solid);
  assert.ok(coneSvg.includes('A 153.0 153.0 0 0 1'), 'Cone base at beta=90 must have ry=rx=153.0 (full circular projection)');

  // Apex S and center O project coaxially to (500, 330)
  const sProj = screen3D({ x: 0, y: 2, z: 0 }, { rotation: 0, tilt: 90 });
  const oProj = screen3D({ x: 0, y: -1.2, z: 0 }, { rotation: 0, tilt: 90 });
  assert.ok(Math.abs(sProj.x - 500) < 1e-4);
  assert.ok(Math.abs(sProj.y - 330) < 1e-4);
  assert.ok(Math.abs(oProj.x - 500) < 1e-4);
  assert.ok(Math.abs(oProj.y - 330) < 1e-4);
  assert.ok(Math.abs(sProj.x - oProj.x) < 1e-4 && Math.abs(sProj.y - oProj.y) < 1e-4, 'S and O must project to the same 2D position');

  // Cylinder at beta = 90: top base is a circle with rx=ry=127.5
  const cylDoc = create3DPrimitive('cylinder');
  cylDoc.solid.tilt = 90;
  const cylSvg = solidSVG(cylDoc.solid);
  assert.ok(cylSvg.includes('rx="127.5" ry="127.5"'), 'Cylinder top base must project to a circle of radius 127.5');

  // Regular tetrahedron at beta = 90: Apex S is centered at (500, 330)
  const tetraDoc = create3DPrimitive('regular-tetrahedron');
  tetraDoc.solid.tilt = 90;
  tetraDoc.solid.rotation = 0;
  const tetraOcc = compute3DOcclusion(tetraDoc.solid, { rotation: 0, tilt: 90 });
  // In top-down view of tetrahedron, bottom base edges AB, BC, CA face downwards (backface culling)
  // while lateral edges SA, SB, SC face upwards
  assert.ok(tetraOcc.solidSegmentIds.has('SA') && tetraOcc.solidSegmentIds.has('SB') && tetraOcc.solidSegmentIds.has('SC'),
    'Lateral edges SA, SB, SC must be visible from above');

  // Frustum at beta = 90: Top base edges must be visible (solid)
  const frustumDoc = create3DPrimitive('frustum');
  frustumDoc.solid.tilt = 90;
  frustumDoc.solid.rotation = 0;
  const frustumOcc = compute3DOcclusion(frustumDoc.solid, { rotation: 0, tilt: 90 });
  assert.ok(frustumOcc.solidSegmentIds.has('A1B1'));
  assert.ok(frustumOcc.solidSegmentIds.has('B1C1'));
  assert.ok(frustumOcc.solidSegmentIds.has('C1D1'));
  assert.ok(frustumOcc.solidSegmentIds.has('D1A1'));
});

test('Challenge 1.3: Upward view from below (beta = -45 deg and -90 deg) properly inverts base visibility', () => {
  const angles = [-45, -90];

  for (const tilt of angles) {
    for (const type of ['cone', 'cylinder', 'sphere']) {
      const doc = create3DPrimitive(type);
      doc.solid.tilt = tilt;
      const svg = solidSVG(doc.solid);
      assert.ok(!svg.includes('NaN'), `${type} at beta=${tilt} must not contain NaN`);
      assert.ok(!svg.includes('undefined'), `${type} at beta=${tilt} must not contain undefined`);
    }

    // Cone: viewed from below (tilt < 0), frontArc and backArc must invert
    const coneDoc = create3DPrimitive('cone');
    coneDoc.solid.tilt = tilt;
    const coneSvg = solidSVG(coneDoc.solid);
    // When tilt < 0: backArc uses lowerArc, frontArc uses upperArc
    assert.ok(coneSvg.includes('data-cone-back="true"'), 'Cone must still have data-cone-back');
    assert.ok(coneSvg.includes('data-cone-front="true"'), 'Cone must still have data-cone-front');

    // Cylinder: viewed from below (tilt < 0), bottom base must be rendered as full ellipse!
    const cylDoc = create3DPrimitive('cylinder');
    cylDoc.solid.tilt = tilt;
    const cylSvg = solidSVG(cylDoc.solid);
    assert.ok(cylSvg.includes('data-cylinder-bottom="true"'), `Cylinder at beta=${tilt} must render full bottom ellipse`);
    assert.ok(cylSvg.includes('data-cylinder-top-back="true"'), `Cylinder at beta=${tilt} must render dashed back arc for top base`);
  }
});

// ============================================================================
// SUITE 2: CONTINUOUS 360-DEGREE AZIMUTH ANGLE SWEEP (CONE, CYLINDER, SPHERE)
// ============================================================================

test('Challenge 2.1: Continuous 360-degree Azimuth sweep (alpha = 0..360 deg) maintains generators and produces zero NaN', () => {
  const step = 15; // 0, 15, 30, ..., 360 deg
  const solids = ['cone', 'cylinder', 'sphere'];

  for (let alpha = 0; alpha <= 360; alpha += step) {
    for (const type of solids) {
      const doc = create3DPrimitive(type);
      doc.solid.rotation = alpha;
      doc.solid.tilt = 20;

      const svg = solidSVG(doc.solid);

      assert.ok(!svg.includes('NaN'), `${type} at alpha=${alpha} must not contain NaN`);
      assert.ok(!svg.includes('undefined'), `${type} at alpha=${alpha} must not contain undefined`);
      assert.ok(!svg.includes('Infinity'), `${type} at alpha=${alpha} must not contain Infinity`);

      if (type === 'cone') {
        // Generator line coordinates check
        const matchLeft = svg.match(/data-cone-generator="left" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/);
        assert.ok(matchLeft, `Cone at alpha=${alpha} must have left generator line`);
        const [, x1, y1, x2, y2] = matchLeft.map(Number);
        assert.ok(Number.isFinite(x1) && Number.isFinite(y1) && Number.isFinite(x2) && Number.isFinite(y2));
        const len = Math.hypot(x2 - x1, y2 - y1);
        assert.ok(len > 100, `Left generator length ${len} must be substantial`);

        const matchRight = svg.match(/data-cone-generator="right" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/);
        assert.ok(matchRight, `Cone at alpha=${alpha} must have right generator line`);
        const [, rx1, ry1, rx2, ry2] = matchRight.map(Number);
        assert.ok(Number.isFinite(rx1) && Number.isFinite(ry1) && Number.isFinite(rx2) && Number.isFinite(ry2));
        const rLen = Math.hypot(rx2 - rx1, ry2 - ry1);
        assert.ok(rLen > 100, `Right generator length ${rLen} must be substantial`);
      }

      if (type === 'cylinder') {
        const matchGen = svg.match(/data-cylinder-generator="left" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/);
        assert.ok(matchGen, `Cylinder at alpha=${alpha} must have left generator line`);
        const [, x1, y1, x2, y2] = matchGen.map(Number);
        assert.ok(Number.isFinite(x1) && Number.isFinite(y1) && Number.isFinite(x2) && Number.isFinite(y2));
        assert.ok(Math.abs(x1 - x2) < 1e-4, 'Cylinder vertical generator must have equal x coordinates in orthographic view');
        const height = Math.abs(y2 - y1);
        assert.ok(height > 50, `Cylinder height ${height} must be substantial`);
      }

      if (type === 'sphere') {
        assert.ok(svg.includes('data-sphere-silhouette="true"'), 'Sphere must have silhouette');
        assert.ok(svg.includes('data-sphere-equator-back="true"'), 'Sphere must have back equator');
        assert.ok(svg.includes('data-sphere-equator-front="true"'), 'Sphere must have front equator');
      }
    }
  }
});

// ============================================================================
// SUITE 3: REGULAR TETRAHEDRON 6-EDGE ISOMETRY AND ROTATION INVARIANCE
// ============================================================================

test('Challenge 3.1: Regular tetrahedron 3D object space has 6 strictly isometric edges and equilateral faces', () => {
  const doc = create3DPrimitive('regular-tetrahedron');
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);

  const pts = res.solidPoints;
  const A = pts['A'], B = pts['B'], C = pts['C'], S = pts['S'];
  assert.ok(A && B && C && S, 'Vertices A, B, C, S must exist');

  const edges = [
    { name: 'AB', val: norm3D(sub(B, A)) },
    { name: 'BC', val: norm3D(sub(C, B)) },
    { name: 'CA', val: norm3D(sub(A, C)) },
    { name: 'SA', val: norm3D(sub(A, S)) },
    { name: 'SB', val: norm3D(sub(B, S)) },
    { name: 'SC', val: norm3D(sub(C, S)) }
  ];

  const R0 = 1.8;
  const expectedEdge = R0 * Math.sqrt(3); // 1.8 * sqrt(3) ≈ 3.11769145

  // 1. All 6 edge lengths must equal R0 * sqrt(3) within 1e-6
  for (const e of edges) {
    assert.ok(
      Math.abs(e.val - expectedEdge) < 1e-6,
      `Edge ${e.name} length ${e.val} must strictly equal ${expectedEdge}`
    );
  }

  // 2. All pairwise differences must be virtually zero (< 1e-6)
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      assert.ok(
        Math.abs(edges[i].val - edges[j].val) < 1e-6,
        `Pairwise difference between ${edges[i].name} and ${edges[j].name} must be < 1e-6`
      );
    }
  }

  // 3. Face areas: All 4 triangular faces must have identical area = sqrt(3)/4 * a^2
  const expectedFaceArea = (Math.sqrt(3) / 4) * Math.pow(expectedEdge, 2); // 3*sqrt(3)/4 * 1.8^2 ≈ 4.208883
  const faceABC = 0.5 * norm3D(cross3D(sub(B, A), sub(C, A)));
  const faceSAB = 0.5 * norm3D(cross3D(sub(A, S), sub(B, S)));
  const faceSBC = 0.5 * norm3D(cross3D(sub(B, S), sub(C, S)));
  const faceSCA = 0.5 * norm3D(cross3D(sub(C, S), sub(A, S)));

  const faceItems: [string, number][] = [['ABC', faceABC], ['SAB', faceSAB], ['SBC', faceSBC], ['SCA', faceSCA]];
  for (const [name, area] of faceItems) {
    assert.ok(
      Math.abs(area - expectedFaceArea) < 1e-6,
      `Face ${name} area ${area} must equal ${expectedFaceArea}`
    );
  }
});

test('Challenge 3.2: 6-edge isometry is strictly invariant under arbitrary 3D rotation angles (R_x * R_y)', () => {
  const doc = create3DPrimitive('regular-tetrahedron');
  const res = resolve(doc);
  const { A, B, C, S } = res.solidPoints;

  const R0 = 1.8;
  const expectedEdge = R0 * Math.sqrt(3);

  // Generate 60 test rotation pairs covering all quadrants and edge angles
  const testAngles = [
    [0, 0], [45, 30], [90, 45], [135, 60], [180, 0],
    [-45, -30], [-90, -45], [-135, -60], [270, 90], [315, -45],
    [12.3, 76.5], [-88.1, 14.2], [179.9, -89.9], [0, 90], [0, -90]
  ];

  for (let rot = 0; rot < 360; rot += 40) {
    for (let tilt = -80; tilt <= 80; tilt += 40) {
      testAngles.push([rot, tilt]);
    }
  }

  for (const [rotation, tilt] of testAngles) {
    const cam = { rotation, tilt };
    const rA = rotateEuler(A, cam);
    const rB = rotateEuler(B, cam);
    const rC = rotateEuler(C, cam);
    const rS = rotateEuler(S, cam);

    const dAB = norm3D(sub(rB, rA));
    const dBC = norm3D(sub(rC, rB));
    const dCA = norm3D(sub(rA, rC));
    const dSA = norm3D(sub(rA, rS));
    const dSB = norm3D(sub(rB, rS));
    const dSC = norm3D(sub(rC, rS));

    const rotatedEdges = [dAB, dBC, dCA, dSA, dSB, dSC];

    for (let i = 0; i < rotatedEdges.length; i++) {
      assert.ok(
        Math.abs(rotatedEdges[i] - expectedEdge) < 1e-5,
        `Edge ${i} at rot=(${rotation}, ${tilt}) deviated from expected length: ${rotatedEdges[i]}`
      );
    }
  }
});

test('Challenge 3.3: Regular tetrahedron satisfies all spatial measurement invariants (dihedral angles, perpendicular opposite edges)', () => {
  const doc = create3DPrimitive('regular-tetrahedron');
  const res = resolve(doc);
  const { A, B, C, S } = res.solidPoints;

  // 1. Dihedral angle between any 2 adjacent faces must equal arccos(1/3) ≈ 1.2309594 rad (70.5288 deg)
  const expectedDihedral = Math.acos(1 / 3);
  const d_ABC_SAB = dihedralAngle3D([A, B, C], [S, A, B]);
  const d_ABC_SBC = dihedralAngle3D([A, B, C], [S, B, C]);
  const d_ABC_SCA = dihedralAngle3D([A, B, C], [S, C, A]);
  const d_SAB_SBC = dihedralAngle3D([S, A, B], [S, B, C]);
  const d_SBC_SCA = dihedralAngle3D([S, B, C], [S, C, A]);
  const d_SCA_SAB = dihedralAngle3D([S, C, A], [S, A, B]);

  const dihedralItems: [string, number][] = [
    ['ABC-SAB', d_ABC_SAB],
    ['ABC-SBC', d_ABC_SBC],
    ['ABC-SCA', d_ABC_SCA],
    ['SAB-SBC', d_SAB_SBC],
    ['SBC-SCA', d_SBC_SCA],
    ['SCA-SAB', d_SCA_SAB]
  ];
  for (const [name, val] of dihedralItems) {
    assert.ok(
      Math.abs(val - expectedDihedral) < 1e-5,
      `Dihedral angle ${name} = ${val} rad must equal arccos(1/3) = ${expectedDihedral} rad`
    );
  }

  // 2. Opposite edges of a regular tetrahedron are mutually perpendicular (angle = pi/2 = 90 deg)
  // Pair 1: SA and BC
  const ang_SA_BC = angleBetweenLines3D(S, A, B, C);
  assert.ok(Math.abs(ang_SA_BC - Math.PI / 2) < 1e-5, `Angle between SA and BC must be 90 deg, got ${ang_SA_BC}`);

  // Pair 2: SB and CA
  const ang_SB_CA = angleBetweenLines3D(S, B, C, A);
  assert.ok(Math.abs(ang_SB_CA - Math.PI / 2) < 1e-5, `Angle between SB and CA must be 90 deg, got ${ang_SB_CA}`);

  // Pair 3: SC and AB
  const ang_SC_AB = angleBetweenLines3D(S, C, A, B);
  assert.ok(Math.abs(ang_SC_AB - Math.PI / 2) < 1e-5, `Angle between SC and AB must be 90 deg, got ${ang_SC_AB}`);

  // 3. Distance from Apex S to base ABC must equal a * sqrt(2/3) = R0 * sqrt(2) ≈ 2.5455844
  const expectedHeight = 1.8 * Math.sqrt(2);
  const distS_ABC = distancePointToPlane3D(S, A, B, C);
  assert.ok(
    Math.abs(distS_ABC - expectedHeight) < 1e-5,
    `Distance from S to (ABC) = ${distS_ABC} must equal ${expectedHeight}`
  );
});

// ============================================================================
// SUITE 4: FRUSTUM BASE PARALLELISM AND LATERAL EDGE CONCURRENCY
// ============================================================================

test('Challenge 4.1: Frustum base planes and corresponding edges are strictly parallel in 3D and 2D projection', () => {
  const doc = create3DPrimitive('frustum');
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);

  const { A, B, C, D, A1, B1, C1, D1 } = res.solidPoints;

  // 1. In 3D: Both base planes have collinear normal vectors
  const nBottom = cross3D(sub(B, A), sub(D, A));
  const nTop = cross3D(sub(B1, A1), sub(D1, A1));
  const crossBases = cross3D(nBottom, nTop);
  assert.ok(norm3D(crossBases) < 1e-6, 'Normal vectors of bottom and top base must be parallel');

  // Dihedral angle between bases must be 0 rad
  const baseDihedral = dihedralAngle3D([A, B, C], [A1, B1, C1]);
  assert.ok(Math.abs(baseDihedral) < 1e-6, 'Dihedral angle between bases must be 0');

  // Distance between bases must be 1.2 - (-1.3) = 2.5
  const distBases = distancePointToPlane3D(A1, A, B, C);
  assert.ok(Math.abs(distBases - 2.5) < 1e-6, 'Distance between bases must equal 2.5');

  // 2. Corresponding edges are parallel in 3D: AB || A1B1, BC || B1C1, CD || C1D1, DA || D1A1
  const pairs3D = [
    [sub(B, A), sub(B1, A1)],
    [sub(C, B), sub(C1, B1)],
    [sub(D, C), sub(D1, C1)],
    [sub(A, D), sub(A1, D1)]
  ];
  for (let i = 0; i < pairs3D.length; i++) {
    const [vBot, vTop] = pairs3D[i];
    const c = cross3D(vBot, vTop);
    assert.ok(norm3D(c) < 1e-6, `3D edge pair ${i} must be parallel`);
  }

  // 3. In 2D Projection: Under arbitrary camera angles (rot, tilt), projected edges MUST remain parallel!
  // In 2D, two vectors (u1, v1) and (u2, v2) are parallel iff u1*v2 - u2*v1 == 0
  const sampleCameras = [
    [0, 0], [30, 20], [60, 45], [90, 0], [120, -30],
    [-45, 15], [-90, 45], [180, 20], [240, -45], [315, 60]
  ];

  for (const [rotation, tilt] of sampleCameras) {
    const cam = { rotation, tilt };
    const pA = project3D(A, cam);
    const pB = project3D(B, cam);
    const pC = project3D(C, cam);
    const pD = project3D(D, cam);
    const pA1 = project3D(A1, cam);
    const pB1 = project3D(B1, cam);
    const pC1 = project3D(C1, cam);
    const pD1 = project3D(D1, cam);

    const edgePairs2D = [
      [{ u: pB.u - pA.u, v: pB.v - pA.v }, { u: pB1.u - pA1.u, v: pB1.v - pA1.v }],
      [{ u: pC.u - pB.u, v: pC.v - pB.v }, { u: pC1.u - pB1.u, v: pC1.v - pB1.v }],
      [{ u: pD.u - pC.u, v: pD.v - pC.v }, { u: pD1.u - pC1.u, v: pD1.v - pC1.v }],
      [{ u: pA.u - pD.u, v: pA.v - pD.v }, { u: pA1.u - pD1.u, v: pA1.v - pD1.v }]
    ];

    for (let k = 0; k < edgePairs2D.length; k++) {
      const [e1, e2] = edgePairs2D[k];
      const cross2D = e1.u * e2.v - e1.v * e2.u;
      assert.ok(
        Math.abs(cross2D) < 1e-5,
        `2D projected edge pair ${k} at rot=(${rotation}, ${tilt}) must be parallel, cross2D=${cross2D}`
      );
    }
  }
});

test('Challenge 4.2: Frustum 4 lateral edges are strictly concurrent at virtual apex S(0, 3.7, 0) in 3D and 2D', () => {
  const doc = create3DPrimitive('frustum');
  const res = resolve(doc);
  const { A, B, C, D, A1, B1, C1, D1 } = res.solidPoints;

  const expectedApex = { x: 0, y: 3.7, z: 0 };

  // 1. In 3D: Each lateral edge line L(t) = P + t*(P1 - P) passes through S(0, 3.7, 0)
  // Distance from S to line passing through P and P1 is |(S - P) x (P1 - P)| / |P1 - P|
  const lateralEdges = [
    { name: 'AA1', p: A, p1: A1 },
    { name: 'BB1', p: B, p1: B1 },
    { name: 'CC1', p: C, p1: C1 },
    { name: 'DD1', p: D, p1: D1 }
  ];

  for (const { name, p, p1 } of lateralEdges) {
    const dir = sub(p1, p);
    const toApex = sub(expectedApex, p);
    const distToApex = norm3D(cross3D(toApex, dir)) / norm3D(dir);
    assert.ok(
      distToApex < 1e-6,
      `Lateral line ${name} must pass through apex S(0, 3.7, 0), deviation=${distToApex}`
    );

    // Also verify scale factor t: P + t*dir = S at t = 2.0 exactly
    const t = (expectedApex.y - p.y) / dir.y;
    assert.ok(Math.abs(t - 2.0) < 1e-6, `Scale factor t for ${name} must be exactly 2.0`);
  }

  // 2. In 2D Projection: Under arbitrary camera angles, projected lateral lines all pass through projected apex P(S)!
  const testRotations = [
    [0, 0], [30, 20], [45, 45], [90, 30], [135, -20],
    [-60, 40], [-120, -30], [210, 10], [300, -50]
  ];

  for (const [rotation, tilt] of testRotations) {
    const cam = { rotation, tilt };
    const pS = project3D(expectedApex, cam);

    for (const { name, p, p1 } of lateralEdges) {
      const projP = project3D(p, cam);
      const projP1 = project3D(p1, cam);

      // In 2D, distance from point pS to line through projP and projP1:
      // dist = |(projP1.u - projP.u)*(projP.v - pS.v) - (projP.u - pS.u)*(projP1.v - projP.v)| / length
      const du = projP1.u - projP.u;
      const dv = projP1.v - projP.v;
      const len2D = Math.hypot(du, dv);

      if (len2D > 1e-5) {
        const dist2D = Math.abs(du * (projP.v - pS.v) - (projP.u - pS.u) * dv) / len2D;
        assert.ok(
          dist2D < 1e-5,
          `Projected line ${name} at rot=(${rotation}, ${tilt}) must pass through projected apex, dist=${dist2D}`
        );
      }
    }
  }
});

// ============================================================================
// SUITE 5: UNIFIED TIKZ AND SVG EXPORT ROBUSTNESS FOR ALL 3D SOLIDS
// ============================================================================

test('Challenge 5.1: exportTikZ and solidSVG produce valid outputs for all 3D solid types without NaN or syntax errors', () => {
  const solidTypes = [
    'cone',
    'cylinder',
    'sphere',
    'regular-tetrahedron',
    'frustum',
    'pyramid',
    'cube',
    'box',
    'prism'
  ];

  for (const type of solidTypes) {
    const doc = create3DPrimitive(type);
    assert.doesNotThrow(() => validateDocument(doc), `Document for ${type} must be valid`);

    // 1. solidSVG
    const svg = solidSVG(doc.solid);
    assert.ok(svg.length > 50, `SVG for ${type} must be non-empty`);
    assert.ok(!svg.includes('NaN'), `SVG for ${type} must not contain NaN`);
    assert.ok(!svg.includes('undefined'), `SVG for ${type} must not contain undefined`);
    assert.ok(!svg.includes('Infinity'), `SVG for ${type} must not contain Infinity`);

    // 2. exportTikZ
    const tikz = exportTikZ(doc);
    assert.ok(tikz.startsWith('\\begin{tikzpicture}'), `TikZ for ${type} must start with tikzpicture`);
    assert.ok(tikz.endsWith('\\end{tikzpicture}'), `TikZ for ${type} must end with \\end{tikzpicture}`);
    assert.ok(!tikz.includes('NaN'), `TikZ for ${type} must not contain NaN`);
    assert.ok(!tikz.includes('undefined'), `TikZ for ${type} must not contain undefined`);
    assert.ok(!tikz.includes('Infinity'), `TikZ for ${type} must not contain Infinity`);
  }
});
