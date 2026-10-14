import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDocument,
  resolve,
  construct,
  movePoint,
  removePoint,
  triangleTemplate,
  add,
  sub,
  mul,
  dot,
  cross,
  cross3D,
  norm,
  norm3D,
  unit
} from '../public/ve-hinh/src/math.js';

test('Vector 3D operations: add, sub, mul, dot, cross, norm, unit', () => {
  const v1 = { x: 1, y: 2, z: 3 };
  const v2 = { x: 4, y: 5, z: 6 };

  // add
  const sum = add(v1, v2);
  assert.deepEqual(sum, { x: 5, y: 7, z: 9 });

  // sub
  const diff = sub(v2, v1);
  assert.deepEqual(diff, { x: 3, y: 3, z: 3 });

  // mul
  const scaled = mul(v1, 2);
  assert.deepEqual(scaled, { x: 2, y: 4, z: 6 });

  // dot
  const d = dot(v1, v2); // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
  assert.equal(d, 32);

  // cross3D: (1, 0, 0) x (0, 1, 0) = (0, 0, 1)
  const cx = cross3D({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  assert.deepEqual(cx, { x: 0, y: 0, z: 1 });

  // cross with 3D points
  const cx2 = cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  assert.deepEqual(cx2, { x: 0, y: 0, z: 1 });

  // cross with 2D points (returns scalar)
  const cx2d = cross({ x: 1, y: 0 }, { x: 0, y: 1 });
  assert.equal(cx2d, 1);

  // norm3D & norm
  const len = norm3D({ x: 2, y: 3, z: 6 }); // sqrt(4+9+36) = 7
  assert.equal(len, 7);
  assert.equal(norm({ x: 2, y: 3, z: 6 }), 7);

  // unit 3D
  const u = unit({ x: 0, y: 0, z: 5 });
  assert.deepEqual(u, { x: 0, y: 0, z: 1 });
});

test('Vector 2D operations preserve clean 2D objects without z', () => {
  const p1 = { x: 1, y: 2 };
  const p2 = { x: 3, y: 4 };
  const sum = add(p1, p2);
  assert.equal(sum.x, 4);
  assert.equal(sum.y, 6);
  assert.equal('z' in sum, false);

  const diff = sub(p2, p1);
  assert.equal(diff.x, 2);
  assert.equal(diff.y, 2);
  assert.equal('z' in diff, false);

  const scaled = mul(p1, 3);
  assert.equal(scaled.x, 3);
  assert.equal(scaled.y, 6);
  assert.equal('z' in scaled, false);
});

test('validateDocument accepts valid free 3D points and rejects invalid z coordinates', () => {
  const validDoc = {
    version: 1,
    title: '3D Test',
    points: [
      { id: 'S', x: -2, y: -2, z: 4, label: 'S' },
      { id: 'A', x: -2, y: -2, z: 0, label: 'A' },
      { id: 'B', x: 2, y: -2, z: 0, label: 'B' }
    ],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['A'], values: [1] },
    solid: { type: 'custom', rotation: 30, tilt: 20 }
  };
  assert.doesNotThrow(() => validateDocument(validDoc));

  // Reject NaN z
  const nanDoc = structuredClone(validDoc);
  nanDoc.points[0].z = NaN;
  assert.throws(() => validateDocument(nanDoc), /Tọa độ z không hợp lệ/);

  // Reject Infinity z
  const infDoc = structuredClone(validDoc);
  infDoc.points[0].z = Infinity;
  assert.throws(() => validateDocument(infDoc), /Tọa độ z không hợp lệ/);

  // Reject extreme z beyond 1e6
  const bigDoc = structuredClone(validDoc);
  bigDoc.points[0].z = 2e6;
  assert.throws(() => validateDocument(bigDoc), /Tọa độ z không hợp lệ/);
});

test('3D midpoint calculation: S(-2, -2, 4) and C(2, 2, 0) -> M(0, 0, 2)', () => {
  const S = { id: 'S', x: -2, y: -2, z: 4 };
  const C = { id: 'C', x: 2, y: 2, z: 0 };
  const pM = { id: 'M', kind: 'midpoint', refs: ['S', 'C'] };

  const M = construct(pM, [S, C]);
  assert.equal(M.x, 0);
  assert.equal(M.y, 0);
  assert.equal(M.z, 2);

  // Full document resolution
  const doc = {
    version: 1,
    title: 'Chóp S.ABCD và trung điểm M',
    points: [S, C, pM],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['A'], values: [1] },
    solid: { type: 'custom', rotation: 30, tilt: 20 }
  };
  validateDocument(doc);
  const { points, errors } = resolve(doc);
  assert.equal(errors.length, 0);
  assert.equal(points['M'].x, 0);
  assert.equal(points['M'].y, 0);
  assert.equal(points['M'].z, 2);
});

