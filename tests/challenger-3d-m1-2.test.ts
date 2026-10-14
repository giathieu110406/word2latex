import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDocument,
  resolve,
  construct,
  movePoint,
  removePoint,
  emptyDocument,
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

// ============================================================================
// SUITE 1: COMPLEX 3D DEPENDENCY CYCLES & INTERTWINED RELATIONSHIPS
// ============================================================================

test('Challenge 1.1: 3-point cycle (A -> B -> C -> A) in doc.points is rejected by validateDocument', () => {
  const cyclicDoc = {
    version: 1,
    title: '3-point cycle in doc.points',
    points: [
      { id: 'Orig', x: 0, y: 0, z: 0 },
      { id: 'A', kind: 'midpoint', refs: ['Orig', 'B'] },
      { id: 'B', kind: 'midpoint', refs: ['Orig', 'C'] },
      { id: 'C', kind: 'midpoint', refs: ['Orig', 'A'] }
    ],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: { type: 'custom', rotation: 0, tilt: 0 }
  };

  assert.throws(
    () => validateDocument(cyclicDoc),
    (err: any) => err.message.includes('Có chu trình phụ thuộc'),
    'Should throw "Có chu trình phụ thuộc"'
  );
});

test('Challenge 1.2: 5-point cycle in doc.solid.points is rejected by validateDocument', () => {
  const cyclicSolidDoc = {
    version: 1,
    title: '5-point cycle in solid.points',
    points: [{ id: 'Base', x: 1, y: 1, z: 1 }],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 0,
      tilt: 0,
      points: [
        { id: 'P1', kind: 'ratio', refs: ['Base', 'P2'], t: 0.5 },
        { id: 'P2', kind: 'ratio', refs: ['Base', 'P3'], t: 0.5 },
        { id: 'P3', kind: 'ratio', refs: ['Base', 'P4'], t: 0.5 },
        { id: 'P4', kind: 'ratio', refs: ['Base', 'P5'], t: 0.5 },
        { id: 'P5', kind: 'ratio', refs: ['Base', 'P1'], t: 0.5 }
      ]
    }
  };

  assert.throws(
    () => validateDocument(cyclicSolidDoc),
    (err: any) => err.message.includes('Có chu trình phụ thuộc'),
    'Should throw "Có chu trình phụ thuộc"'
  );
});

test('Challenge 1.3: Self-dependency (P depends on P) is rejected by validateDocument', () => {
  const selfDoc = {
    version: 1,
    title: 'Self-dependent point',
    points: [{ id: 'A', x: 0, y: 0, z: 0 }],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 0,
      tilt: 0,
      points: [
        { id: 'Loop', kind: 'midpoint', refs: ['A', 'Loop'] }
      ]
    }
  };

  assert.throws(
    () => validateDocument(selfDoc),
    (err: any) => err.message.includes('Có chu trình phụ thuộc'),
    'Should throw "Có chu trình phụ thuộc"'
  );
});

test('Challenge 1.4: Intertwined cycle across doc.points and doc.solid.points is rejected by validateDocument', () => {
  // P1 in doc.points refs S1 in doc.solid.points; S1 in doc.solid.points refs P1 in doc.points
  const crossCycleDoc = {
    version: 1,
    title: 'Intertwined cycle between points and solid.points',
    points: [
      { id: 'Origin', x: 0, y: 0, z: 0 },
      { id: 'P1', kind: 'midpoint', refs: ['Origin', 'S1'] }
    ],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 0,
      tilt: 0,
      points: [
        { id: 'S1', kind: 'midpoint', refs: ['Origin', 'P1'] }
      ]
    }
  };

  assert.throws(
    () => validateDocument(crossCycleDoc),
    (err: any) => err.message.includes('Có chu trình phụ thuộc'),
    'Cross-boundary cycle between doc.points and doc.solid.points must be detected'
  );
});

