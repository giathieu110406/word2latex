import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDocument,
  resolve,
  norm3D,
  sub
} from '../public/ve-hinh/src/math.js';
import {
  create3DPrimitive,
  createPlane3D,
  createParallel3D,
  toggleSegmentStyle
} from '../public/ve-hinh/src/app.js';
import { solidSVG } from '../public/ve-hinh/src/render.js';
import { compute3DOcclusion } from '../public/ve-hinh/src/engine3d/occlusion.js';

test('validateDocument accepts extended 3D solid types and validates planes', () => {
  const validTypes = [
    'regular-tetrahedron',
    'frustum',
    'cone',
    'cylinder',
    'sphere'
  ];

  for (const type of validTypes) {
    const doc = {
      version: 1,
      title: `Test ${type}`,
      points: [],
      shapes: [],
      graph: { expressions: [], params: [] },
      chart: { type: 'bar', labels: ['A'], values: [1] },
      solid: {
        type,
        rotation: 30,
        tilt: 20
      }
    };
    assert.doesNotThrow(() => validateDocument(doc), `Should accept solid type ${type}`);
  }

  // Reject unsupported solid type
  const invalidDoc = {
    version: 1,
    title: 'Invalid Solid',
    points: [],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['A'], values: [1] },
    solid: {
      type: 'torus_nonexistent',
      rotation: 30,
      tilt: 20
    }
  };
  assert.throws(() => validateDocument(invalidDoc), /Mô hình không gian không hợp lệ/);

  // Validate solid.planes transparent property
  const planeDoc = {
    version: 1,
    title: 'Planes validation',
    points: [],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['A'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'A', x: 0, y: 0, z: 0 },
        { id: 'B', x: 1, y: 0, z: 0 },
        { id: 'C', x: 0, y: 1, z: 0 }
      ],
      planes: [
        { id: 'p1', refs: ['A', 'B', 'C'] as [string, string, string], color: '#3b82f6', opacity: 0.25, transparent: true },
        { id: 'p2', refs: ['A', 'B', 'C'] as [string, string, string], color: '#ef4444', opacity: 0.8, transparent: false }
      ]
    }
  };
  assert.doesNotThrow(() => validateDocument(planeDoc));

  // Reject non-boolean transparent
  const invalidPlaneDoc = structuredClone(planeDoc);
  (invalidPlaneDoc.solid.planes![0] as any).transparent = 'yes';
  assert.throws(() => validateDocument(invalidPlaneDoc), /Trạng thái trong suốt phải là boolean/);
});

test('create3DPrimitive regular-tetrahedron has 6 equal edges', () => {
  const doc = create3DPrimitive('regular-tetrahedron');
  assert.equal(doc.solid.type, 'regular-tetrahedron');
  assert.doesNotThrow(() => validateDocument(doc));

  const { solidPoints, errors } = resolve(doc);
  assert.equal(errors.length, 0);

  const pts = solidPoints;
  const A = pts['A'];
  const B = pts['B'];
  const C = pts['C'];
  const S = pts['S'];

  const dAB = norm3D(sub(B, A));
  const dBC = norm3D(sub(C, B));
  const dCA = norm3D(sub(A, C));
  const dSA = norm3D(sub(A, S));
  const dSB = norm3D(sub(B, S));
  const dSC = norm3D(sub(C, S));

  const expectedLength = 1.8 * Math.sqrt(3); // ~ 3.11769145

  assert.ok(Math.abs(dAB - expectedLength) < 1e-5, `AB=${dAB} must match ${expectedLength}`);
  assert.ok(Math.abs(dBC - expectedLength) < 1e-5, `BC=${dBC} must match ${expectedLength}`);
  assert.ok(Math.abs(dCA - expectedLength) < 1e-5, `CA=${dCA} must match ${expectedLength}`);
  assert.ok(Math.abs(dSA - expectedLength) < 1e-5, `SA=${dSA} must match ${expectedLength}`);
  assert.ok(Math.abs(dSB - expectedLength) < 1e-5, `SB=${dSB} must match ${expectedLength}`);
  assert.ok(Math.abs(dSC - expectedLength) < 1e-5, `SC=${dSC} must match ${expectedLength}`);

  // All 6 pairwise differences must be virtually zero
  const edges = [dAB, dBC, dCA, dSA, dSB, dSC];
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      assert.ok(Math.abs(edges[i] - edges[j]) < 1e-5, `Edges ${i} and ${j} differ by ${Math.abs(edges[i] - edges[j])}`);
    }
  }
});