test('3D ratio calculation: t = 0.5, t = 1/3, t = 0, t = 1, t = -0.5, t = 1.5', () => {
  const A = { id: 'A', x: 0, y: 0, z: 0 };
  const B = { id: 'B', x: 6, y: 3, z: 9 };

  // t = 0.5
  const res05 = construct({ id: 'P1', kind: 'ratio', refs: ['A', 'B'], t: 0.5 }, [A, B]);
  assert.deepEqual(res05, { x: 3, y: 1.5, z: 4.5 });

  // t = 1/3
  const resThird = construct({ id: 'P2', kind: 'ratio', refs: ['A', 'B'], t: 1/3 }, [A, B]);
  assert.equal(Math.abs(resThird.x - 2) < 1e-6, true);
  assert.equal(Math.abs(resThird.y - 1) < 1e-6, true);
  assert.equal(Math.abs(resThird.z - 3) < 1e-6, true);

  // t = 0
  const res0 = construct({ id: 'P3', kind: 'ratio', refs: ['A', 'B'], t: 0 }, [A, B]);
  assert.deepEqual(res0, { x: 0, y: 0, z: 0 });

  // t = 1
  const res1 = construct({ id: 'P4', kind: 'ratio', refs: ['A', 'B'], t: 1 }, [A, B]);
  assert.deepEqual(res1, { x: 6, y: 3, z: 9 });

  // t = -0.5
  const resNeg = construct({ id: 'P5', kind: 'ratio', refs: ['A', 'B'], t: -0.5 }, [A, B]);
  assert.deepEqual(resNeg, { x: -3, y: -1.5, z: -4.5 });

  // t = 1.5
  const resExt = construct({ id: 'P6', kind: 'ratio', refs: ['A', 'B'], t: 1.5 }, [A, B]);
  assert.deepEqual(resExt, { x: 9, y: 4.5, z: 13.5 });
});

test('3D altitude foot: SA perpendicular to (ABCD) with A(-2, -2, 0), S(-2, -2, 4)', () => {
  const S = { id: 'S', x: -2, y: -2, z: 4 };
  const A = { id: 'A', x: -2, y: -2, z: 0 };
  const B = { id: 'B', x: 2, y: -2, z: 0 };
  const C = { id: 'C', x: 2, y: 2, z: 0 };

  // Drop S onto plane (ABC) using 4 refs [S, A, B, C]
  const footPlane = construct({ id: 'H', kind: 'foot', refs: ['S', 'A', 'B', 'C'] }, [S, A, B, C]);
  assert.equal(Math.abs(footPlane.x - (-2)) < 1e-6, true);
  assert.equal(Math.abs(footPlane.y - (-2)) < 1e-6, true);
  assert.equal(Math.abs(footPlane.z - 0) < 1e-6, true);

  // Drop S onto line AB using 3 refs [S, A, B]
  const footLine = construct({ id: 'H_AB', kind: 'foot', refs: ['S', 'A', 'B'] }, [S, A, B]);
  assert.equal(Math.abs(footLine.x - (-2)) < 1e-6, true);
  assert.equal(Math.abs(footLine.y - (-2)) < 1e-6, true);
  assert.equal(Math.abs(footLine.z - 0) < 1e-6, true);

  // Full document resolve
  const doc = {
    version: 1,
    title: 'Foot test',
    points: [S, A, B, C, { id: 'H', kind: 'foot', refs: ['S', 'A', 'B', 'C'] }],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['A'], values: [1] },
    solid: { type: 'custom', rotation: 30, tilt: 20 }
  };
  validateDocument(doc);
  const { points, errors } = resolve(doc);
  assert.equal(errors.length, 0);
  assert.equal(Math.round(points['H'].x), -2);
  assert.equal(Math.round(points['H'].y), -2);
  assert.equal(Math.round(points['H'].z), 0);
});