test('Challenge 1.5: Multi-hop intertwined cycle: P1 -> S1 -> P2 -> S2 -> P1', () => {
  const multiHopDoc = {
    version: 1,
    title: 'Multi-hop cross-boundary cycle',
    points: [
      { id: 'Origin', x: 0, y: 0, z: 0 },
      { id: 'P1', kind: 'midpoint', refs: ['Origin', 'S1'] },
      { id: 'P2', kind: 'midpoint', refs: ['Origin', 'S2'] }
    ],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 0,
      tilt: 0,
      points: [
        { id: 'S1', kind: 'midpoint', refs: ['Origin', 'P2'] },
        { id: 'S2', kind: 'midpoint', refs: ['Origin', 'P1'] }
      ]
    }
  };

  assert.throws(
    () => validateDocument(multiHopDoc),
    (err: any) => err.message.includes('Có chu trình phụ thuộc'),
    'Multi-hop cross-boundary cycle must be rejected'
  );
});

test('Challenge 1.6: Complex Diamond DAG across doc.points and doc.solid.points is NOT falsely detected as cycle', () => {
  // A(root) -> B(in points) & C(in solid.points) -> D(in solid.points refs B & C)
  const diamondDoc = {
    version: 1,
    title: 'Diamond DAG cross-boundary',
    points: [
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', kind: 'midpoint', refs: ['A', 'A'] }
    ],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 0,
      tilt: 0,
      points: [
        { id: 'C', kind: 'midpoint', refs: ['A', 'A'] },
        { id: 'D', kind: 'midpoint', refs: ['B', 'C'] }
      ]
    }
  };

  assert.doesNotThrow(() => validateDocument(diamondDoc), 'Valid diamond DAG must pass validation');
  const res = resolve(diamondDoc);
  assert.equal(res.errors.length, 0, 'Diamond DAG must resolve with 0 errors');
  assert.equal(res.points['D'].x, 0);
  assert.equal(res.points['D'].y, 0);
  assert.equal(res.points['D'].z, 0);
});

test('Challenge 1.7: Duplicate ID across doc.points and doc.solid.points is rejected', () => {
  const dupDoc = {
    version: 1,
    title: 'Duplicate ID across boundaries',
    points: [{ id: 'Shared', x: 0, y: 0, z: 0 }],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 0,
      tilt: 0,
      points: [{ id: 'Shared', x: 1, y: 1, z: 1 }]
    }
  };

  assert.throws(
    () => validateDocument(dupDoc),
    (err: any) => err.message.includes('ID điểm trùng hoặc không hợp lệ')
  );
});

// ============================================================================
// SUITE 2: IMMUTABILITY OF DATA STRUCTURES ACROSS CONTINUOUS 2D/3D EDITS
// ============================================================================

test('Challenge 2.1: movePoint and removePoint strictly do NOT mutate original document', () => {
  const original = {
    version: 1,
    title: 'Immutable Base',
    points: [
      { id: 'A', x: 1, y: 2 },
      { id: 'B', x: 3, y: 4, z: 5 },
      { id: 'M', kind: 'midpoint', refs: ['A', 'B'] }
    ],
    shapes: [
      { id: 'seg1', type: 'segment', refs: ['A', 'M'] }
    ],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 10,
      tilt: 20,
      points: [
        { id: 'S', x: 0, y: 0, z: 10 },
        { id: 'N', kind: 'midpoint', refs: ['B', 'S'] }
      ],
      segments: [
        { id: 's_BS', refs: ['B', 'S'] as [string, string], styleMode: 'auto' }
      ],
      planes: [
        { id: 'pl1', refs: ['A', 'B', 'S'] as [string, string, string], opacity: 0.5 }
      ],
      crossSections: [
        { id: 'cs1', planeRefs: ['A', 'B', 'S'] as [string, string, string], opacity: 0.3 }
      ]
    }
  };

  const copyBefore = structuredClone(original);

  // 1. movePoint on 2D point
  const moved2D = movePoint(original, 'A', 99, 99);
  assert.deepEqual(original, copyBefore, 'Original doc must remain unchanged after movePoint 2D');
  assert.equal(moved2D.points.find((p: any) => p.id === 'A').x, 99);
  assert.equal('z' in moved2D.points.find((p: any) => p.id === 'A'), false, '2D point move must not inject z');

  // 2. movePoint on 3D point in doc.points
  const moved3D = movePoint(original, 'B', 10, 20, 30);
  assert.deepEqual(original, copyBefore, 'Original doc must remain unchanged after movePoint 3D in points');
  assert.equal(moved3D.points.find((p: any) => p.id === 'B').z, 30);

  // 3. movePoint on 3D point in doc.solid.points
  const movedSolid = movePoint(original, 'S', 5, 5, 15);
  assert.deepEqual(original, copyBefore, 'Original doc must remain unchanged after movePoint on solid point');
  assert.equal(movedSolid.solid.points.find((p: any) => p.id === 'S').z, 15);

  // 4. removePoint on A (cascades M, seg1, pl1, cs1)
  const removedA = removePoint(original, 'A');
  assert.deepEqual(original, copyBefore, 'Original doc must remain unchanged after removePoint');
  assert.equal(removedA.points.some((p: any) => p.id === 'A'), false);
  assert.equal(removedA.points.some((p: any) => p.id === 'M'), false);
  assert.equal(removedA.shapes.some((s: any) => s.id === 'seg1'), false);
  assert.equal(removedA.solid.planes.some((p: any) => p.id === 'pl1'), false);
  assert.equal(removedA.solid.crossSections.some((cs: any) => cs.id === 'cs1'), false);
  assert.equal(removedA.solid.points.some((p: any) => p.id === 'S'), true);
});