test('create3DPrimitive frustum has parallel bases and concurrent lateral edges', () => {
  const doc = create3DPrimitive('frustum');
  assert.equal(doc.solid.type, 'frustum');
  assert.doesNotThrow(() => validateDocument(doc));

  const { solidPoints, errors } = resolve(doc);
  assert.equal(errors.length, 0);

  const pts = solidPoints;
  const A = pts['A'], B = pts['B'], C = pts['C'], D = pts['D'];
  const A1 = pts['A1'], B1 = pts['B1'], C1 = pts['C1'], D1 = pts['D1'];

  // Bottom base is in horizontal plane y = -1.3
  assert.equal(A.y, -1.3);
  assert.equal(B.y, -1.3);
  assert.equal(C.y, -1.3);
  assert.equal(D.y, -1.3);

  // Top base is in horizontal plane y = 1.2
  assert.equal(A1.y, 1.2);
  assert.equal(B1.y, 1.2);
  assert.equal(C1.y, 1.2);
  assert.equal(D1.y, 1.2);

  // Bases are similar with ratio 1:2
  const bottomWidth = norm3D(sub(B, A));
  const topWidth = norm3D(sub(B1, A1));
  assert.ok(Math.abs(topWidth / bottomWidth - 0.5) < 1e-5, 'Width ratio must be 0.5');

  const bottomDepth = norm3D(sub(C, B));
  const topDepth = norm3D(sub(C1, B1));
  assert.ok(Math.abs(topDepth / bottomDepth - 0.5) < 1e-5, 'Depth ratio must be 0.5');

  // Verify lateral edges AA1, BB1, CC1, DD1 converge to virtual apex S(0, 3.7, 0)
  // S = A + t*(A1 - A) with t = 2 => A + 2*(A1 - A) = 2*A1 - A
  const virtualS_A = { x: 2 * A1.x - A.x, y: 2 * A1.y - A.y, z: 2 * A1.z - A.z };
  const virtualS_B = { x: 2 * B1.x - B.x, y: 2 * B1.y - B.y, z: 2 * B1.z - B.z };
  const virtualS_C = { x: 2 * C1.x - C.x, y: 2 * C1.y - C.y, z: 2 * C1.z - C.z };
  const virtualS_D = { x: 2 * D1.x - D.x, y: 2 * D1.y - D.y, z: 2 * D1.z - D.z };

  assert.ok(norm3D(sub(virtualS_A, { x: 0, y: 3.7, z: 0 })) < 1e-5);
  assert.ok(norm3D(sub(virtualS_B, { x: 0, y: 3.7, z: 0 })) < 1e-5);
  assert.ok(norm3D(sub(virtualS_C, { x: 0, y: 3.7, z: 0 })) < 1e-5);
  assert.ok(norm3D(sub(virtualS_D, { x: 0, y: 3.7, z: 0 })) < 1e-5);
});