test('3D centroid calculation for triangle', () => {
  const A = { id: 'A', x: 0, y: 0, z: 0 };
  const B = { id: 'B', x: 3, y: 0, z: 0 };
  const C = { id: 'C', x: 0, y: 3, z: 3 };

  const G = construct({ id: 'G', kind: 'centroid', refs: ['A', 'B', 'C'] }, [A, B, C]);
  assert.equal(Math.round(G.x), 1);
  assert.equal(Math.round(G.y), 1);
  assert.equal(Math.round(G.z), 1);
});

test('3D planeLineIntersection calculation', () => {
  // Plane z = 0 through (0,0,0), (1,0,0), (0,1,0)
  const A = { id: 'A', x: 0, y: 0, z: 0 };
  const B = { id: 'B', x: 1, y: 0, z: 0 };
  const C = { id: 'C', x: 0, y: 1, z: 0 };
  // Line through D(2, 3, 4) and E(2, 3, -1)
  const D = { id: 'D', x: 2, y: 3, z: 4 };
  const E = { id: 'E', x: 2, y: 3, z: -1 };

  const I = construct({ id: 'I', kind: 'planeLineIntersection', refs: ['A', 'B', 'C', 'D', 'E'] }, [A, B, C, D, E]);
  assert.equal(Math.round(I.x), 2);
  assert.equal(Math.round(I.y), 3);
  assert.equal(Math.round(I.z), 0);
});

test('3D segments support styleMode: auto, solid, dashed and validation', () => {
  const doc = {
    version: 1,
    title: '3D Segments Test',
    points: [],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['A'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'S', x: 0, y: 0, z: 4 },
        { id: 'A', x: -2, y: -2, z: 0 },
        { id: 'B', x: 2, y: -2, z: 0 }
      ],
      segments: [
        { id: 'e1', refs: ['S', 'A'] as [string, string], styleMode: 'auto', color: '#176b52' },
        { id: 'e2', refs: ['S', 'B'] as [string, string], styleMode: 'solid', color: '#176b52' },
        { id: 'e3', refs: ['A', 'B'] as [string, string], styleMode: 'dashed', color: '#d09232' }
      ]
    }
  };

  assert.doesNotThrow(() => validateDocument(doc));
  const { points, solidPoints, errors } = resolve(doc);
  assert.equal(errors.length, 0);
  assert.equal(Boolean(solidPoints['S']), true);
  assert.equal(Boolean(points['S']), true);

  // Reject invalid styleMode
  const invalidModeDoc = structuredClone(doc);
  (invalidModeDoc.solid.segments![0] as any).styleMode = 'zigzag';
  assert.throws(() => validateDocument(invalidModeDoc), /Chế độ nét không hợp lệ/);

  // Reject missing ref in segment
  const missingRefDoc = structuredClone(doc);
  missingRefDoc.solid.segments![0].refs = ['S', 'Z_NONEXISTENT'];
  assert.throws(() => validateDocument(missingRefDoc), /Tham chiếu đoạn thẳng 3D không hợp lệ/);
});