test('Challenge 2.2: 50 consecutive movePoint calls maintain snapshot immutability at each step', () => {
  let doc = {
    version: 1,
    title: 'Stress Move History',
    points: [{ id: 'P2D', x: 0, y: 0 }],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 0,
      tilt: 0,
      points: [{ id: 'P3D', x: 0, y: 0, z: 0 }]
    }
  };

  const history: any[] = [structuredClone(doc)];

  for (let i = 1; i <= 50; i++) {
    // Alternating moves between 2D and 3D
    if (i % 2 === 0) {
      doc = movePoint(doc, 'P2D', i, i * 2);
    } else {
      doc = movePoint(doc, 'P3D', i, -i, i * 3);
    }
    history.push(structuredClone(doc));
  }

  assert.equal(history.length, 51);

  // Verify that every history snapshot is distinct and frozen in time
  for (let i = 0; i < history.length; i++) {
    if (i === 0) {
      assert.equal(history[0].points[0].x, 0);
      assert.equal(history[0].solid.points[0].x, 0);
    } else if (i % 2 === 0) {
      assert.equal(history[i].points[0].x, i);
      assert.equal(history[i].points[0].y, i * 2);
    } else {
      assert.equal(history[i].solid.points[0].x, i);
      assert.equal(history[i].solid.points[0].y, -i);
      assert.equal(history[i].solid.points[0].z, i * 3);
    }
  }
});