test('create3DPrimitive cone, cylinder, and sphere primitives generate correct topology', () => {
  // Cone
  const cone = create3DPrimitive('cone');
  assert.equal(cone.solid.type, 'cone');
  assert.doesNotThrow(() => validateDocument(cone));
  assert.ok(cone.solid.points.some(p => p.id === 'S' && p.y === 2));
  assert.ok(cone.solid.points.some(p => p.id === 'O' && p.y === -1.2));
  assert.ok(cone.solid.segments.some(s => s.id === 'SO' && s.styleMode === 'dashed'));
  assert.ok(cone.solid.segments.some(s => s.id === 'SA' && s.styleMode === 'solid'));

  // Cylinder
  const cyl = create3DPrimitive('cylinder');
  assert.equal(cyl.solid.type, 'cylinder');
  assert.doesNotThrow(() => validateDocument(cyl));
  assert.ok(cyl.solid.points.some(p => p.id === 'O1' && p.y === 1.3));
  assert.ok(cyl.solid.points.some(p => p.id === 'O2' && p.y === -1.3));
  assert.ok(cyl.solid.segments.some(s => s.id === 'O1O2' && s.styleMode === 'dashed'));
  assert.ok(cyl.solid.segments.some(s => s.id === 'AA1' && s.styleMode === 'solid'));

  // Sphere
  const sph = create3DPrimitive('sphere');
  assert.equal(sph.solid.type, 'sphere');
  assert.doesNotThrow(() => validateDocument(sph));
  assert.ok(sph.solid.points.some(p => p.id === 'O' && p.x === 0 && p.y === 0 && p.z === 0));
  assert.ok(sph.solid.points.some(p => p.id === 'M' && p.x === 1.8));
  assert.ok(sph.solid.segments.some(s => s.id === 'OM' && s.styleMode === 'dashed'));
});

test('createPlane3D and createParallel3D create valid entities', () => {
  const base = create3DPrimitive('box');
  
  // createPlane3D
  const withPlane = createPlane3D(base, ['A', 'B1', 'D1'], { color: '#3b82f6', opacity: 0.3 });
  assert.equal(withPlane.solid.planes.length, base.solid.planes.length + 1);
  const pl = withPlane.solid.planes[withPlane.solid.planes.length - 1];
  assert.deepEqual(pl.refs, ['A', 'B1', 'D1']);
  assert.equal(pl.color, '#3b82f6');
  assert.equal(pl.opacity, 0.3);
  assert.equal(pl.transparent, true);
  assert.doesNotThrow(() => validateDocument(withPlane));

  // createParallel3D: from point P through A, B
  const withParallel = createParallel3D(base, 'C1', ['A', 'B']);
  assert.doesNotThrow(() => validateDocument(withParallel));
  const newPt = withParallel.solid.points.find(p => p.kind === 'parallel');
  assert.ok(newPt);
  assert.deepEqual(newPt.refs, ['C1', 'A', 'B']);

  const { solidPoints, errors } = resolve(withParallel);
  assert.equal(errors.length, 0);
  const qCoord = solidPoints[newPt.id];
  const c1Coord = solidPoints['C1'];
  const aCoord = solidPoints['A'];
  const bCoord = solidPoints['B'];

  // Q - C1 must equal B - A
  const vecParallel = sub(qCoord, c1Coord);
  const vecBase = sub(bCoord, aCoord);
  assert.ok(norm3D(sub(vecParallel, vecBase)) < 1e-5, 'Parallel vector must equal base vector');
});