test('3D planes and crossSections validation', () => {
  const doc = {
    version: 1,
    title: 'Planes and CrossSections',
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
        { id: 'B', x: 2, y: 0, z: 0 },
        { id: 'C', x: 0, y: 2, z: 0 }
      ],
      planes: [
        { id: 'p1', refs: ['A', 'B', 'C'] as [string, string, string], color: '#176b52', opacity: 0.4 }
      ],
      crossSections: [
        { id: 'cs1', planeRefs: ['A', 'B', 'C'] as [string, string, string], color: '#dfac48', opacity: 0.3 }
      ]
    }
  };

  assert.doesNotThrow(() => validateDocument(doc));

  // Reject invalid opacity
  const badOpacityDoc = structuredClone(doc);
  badOpacityDoc.solid.planes![0].opacity = 1.5;
  assert.throws(() => validateDocument(badOpacityDoc), /Độ mờ mặt phẳng không hợp lệ/);
});

test('Cycle detection in 3D dependent points', () => {
  // Direct cycle: P1 depends on P2, P2 depends on P1
  const cyclicDoc = {
    version: 1,
    title: 'Cyclic 3D',
    points: [
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'P1', kind: 'midpoint', refs: ['A', 'P2'] },
      { id: 'P2', kind: 'midpoint', refs: ['A', 'P1'] }
    ],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['A'], values: [1] },
    solid: { type: 'custom', rotation: 30, tilt: 20 }
  };
  assert.throws(() => validateDocument(cyclicDoc), /Có chu trình phụ thuộc/);

  // Cycle inside solid.points
  const cyclicSolidDoc = {
    version: 1,
    title: 'Cyclic Solid 3D',
    points: [{ id: 'A', x: 0, y: 0, z: 0 }],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['A'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'M1', kind: 'ratio', refs: ['A', 'M2'], t: 0.5 },
        { id: 'M2', kind: 'ratio', refs: ['A', 'M1'], t: 0.5 }
      ]
    }
  };
  assert.throws(() => validateDocument(cyclicSolidDoc), /Có chu trình phụ thuộc/);
});

test('Backward compatibility: 2D documents remain completely unaffected', () => {
  const d2d = triangleTemplate();
  assert.doesNotThrow(() => validateDocument(d2d));
  const res = resolve(d2d);
  assert.equal(res.errors.length, 0);

  // Verify points in 2D triangle template
  assert.equal(res.points['A'].x, -3);
  assert.equal(res.points['A'].y, -2);
  assert.equal(res.points['B'].x, 4);
  assert.equal(res.points['B'].y, -2);
  assert.equal(res.points['C'].x, 0);
  assert.equal(res.points['C'].y, 3);
  // Midpoint M of AB: (-3 + 4)/2 = 0.5, (-2 + -2)/2 = -2
  assert.equal(res.points['M'].x, 0.5);
  assert.equal(res.points['M'].y, -2);
  assert.equal('z' in res.points['M'], false);

  // Foot H of C onto AB: x = 0, y = -2
  assert.equal(res.points['H'].x, 0);
  assert.equal(res.points['H'].y, -2);
  assert.equal('z' in res.points['H'], false);
});

test('movePoint and removePoint with 3D entities', () => {
  const doc = {
    version: 1,
    title: 'Edit 3D',
    points: [
      { id: 'S', x: 0, y: 0, z: 4 },
      { id: 'A', x: -2, y: -2, z: 0 },
      { id: 'M', kind: 'midpoint', refs: ['S', 'A'] }
    ],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['A'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'B', x: 2, y: -2, z: 0 }
      ],
      segments: [
        { id: 'e_SB', refs: ['S', 'B'] as [string, string], styleMode: 'solid' }
      ]
    }
  };

  // Move 3D point
  const moved = movePoint(doc, 'S', 0, 0, 6);
  assert.equal(moved.points.find((p: any) => p.id === 'S').z, 6);

  // Remove point S: cascades M (refs S) and e_SB (refs S)
  const removed = removePoint(doc, 'S');
  assert.equal(removed.points.some((p: any) => p.id === 'S'), false);
  assert.equal(removed.points.some((p: any) => p.id === 'M'), false);
  assert.equal(removed.solid.segments.some((s: any) => s.id === 'e_SB'), false);
  assert.equal(removed.solid.points.some((p: any) => p.id === 'B'), true);
});