test('Challenge 2.3: Cascading removal across deep dependency chains and 2D/3D boundaries', () => {
  // Chain:
  // Root A (points)
  //   -> B (points, midpoint of A, A)
  //   -> S1 (solid.points, ratio of A, B)
  //   -> S2 (solid.points, midpoint of S1, S1)
  //   -> C (points, midpoint of S2, S2)
  //   -> Seg1 (solid.segments refs S1, S2)
  //   -> Plane1 (solid.planes refs A, S1, S2)
  //   -> CrossSec1 (solid.crossSections refs B, S1, S2)
  //   -> ShapeSeg (shapes refs B, C)
  // Unrelated:
  //   X (points), Y (solid.points), SegXY (solid.segments refs X, Y)
  const complexDoc = {
    version: 1,
    title: 'Deep cascade test',
    points: [
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', kind: 'midpoint', refs: ['A', 'A'] },
      { id: 'C', kind: 'midpoint', refs: ['S2', 'S2'] },
      { id: 'X', x: 10, y: 10, z: 10 }
    ],
    shapes: [
      { id: 'shapeBC', type: 'segment', refs: ['B', 'C'] }
    ],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 0,
      tilt: 0,
      points: [
        { id: 'S1', kind: 'ratio', refs: ['A', 'B'], t: 0.5 },
        { id: 'S2', kind: 'midpoint', refs: ['S1', 'S1'] },
        { id: 'Y', x: 20, y: 20, z: 20 }
      ],
      segments: [
        { id: 'segS1S2', refs: ['S1', 'S2'] as [string, string] },
        { id: 'segXY', refs: ['X', 'Y'] as [string, string] }
      ],
      planes: [
        { id: 'pl1', refs: ['A', 'S1', 'S2'] as [string, string, string] }
      ],
      crossSections: [
        { id: 'cs1', planeRefs: ['B', 'S1', 'S2'] as [string, string, string] }
      ]
    }
  };

  const snapshotBefore = structuredClone(complexDoc);

  // Removing A must cascade delete: A, B, S1, S2, C, shapeBC, segS1S2, pl1, cs1
  const afterRemoval = removePoint(complexDoc, 'A');

  // Verify original unchanged
  assert.deepEqual(complexDoc, snapshotBefore);

  // Verify removed items
  const pointIds = afterRemoval.points.map((p: any) => p.id);
  const solidPointIds = afterRemoval.solid.points.map((p: any) => p.id);
  const shapeIds = afterRemoval.shapes.map((s: any) => s.id);
  const segmentIds = afterRemoval.solid.segments.map((s: any) => s.id);

  assert.deepEqual(pointIds, ['X']);
  assert.deepEqual(solidPointIds, ['Y']);
  assert.deepEqual(shapeIds, []);
  assert.deepEqual(segmentIds, ['segXY']);
  assert.deepEqual(afterRemoval.solid.planes, []);
  assert.deepEqual(afterRemoval.solid.crossSections, []);

  // Document after removal must be completely valid and resolvable
  assert.doesNotThrow(() => validateDocument(afterRemoval));
  const res = resolve(afterRemoval);
  assert.equal(res.errors.length, 0);
  assert.equal(res.points['X'].x, 10);
  assert.equal(res.solidPoints['Y'].x, 20);
});

// ============================================================================
// SUITE 3: RESOLVE INTEGRITY — NO UNHANDLED THROWS & PROPER ERROR RECORDING
// ============================================================================

test('Challenge 3.1: Geometric degeneracy in 3D foot (collinear plane points) records error, does not throw', () => {
  // 3 collinear points for plane: (0,0,0), (1,1,1), (2,2,2)
  const doc = {
    version: 1,
    title: 'Collinear foot',
    points: [
      { id: 'S', x: 0, y: 0, z: 5 },
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', x: 1, y: 1, z: 1 },
      { id: 'C', x: 2, y: 2, z: 2 },
      { id: 'H', kind: 'foot', refs: ['S', 'A', 'B', 'C'] }
    ],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: { type: 'custom', rotation: 0, tilt: 0 }
  };

  assert.doesNotThrow(() => {
    const res = resolve(doc);
    assert.equal(res.errors.length, 1);
    assert.match(res.errors[0], /H: Ba điểm mặt phẳng thẳng hàng \/ trùng nhau/);
    assert.equal(res.points['H'], undefined);
  });
});

test('Challenge 3.2: planeLineIntersection parallel or lying on plane records error, does not throw', () => {
  // Plane z = 0, line from (0,0,1) to (1,0,1) is parallel to plane
  const doc = {
    version: 1,
    title: 'Parallel line to plane',
    points: [
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', x: 1, y: 0, z: 0 },
      { id: 'C', x: 0, y: 1, z: 0 },
      { id: 'D', x: 0, y: 0, z: 1 },
      { id: 'E', x: 1, y: 0, z: 1 },
      { id: 'I', kind: 'planeLineIntersection', refs: ['A', 'B', 'C', 'D', 'E'] }
    ],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: { type: 'custom', rotation: 0, tilt: 0 }
  };

  assert.doesNotThrow(() => {
    const res = resolve(doc);
    assert.equal(res.errors.length, 1);
    assert.match(res.errors[0], /I: Đường thẳng song song hoặc nằm trên mặt phẳng/);
  });
});

