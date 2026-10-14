import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseProposal,
  constructVietnamese3DProposal,
  getDrawingProviderConfig,
  createDrawingHandler
} from '../api/ve-hinh.js';

import {
  validateDocument,
  resolve,
  norm3D,
  sub
} from '../public/ve-hinh/src/math.js';

import { getAiUsageDay } from '../shared/ai-usage-policy.js';

test('AI 3D Benchmark: Cho hình chóp S.ABCD đáy ABCD là hình vuông, SA vuông góc đáy, M là trung điểm SC', () => {
  const prompt = 'Cho hình chóp S.ABCD có đáy ABCD là hình vuông, SA vuông góc với đáy, M là trung điểm SC, đoạn thẳng AM';

  const proposal = constructVietnamese3DProposal(prompt);
  assert.ok(proposal, 'Should recognize benchmark 3D prompt');
  assert.equal(proposal.document.solid.enabled, true);
  assert.equal(proposal.document.solid.type, 'pyramid');

  // Verify parseProposal accepts the constructed proposal JSON
  const parsed = parseProposal(JSON.stringify(proposal));
  const doc = parsed.document;
  assert.ok(doc.solid);
  assert.equal(doc.solid.enabled, true);

  // 1. Verify Points: S, A, B, C, D, M
  const pts = doc.solid.points;
  const pointIds = pts.map((p: any) => p.id);
  assert.ok(pointIds.includes('S'), 'Missing apex S');
  assert.ok(pointIds.includes('A'), 'Missing base vertex A');
  assert.ok(pointIds.includes('B'), 'Missing base vertex B');
  assert.ok(pointIds.includes('C'), 'Missing base vertex C');
  assert.ok(pointIds.includes('D'), 'Missing base vertex D');
  assert.ok(pointIds.includes('M'), 'Missing midpoint M');

  // 2. Verify SA perpendicular to base (ABCD): x_S = x_A, z_S = z_A, y_S > y_A
  const ptS = pts.find((p: any) => p.id === 'S');
  const ptA = pts.find((p: any) => p.id === 'A');
  assert.equal(ptS.x, ptA.x, 'S and A must have same x');
  assert.equal(ptS.z, ptA.z, 'S and A must have same z');
  assert.ok(ptS.y > ptA.y, 'Apex S must be above A');

  // 3. Verify M is midpoint of SC
  const ptM = pts.find((p: any) => p.id === 'M');
  assert.equal(ptM.kind, 'midpoint');
  assert.deepEqual(ptM.refs.sort(), ['C', 'S']);

  // 4. Verify Edges: base edges (AB, BC, CD, DA), lateral edges (SA, SB, SC, SD), and segment AM
  const segs = doc.solid.segments;
  const hasEdge = (p1: string, p2: string) =>
    segs.some((s: any) =>
      (s.refs[0] === p1 && s.refs[1] === p2) || (s.refs[0] === p2 && s.refs[1] === p1)
    );

  assert.ok(hasEdge('A', 'B'), 'Missing edge AB');
  assert.ok(hasEdge('B', 'C'), 'Missing edge BC');
  assert.ok(hasEdge('C', 'D'), 'Missing edge CD');
  assert.ok(hasEdge('D', 'A'), 'Missing edge DA');
  assert.ok(hasEdge('S', 'A'), 'Missing edge SA');
  assert.ok(hasEdge('S', 'B'), 'Missing edge SB');
  assert.ok(hasEdge('S', 'C'), 'Missing edge SC');
  assert.ok(hasEdge('S', 'D'), 'Missing edge SD');
  assert.ok(hasEdge('A', 'M'), 'Missing auxiliary segment AM');

  // 5. Verify resolve: all points resolve to finite coordinates without errors
  const res = resolve(doc);
  assert.equal(res.errors.length, 0, 'Document must resolve with 0 errors');
  const resolvedM = res.points['M'];
  const resolvedS = res.points['S'];
  const resolvedC = res.points['C'];
  assert.ok(resolvedM && resolvedS && resolvedC);
  assert.ok(Math.abs(resolvedM.x - (resolvedS.x + resolvedC.x) / 2) < 1e-4);
  assert.ok(Math.abs(resolvedM.y - (resolvedS.y + resolvedC.y) / 2) < 1e-4);
  assert.ok(Math.abs(resolvedM.z - (resolvedS.z + resolvedC.z) / 2) < 1e-4);
});

test('parseProposal: robustly handles markdown code fences and conversational preamble', () => {
  const benchmarkProposal = constructVietnamese3DProposal('Cho hình chóp S.ABCD đáy ABCD là hình vuông, SA vuông góc đáy, M là trung điểm SC, đoạn AM');
  const rawJSON = JSON.stringify(benchmarkProposal);

  // Case 1: Markdown codeblock ```json ... ```
  const fenced = `\`\`\`json\n${rawJSON}\n\`\`\``;
  const parsed1 = parseProposal(fenced);
  assert.equal(parsed1.document.solid?.points?.length, 6);

  // Case 2: Preamble and postamble text
  const wrapped = `Dưới đây là kết quả dựng hình không gian chóp S.ABCD:\n\`\`\`json\n${rawJSON}\n\`\`\`\nChúc bạn thành công!`;
  const parsed2 = parseProposal(wrapped);
  assert.equal(parsed2.document.solid?.points?.length, 6);

  // Case 3: Raw JSON without fences with text around
  const surrounded = `Một số lưu ý: ${rawJSON} Hết.`;
  const parsed3 = parseProposal(surrounded);
  assert.equal(parsed3.document.solid?.points?.length, 6);
});