test('Occlusion Engine: transparent plane does NOT occlude segments behind it', () => {
  // Construct a scene with a segment behind a plane
  // Plane through (-2, -1, 0), (2, -1, 0), (0, 2, 0)
  // Segment from (0, 0, -2) to (0, 1, -2) which lies behind the plane
  const doc = {
    version: 1,
    title: 'Occlusion test',
    points: [],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['A'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 0,
      tilt: 0,
      points: [
        { id: 'P1', x: -2, y: -1, z: 0 },
        { id: 'P2', x: 2, y: -1, z: 0 },
        { id: 'P3', x: 0, y: 2, z: 0 },
        { id: 'K1', x: 0, y: 0, z: -2 },
        { id: 'K2', x: 0, y: 1, z: -2 }
      ],
      segments: [
        { id: 'test_seg', refs: ['K1', 'K2'] as [string, string], styleMode: 'auto' }
      ],
      planes: [
        { id: 'trans_plane', refs: ['P1', 'P2', 'P3'] as [string, string, string], transparent: true }
      ]
    }
  };

  const ptsMap: Record<string, any> = {};
  for (const p of doc.solid.points) ptsMap[p.id] = { x: p.x, y: p.y, z: p.z };
  const cam = { rotation: 0, tilt: 0 };

  // With transparent plane: segment should NOT be occluded
  const resultTransparent = compute3DOcclusion(doc.solid, cam);
  assert.ok(resultTransparent.solidSegmentIds.has('test_seg'), 'Segment behind transparent plane should be solid (visible)');
  assert.ok(!resultTransparent.dashedSegmentIds.has('test_seg'));

  // If plane is opaque (transparent: false), segment SHOULD be occluded
  const opaqueDoc = structuredClone(doc);
  opaqueDoc.solid.planes[0].transparent = false;
  const resultOpaque = compute3DOcclusion(opaqueDoc.solid, cam);
  assert.ok(resultOpaque.dashedSegmentIds.has('test_seg'), 'Segment behind opaque plane should be occluded (dashed)');
});

test('SVG Rendering: produces transparent plane polygon and curved solid outlines', () => {
  // Test solid.planes rendering
  const docPlane = createPlane3D(create3DPrimitive('box'), ['A', 'B', 'C1'], { id: 'test_plane_1', color: '#3b82f6', opacity: 0.25 });
  const svgPlane = solidSVG(docPlane.solid);
  assert.ok(svgPlane.includes('data-plane="test_plane_1"'), 'SVG must include data-plane attribute');
  assert.ok(svgPlane.includes('fill="#3b82f6"'), 'SVG must use plane color');
  assert.ok(svgPlane.includes('fill-opacity="0.25"'), 'SVG must use plane opacity');

  // Test cone SVG rendering
  const coneDoc = create3DPrimitive('cone');
  const svgCone = solidSVG(coneDoc.solid);
  assert.ok(svgCone.includes('data-cone-back="true"'), 'Cone SVG must include back dashed arc');
  assert.ok(svgCone.includes('data-cone-front="true"'), 'Cone SVG must include front solid arc');
  assert.ok(svgCone.includes('data-cone-generator="left"'), 'Cone SVG must include left generator line');
  assert.ok(svgCone.includes('data-cone-generator="right"'), 'Cone SVG must include right generator line');

  // Test cylinder SVG rendering
  const cylDoc = create3DPrimitive('cylinder');
  const svgCyl = solidSVG(cylDoc.solid);
  assert.ok(svgCyl.includes('data-cylinder-top="true"') || svgCyl.includes('data-cylinder-top-front="true"'), 'Cylinder SVG must include top base');
  assert.ok(svgCyl.includes('data-cylinder-bottom-back="true"') || svgCyl.includes('data-cylinder-bottom="true"'), 'Cylinder SVG must include bottom base');
  assert.ok(svgCyl.includes('data-cylinder-generator="left"'), 'Cylinder SVG must include left generator line');
  assert.ok(svgCyl.includes('data-cylinder-generator="right"'), 'Cylinder SVG must include right generator line');

  // Test sphere SVG rendering
  const sphDoc = create3DPrimitive('sphere');
  const svgSph = solidSVG(sphDoc.solid);
  assert.ok(svgSph.includes('data-sphere-silhouette="true"'), 'Sphere SVG must include silhouette circle');
  assert.ok(svgSph.includes('data-sphere-equator-back="true"'), 'Sphere SVG must include back equator arc');
  assert.ok(svgSph.includes('data-sphere-equator-front="true"'), 'Sphere SVG must include front equator arc');

  // Test data-segment-3d presence
  assert.ok(svgPlane.includes('data-segment-3d="'), 'SVG segments must have data-segment-3d attribute');
});