test('Challenge 3.3: Missing references record errors without unhandled crash', () => {
  const doc = {
    version: 1,
    title: 'Missing refs in dependent point',
    points: [
      { id: 'M', kind: 'midpoint', refs: ['GHOST_1', 'GHOST_2'] }
    ],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: { type: 'custom', rotation: 0, tilt: 0 }
  };

  assert.doesNotThrow(() => {
    const res = resolve(doc);
    assert.equal(res.errors.length, 1);
    assert.match(res.errors[0], /M: Thiếu điểm GHOST_/);
  });
});

test('Challenge 3.4: Cascading resolution failure across multiple points without crash', () => {
  // P1 fails because of missing ref
  // P2 depends on P1 -> must also fail gracefully
  // P3 depends on P2 -> must also fail gracefully
  // Seg refs P3 and valid point A -> must record missing segment source
  const doc = {
    version: 1,
    title: 'Cascading resolution failure',
    points: [
      { id: 'A', x: 1, y: 2, z: 3 },
      { id: 'P1', kind: 'midpoint', refs: ['NON_EXISTENT', 'A'] },
      { id: 'P2', kind: 'midpoint', refs: ['P1', 'A'] },
      { id: 'P3', kind: 'midpoint', refs: ['P2', 'A'] }
    ],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 0,
      tilt: 0,
      segments: [
        { id: 'segP3A', refs: ['P3', 'A'] as [string, string] }
      ]
    }
  };

  assert.doesNotThrow(() => {
    const res = resolve(doc);
    assert.equal(res.points['A'] !== undefined, true);
    assert.equal(res.points['P1'], undefined);
    assert.equal(res.points['P2'], undefined);
    assert.equal(res.points['P3'], undefined);

    // All errors are captured
    assert.equal(res.errors.length >= 4, true);
    assert.equal(res.errors.some((e: string) => e.includes('P1: Thiếu điểm NON_EXISTENT')), true);
    assert.equal(res.errors.some((e: string) => e.includes('P2: Nguồn P1 không xác định')), true);
    assert.equal(res.errors.some((e: string) => e.includes('P3: Nguồn P2 không xác định')), true);
    assert.equal(res.errors.some((e: string) => e.includes('segP3A: Nguồn của đoạn thẳng không xác định')), true);
  });
});

test('Challenge 3.5: Cyclic document passed directly to resolve does NOT cause stack overflow or throw', () => {
  // Direct cycle passed straight into resolve()
  const cyclicDoc = {
    points: [
      { id: 'C1', kind: 'midpoint', refs: ['C2', 'C2'] },
      { id: 'C2', kind: 'midpoint', refs: ['C3', 'C3'] },
      { id: 'C3', kind: 'midpoint', refs: ['C1', 'C1'] }
    ]
  };

  assert.doesNotThrow(() => {
    const res = resolve(cyclicDoc as any);
    assert.equal(res.errors.length, 3);
    assert.equal(res.errors.some((e: string) => e.includes('Chu trình')), true);
  });
});

test('Challenge 3.6: Degenerate 3D segments (zero length) record errors gracefully', () => {
  const doc = {
    version: 1,
    title: 'Zero length segment',
    points: [
      { id: 'A', x: 1, y: 2, z: 3 },
      { id: 'B', x: 1, y: 2, z: 3 } // identical to A
    ],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 0,
      tilt: 0,
      segments: [
        { id: 'zeroSeg', refs: ['A', 'B'] as [string, string] }
      ]
    }
  };

  assert.doesNotThrow(() => {
    const res = resolve(doc);
    assert.equal(res.errors.length, 1);
    assert.match(res.errors[0], /zeroSeg: Hai điểm trùng nhau, đối tượng suy biến/);
  });
});