test('parseProposal: normalizes 3D solid types and clamps tilt to [-80, 80]', () => {
  const json = JSON.stringify({
    document: {
      version: 1,
      title: 'Khối 3D',
      points: [],
      shapes: [],
      solid: {
        type: 'chop_tu_giac', // Non-standard name should normalize to pyramid
        rotation: 400,
        tilt: 95, // Exceeds 80, should be clamped
        points: [
          { id: 'S', x: 0, y: 2, z: 0 },
          { id: 'A', x: -1, y: -1, z: -1 },
          { id: 'B', x: 1, y: -1, z: -1 },
          { id: 'C', x: 0, y: -1, z: 1 }
        ],
        segments: [
          { id: 'SA', refs: ['S', 'A'], style: 'solid' },
          { id: 'SB', refs: ['S', 'B'], style: 'dashed' },
          { id: 'SC', refs: ['S', 'C'] }
        ]
      }
    },
    uncertainties: ['Góc nhìn nghiêng'],
    extractedText: 'Khối chóp tam giác'
  });

  const parsed = parseProposal(json);
  assert.equal(parsed.document.solid?.type, 'pyramid');
  assert.equal(parsed.document.solid?.tilt, 80);
  assert.equal(parsed.document.solid?.enabled, true);
  assert.deepEqual(parsed.uncertainties, ['Góc nhìn nghiêng']);
  assert.equal(parsed.extractedText, 'Khối chóp tam giác');
});

test('parseProposal: disambiguates duplicate IDs between shapes and solid.segments', () => {
  const json = JSON.stringify({
    document: {
      version: 1,
      title: 'Trùng ID',
      points: [],
      shapes: [
        { id: 'e1', type: 'segment', refs: ['A', 'B'] }
      ],
      solid: {
        enabled: true,
        type: 'custom',
        rotation: 30,
        tilt: 20,
        points: [
          { id: 'A', x: 0, y: 0, z: 0 },
          { id: 'B', x: 1, y: 1, z: 1 }
        ],
        segments: [
          { id: 'e1', refs: ['A', 'B'], styleMode: 'auto' } // Collides with shape e1
        ]
      }
    }
  });

  const parsed = parseProposal(json);
  assert.ok(parsed.document);
  // Both shouldn't have identical ID in the validated document
  const shapeId = parsed.document.shapes[0].id;
  const segId = parsed.document.solid?.segments?.[0]?.id;
  assert.notEqual(shapeId, segId);
});

test('constructVietnamese3DProposal: handles Tetrahedron, Prism, and Cube', () => {
  // Tetrahedron S.ABC
  const tetra = constructVietnamese3DProposal('Cho hình chóp tam giác S.ABC có đáy là tam giác ABC');
  assert.ok(tetra);
  assert.equal(tetra.document.solid.type, 'tetrahedron');
  assert.equal(tetra.document.solid.points.length, 4);

  // Prism ABC.A'B'C'
  const prism = constructVietnamese3DProposal('Cho hình lăng trụ tam giác ABC.A1B1C1');
  assert.ok(prism);
  assert.equal(prism.document.solid.type, 'prism');
  assert.equal(prism.document.solid.points.length, 6);

  // Cube
  const cube = constructVietnamese3DProposal('Cho hình lập phương ABCD.A1B1C1D1');
  assert.ok(cube);
  assert.equal(cube.document.solid.type, 'cube');
  assert.equal(cube.document.solid.points.length, 8);
});

test('AI Drawing Handler: quota refund upon invalid 3D proposal or resolution failure', async () => {
  const day = getAiUsageDay();
  const profiles: Record<string, any> = {
    student: { status: 'pending', planType: 'free', promptCount: 2, queryCount: 2, lastLatexResetDate: day }
  };

  const db = {
    collection: (name: string) => ({ doc: (uid: string) => ({ uid }) }),
    runTransaction: (work: any) => work({
      get: async (ref: any) => ({ exists: !!profiles[ref.uid], data: () => ({ ...profiles[ref.uid] }) }),
      update: (ref: any, data: any) => { Object.assign(profiles[ref.uid], data); }
    })
  };

  // Mock generator returning invalid 3D geometry with cycle
  const cyclicContent = JSON.stringify({
    document: {
      version: 1,
      title: 'Cyclic 3D',
      points: [],
      shapes: [],
      solid: {
        enabled: true,
        type: 'custom',
        rotation: 0,
        tilt: 0,
        points: [
          { id: 'P1', kind: 'midpoint', refs: ['P2', 'P3'] },
          { id: 'P2', kind: 'midpoint', refs: ['P1', 'P3'] },
          { id: 'P3', x: 0, y: 0, z: 0 }
        ],
        segments: []
      }
    }
  });

  const handler = createDrawingHandler({
    env: { GEMINI_API_KEY: 'test-key' },
    authenticate: async () => ({ authorized: true, status: 200, user: { uid: 'student', isOwner: false } }),
    getDatabase: () => db as any,
    generate: async () => cyclicContent
  });

  const res = {
    code: 200,
    data: null as any,
    setHeader() {},
    status(c: number) { this.code = c; return this; },
    json(d: any) { this.data = d; return this; }
  };

  await handler({
    method: 'POST',
    query: { action: 'reconstruct' },
    headers: { host: 'localhost:3000' },
    body: {
      prompt: 'Dựng hình 3D lỗi chu trình',
      document: { version: 1, title: 'Blank', points: [], shapes: [] }
    }
  }, res);

  // Status should be 502 Bad Gateway
  assert.equal(res.code, 502);
  // Prompt count should be refunded back to initial value (2)
  assert.equal(profiles.student.promptCount, 2);
});