test('Challenge 3.7: Coordinate out of bounds (> 1e6 or NaN) records error, does not throw', () => {
  const doc = {
    version: 1,
    title: 'Out of bounds',
    points: [
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', x: 100, y: 100, z: 100 },
      { id: 'P_huge', kind: 'ratio', refs: ['A', 'B'], t: 1e5 } // result 1e7 > 1e6 limit
    ],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: { type: 'custom', rotation: 0, tilt: 0 }
  };

  assert.doesNotThrow(() => {
    const res = resolve(doc);
    assert.equal(res.errors.length, 1);
    assert.match(res.errors[0], /P_huge: Tọa độ ngoài giới hạn/);
  });
});

// ============================================================================
// SUITE 4: EXTREME SCALE & DYNAMIC MIXED WORKLOADS
// ============================================================================

test('Challenge 4.1: Deep 200-level dependency chain across 2D/3D does not exceed call stack or crash', () => {
  // Chain: P0 -> P1 -> P2 -> ... -> P199
  const points: any[] = [{ id: 'P0', x: 0, y: 0, z: 0 }];
  for (let i = 1; i < 200; i++) {
    // Alternate between doc.points and solid.points
    points.push({
      id: `P${i}`,
      kind: 'ratio',
      refs: [`P${i - 1}`, `P${i - 1}`],
      t: 1 // P_i = P_{i-1}
    });
  }

  const doc = {
    version: 1,
    title: 'Deep 200 chain',
    points: points.slice(0, 100),
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: {
      type: 'custom',
      rotation: 0,
      tilt: 0,
      points: points.slice(100)
    }
  };

  assert.doesNotThrow(() => validateDocument(doc));
  const res = resolve(doc);
  assert.equal(res.errors.length, 0);
  assert.equal(res.points['P99'].x, 0);
  assert.equal(res.solidPoints['P199'].x, 0);
});

test('Challenge 4.2: Mixed 2D and 3D vector arithmetic operates symmetrically and safely', () => {
  const v2D = { x: 3, y: 4 };
  const v3D = { x: 1, y: 2, z: 5 };

  // add
  const sum1 = add(v2D, v3D);
  assert.deepEqual(sum1, { x: 4, y: 6, z: 5 });
  const sum2 = add(v3D, v2D);
  assert.deepEqual(sum2, { x: 4, y: 6, z: 5 });

  // sub
  const diff1 = sub(v3D, v2D);
  assert.deepEqual(diff1, { x: -2, y: -2, z: 5 });
  const diff2 = sub(v2D, v3D);
  assert.deepEqual(diff2, { x: 2, y: 2, z: -5 });

  // dot
  const d1 = dot(v2D, v3D);
  assert.equal(d1, 3 * 1 + 4 * 2 + 0 * 5); // 11
  const d2 = dot(v3D, v2D);
  assert.equal(d2, 11);

  // cross
  const c1 = cross(v2D, v3D);
  assert.deepEqual(c1, { x: 4 * 5 - 0 * 2, y: 0 * 1 - 3 * 5, z: 3 * 2 - 4 * 1 });
  assert.deepEqual(c1, { x: 20, y: -15, z: 2 });
});

test('Challenge 4.3: movePoint updates 3D onLine points projection correctly', () => {
  const doc = {
    version: 1,
    title: '3D onLine move',
    points: [
      { id: 'A', x: 0, y: 0, z: 0 },
      { id: 'B', x: 10, y: 0, z: 0 },
      { id: 'P', kind: 'onLine', refs: ['A', 'B'], t: 0.2 }
    ],
    shapes: [],
    graph: { expressions: [], params: [] },
    chart: { type: 'bar', labels: ['X'], values: [1] },
    solid: { type: 'custom', rotation: 0, tilt: 0 }
  };

  // Move P to (7, 5, 5) -> projection onto AB (along x-axis) should have t = 0.7
  const moved = movePoint(doc, 'P', 7, 5, 5);
  const pMoved = moved.points.find((p: any) => p.id === 'P');
  assert.equal(Math.abs(pMoved.t - 0.7) < 1e-6, true);

  const res = resolve(moved);
  assert.equal(res.errors.length, 0);
  assert.equal(Math.abs(res.points['P'].x - 7) < 1e-6, true);
  assert.equal(Math.abs(res.points['P'].y - 0) < 1e-6, true);
});

