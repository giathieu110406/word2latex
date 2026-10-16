import test from 'node:test';
import assert from 'node:assert/strict';
import { exportTikZ, formatTikZColor, buildTikZOptions } from '../public/ve-hinh/src/tikz.js';
import { exportTikZ3D, getStandardSolidGeometry } from '../public/ve-hinh/src/engine3d/tikz3d.js';
import { compute3DOcclusion, evaluatePolyhedronEdges } from '../public/ve-hinh/src/engine3d/occlusion.js';

// ============================================================================
// CHALLENGE 1: ĐỐI KHÁNG CÚ PHÁP ELIP VÀ CUNG TRÒN 2D
// - Tọa độ tâm elip bất kỳ (không ở gốc tọa độ)
// - Xoay quanh tâm bất kỳ (góc dương, góc âm, góc 0)
// - Cung quét 360 độ (thuần và cận biên)
// - Cung quét góc nhỏ (< 1 độ, 0.5 độ, 15 độ)
// - Góc quét âm và góc quét vượt qua mốc 0 độ (crossing 0/360)
// ============================================================================

test('[Challenger 1 - 2D Ellipse] Tâm bất kỳ và xoay quanh tâm bất kỳ với góc dương, âm và 0', () => {
  // Case A: Tâm C(2, 3) khác gốc tọa độ, đỉnh A(5, 6) nghiêng +45 độ
  const docPos45 = {
    version: 1,
    points: [
      { id: 'C', x: 2, y: 3, label: 'C' },
      { id: 'A', x: 5, y: 6, label: 'A' }
    ],
    shapes: [
      { id: 'e1', type: 'ellipse', refs: ['C', 'A'], ry: 1.5, color: '#1d4ed8' }
    ]
  };
  const tikzPos45 = exportTikZ(docPos45);
  // Kiểm tra tâm elip trong lệnh \draw là (C), và xoay quanh chính tâm (C)
  assert.ok(tikzPos45.includes('\\coordinate (C) at (2.00, 3.00);'), 'Tọa độ C phải là (2.00, 3.00)');
  assert.ok(tikzPos45.includes('rotate around={45.0:(C)}'), 'Phải xoay quanh tâm (C) góc +45.0 độ');
  assert.ok(tikzPos45.includes('(C) ellipse (4.24 and 1.50);'), 'Elip phải đặt tại tâm (C) với rx=4.24, ry=1.50');

  // Case B: Tâm C(1, 2), đỉnh A(4, -1) nghiêng -45 độ (góc âm)
  const docNeg45 = {
    version: 1,
    points: [
      { id: 'C', x: 1, y: 2, label: 'C' },
      { id: 'A', x: 4, y: -1, label: 'A' }
    ],
    shapes: [
      { id: 'e2', type: 'ellipse', refs: ['C', 'A'], ry: 1.8 }
    ]
  };
  const tikzNeg45 = exportTikZ(docNeg45);
  assert.ok(tikzNeg45.includes('rotate around={-45.0:(C)}'), 'Phải hỗ trợ góc xoay âm quanh tâm (C): ' + tikzNeg45);
  assert.ok(tikzNeg45.includes('(C) ellipse (4.24 and 1.80);'), 'Elip tại (C)');

  // Case C: Tâm C(-3, 4), đỉnh A(1, 4) nằm ngang (góc xoay 0 độ)
  const docZero = {
    version: 1,
    points: [
      { id: 'C', x: -3, y: 4, label: 'C' },
      { id: 'A', x: 1, y: 4, label: 'A' }
    ],
    shapes: [
      { id: 'e3', type: 'ellipse', refs: ['C', 'A'], ry: 2.0 }
    ]
  };
  const tikzZero = exportTikZ(docZero);
  // Khi góc xoay ~0 độ, không cần rotate around để giữ mã TikZ gọn gàng
  assert.ok(!tikzZero.includes('rotate around'), 'Không chèn rotate around vô nghĩa khi góc xoay 0');
  assert.ok(tikzZero.includes('\\draw (C) ellipse (4.00 and 2.00);'), 'Elip chuẩn trục tại (C) rx=4.00, ry=2.00');

  // Case D: Định nghĩa elip qua 3 điểm [C, A, B] để tính cả rx và ry từ điểm hình học
  const doc3Pts = {
    version: 1,
    points: [
      { id: 'C', x: 1, y: 1, label: 'C' },
      { id: 'A', x: 5, y: 1, label: 'A' }, // rx = 4
      { id: 'B', x: 1, y: 3.5, label: 'B' } // ry = 2.5
    ],
    shapes: [
      { id: 'e4', type: 'ellipse', refs: ['C', 'A', 'B'], fill: '#ff0000', fillOpacity: 0.3 }
    ]
  };
  const tikz3Pts = exportTikZ(doc3Pts);
  assert.ok(tikz3Pts.includes('(C) ellipse (4.00 and 2.50);'), 'Tính rx=4.00 và ry=2.50 chuẩn xác từ 3 điểm');
  assert.ok(tikz3Pts.includes('\\fill[fill={rgb,255:red,255;green,0;blue,0}, fill opacity=0.3] (C) ellipse (4.00 and 2.50);'), 'Tô màu elip qua 3 điểm chuẩn');
});

test('[Challenger 1 - 2D Arc] Cung tròn quét 360 độ, góc nhỏ và góc quét âm / qua mốc 0 độ', () => {
  // Case A: Cung 360 độ thuần (a1 = a2 do trỏ cùng điểm B trùng A)
  const doc360Identical = {
    version: 1,
    points: [
      { id: 'O', x: 0, y: 0, label: 'O' },
      { id: 'A', x: 3, y: 0, label: 'A' },
      { id: 'B', x: 3, y: 0, label: 'B' }
    ],
    shapes: [
      { id: 'arcFull', type: 'arc', refs: ['O', 'A', 'B'] }
    ]
  };
  const tikz360 = exportTikZ(doc360Identical);
  assert.ok(tikz360.includes('\\draw (O) circle (3.00);'), 'Cung quét 360 độ khi điểm trùng nhau phải thành circle: ' + tikz360);

  // Case B: Cung quét góc nhỏ (Delta = 0.5 độ: từ 20.0 độ đến 20.5 độ)
  const r = 4;
  const rad20 = (20 * Math.PI) / 180;
  const rad20_5 = (20.5 * Math.PI) / 180;
  const docSmallAngle = {
    version: 1,
    points: [
      { id: 'O', x: 1, y: 1, label: 'O' },
      { id: 'A', x: 1 + r * Math.cos(rad20), y: 1 + r * Math.sin(rad20), label: 'A' },
      { id: 'B', x: 1 + r * Math.cos(rad20_5), y: 1 + r * Math.sin(rad20_5), label: 'B' }
    ],
    shapes: [
      { id: 'arcSmall', type: 'arc', refs: ['O', 'A', 'B'] }
    ]
  };
  const tikzSmall = exportTikZ(docSmallAngle);
  assert.ok(tikzSmall.includes('++(20.0:4.00) arc (20.0:20.5:4.00);'), 'Cung góc nhỏ 0.5 độ phải có syntax chuẩn: ' + tikzSmall);

  // Case C: Cung quét qua mốc 0 độ (từ góc âm / góc phần tư IV sang góc phần tư I)
  // Tia OA ở -30 độ (330 độ), tia OB ở +30 độ
  const rad330 = (330 * Math.PI) / 180;
  const rad30 = (30 * Math.PI) / 180;
  const docCrossZero = {
    version: 1,
    points: [
      { id: 'O', x: 0, y: 0, label: 'O' },
      { id: 'A', x: 2 * Math.cos(rad330), y: 2 * Math.sin(rad330), label: 'A' },
      { id: 'B', x: 2 * Math.cos(rad30), y: 2 * Math.sin(rad30), label: 'B' }
    ],
    shapes: [
      { id: 'arcCross', type: 'arc', refs: ['O', 'A', 'B'] }
    ]
  };
  const tikzCross = exportTikZ(docCrossZero);
  // Trong TikZ, cung đi từ 330 độ qua 0 độ tới 30 độ là: ++(330.0:2.00) arc (330.0:390.0:2.00)
  assert.ok(tikzCross.includes('++(330.0:2.00) arc (330.0:390.0:2.00);'), 'Cung qua mốc 0 độ phải chuẩn hóa a2 += 360 (330->390): ' + tikzCross);

  // Case D: Điểm tọa độ âm trong góc phần tư III (A tại 225 độ, B tại 315 độ)
  const rad225 = (225 * Math.PI) / 180;
  const rad315 = (315 * Math.PI) / 180;
  const docQuad3to4 = {
    version: 1,
    points: [
      { id: 'O', x: 0, y: 0, label: 'O' },
      { id: 'A', x: 2 * Math.cos(rad225), y: 2 * Math.sin(rad225), label: 'A' },
      { id: 'B', x: 2 * Math.cos(rad315), y: 2 * Math.sin(rad315), label: 'B' }
    ],
    shapes: [
      { id: 'arcQ34', type: 'arc', refs: ['O', 'A', 'B'] }
    ]
  };
  const tikzQ34 = exportTikZ(docQuad3to4);
  assert.ok(tikzQ34.includes('++(225.0:2.00) arc (225.0:315.0:2.00);'), 'Cung trong vùng góc âm phải chuẩn hóa về [0, 360): ' + tikzQ34);
});

// ============================================================================
// CHALLENGE 2: ĐỐI KHÁNG CÚ PHÁP TIKZ ARC 3D TRÊN KHỐI NÓN, TRỤ, CẦU
// - Tọa độ điểm bắt đầu arc là tọa độ biên thực tế (perimeter)
// - 2 nửa elip đứt / liền ghép nối liên tục và đúng tâm hình học (Ox, Oy)
// - Tuyệt đối không bị tách rời 2rx
// - Điểm nối tiếp xúc hoàn hảo với 2 đường sinh biên ngoài
// - Thử nghiệm với tâm O dịch chuyển bất kỳ và tilt âm (nhìn từ dưới lên)
// ============================================================================

test('[Challenger 2 - 3D Cone] Khối nón: Arc xuất phát từ chu vi, 2 nửa ghép khít tại tâm, tiếp xúc 2 đường sinh', () => {
  // Test với khối nón có tâm O(1.5, -2.0, 0.5) bị lệch khỏi gốc tọa độ
  const doc = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'cone',
      rotation: 30,
      tilt: 20,
      points: [
        { id: 'S', x: 1.5, y: 2.5, z: 0.5, label: 'S' },
        { id: 'O', x: 1.5, y: -2.0, z: 0.5, label: 'O' }
      ]
    }
  };

  const tikz = exportTikZ3D(doc);

  // 1. Lấy tọa độ chiếu của O và S
  const matchCoordO = tikz.match(/\\coordinate \(O\) at \(([-\d.]+), ([-\d.]+)\);/);
  const matchCoordS = tikz.match(/\\coordinate \(S\) at \(([-\d.]+), ([-\d.]+)\);/);
  assert.ok(matchCoordO, 'Phải có định nghĩa tọa độ O: ' + tikz);
  assert.ok(matchCoordS, 'Phải có định nghĩa tọa độ S: ' + tikz);

  const ox = parseFloat(matchCoordO[1]);
  const oy = parseFloat(matchCoordO[2]);
  const sx = parseFloat(matchCoordS[1]);
  const sy = parseFloat(matchCoordS[2]);

  const rx = 1.80; // bán kính mặc định cho cone
  const ry = parseFloat((rx * Math.abs(Math.sin(20 * Math.PI / 180))).toFixed(2));

  const leftX = (ox - rx).toFixed(2);
  const rightX = (ox + rx).toFixed(2);
  const oyStr = oy.toFixed(2);
  const sxStr = sx.toFixed(2);
  const syStr = sy.toFixed(2);

  // 2. Kiểm chứng 2 đường sinh biên ngoài nối từ đỉnh S tới chính xác 2 điểm biên (ox - rx, oy) và (ox + rx, oy)
  assert.ok(
    tikz.includes(`\\draw (${sxStr}, ${syStr}) -- (${leftX}, ${oyStr});`),
    `Đường sinh trái phải nối từ S(${sxStr}, ${syStr}) đến (${leftX}, ${oyStr}): ` + tikz
  );
  assert.ok(
    tikz.includes(`\\draw (${sxStr}, ${syStr}) -- (${rightX}, ${oyStr});`),
    `Đường sinh phải phải nối từ S(${sxStr}, ${syStr}) đến (${rightX}, ${oyStr}): ` + tikz
  );

  // 3. Kiểm chứng 2 nửa elip đứt/liền xuất phát từ chu vi:
  // - Cung đứt 0->180 bắt đầu tại (ox + rx, oy)
  // - Cung liền 180->360 bắt đầu tại (ox - rx, oy)
  assert.ok(
    tikz.includes(`\\draw[dashed] (${rightX}, ${oyStr}) arc (0:180:`),
    `Cung đứt phải bắt đầu tại chu vi bên phải (${rightX}, ${oyStr}): ` + tikz
  );
  assert.ok(
    tikz.includes(`\\draw (${leftX}, ${oyStr}) arc (180:360:`),
    `Cung liền phải bắt đầu tại chu vi bên trái (${leftX}, ${oyStr}): ` + tikz
  );

  // 4. KIỂM TRA ĐỐI KHÁNG BUG 2rx: Tuyệt đối KHÔNG ĐƯỢC xuất phát từ tâm (ox, oy)
  const oxStr = ox.toFixed(2);
  assert.ok(
    !tikz.includes(`(${oxStr}, ${oyStr}) arc (0:180:`) && !tikz.includes(`(${oxStr}, ${oyStr}) arc (180:360:`),
    'LỖI NGHIÊM TRỌNG: Cung arc không được bắt đầu từ tâm O, nếu không sẽ bị lệch 2rx!'
  );
});

test('[Challenger 2 - 3D Cylinder] Khối trụ: 2 đường sinh biên và 2 đáy liên tục hoàn hảo', () => {
  const doc = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'cylinder',
      rotation: 45,
      tilt: 25,
      points: [
        { id: 'O1', x: 0, y: 1.5, z: 0, label: 'O1' },
        { id: 'O2', x: 0, y: -1.5, z: 0, label: 'O2' }
      ]
    }
  };

  const tikz = exportTikZ3D(doc);
  const matchO1 = tikz.match(/\\coordinate \(O1\) at \(([-\d.]+), ([-\d.]+)\);/);
  const matchO2 = tikz.match(/\\coordinate \(O2\) at \(([-\d.]+), ([-\d.]+)\);/);
  assert.ok(matchO1 && matchO2, 'Phải có tọa độ O1 và O2');

  const o1x = parseFloat(matchO1[1]), o1y = parseFloat(matchO1[2]);
  const o2x = parseFloat(matchO2[1]), o2y = parseFloat(matchO2[2]);
  const rx = 1.50;

  const leftO1X = (o1x - rx).toFixed(2);
  const rightO1X = (o1x + rx).toFixed(2);
  const leftO2X = (o2x - rx).toFixed(2);
  const rightO2X = (o2x + rx).toFixed(2);

  // Đáy trên O1 nhìn thấy trọn vẹn
  assert.ok(tikz.includes(`\\draw (${o1x.toFixed(2)}, ${o1y.toFixed(2)}) ellipse`), 'Đáy trên O1 phải là elip trọn vẹn');

  // Đáy dưới O2 chia làm 2 nửa cung chuẩn điểm chu vi
  assert.ok(tikz.includes(`\\draw[dashed] (${rightO2X}, ${o2y.toFixed(2)}) arc (0:180:`), 'Đáy dưới nửa đứt phải bắt đầu tại chu vi phải');
  assert.ok(tikz.includes(`\\draw (${leftO2X}, ${o2y.toFixed(2)}) arc (180:360:`), 'Đáy dưới nửa liền phải bắt đầu tại chu vi trái');

  // 2 đường sinh nối chính xác 2 cặp điểm biên của 2 đáy
  assert.ok(tikz.includes(`(${leftO1X}, ${o1y.toFixed(2)}) -- (${leftO2X}, ${o2y.toFixed(2)});`), 'Đường sinh trái nối đúng 2 biên trái');
  assert.ok(tikz.includes(`(${rightO1X}, ${o1y.toFixed(2)}) -- (${rightO2X}, ${o2y.toFixed(2)});`), 'Đường sinh phải nối đúng 2 biên phải');
});

test('[Challenger 2 - 3D Inverted Tilt] Khối nón và trụ khi nhìn từ dưới lên (tilt < 0)', () => {
  // Khi tilt < 0 (người quan sát nhìn từ dưới lên):
  // Nửa cung phía trước và phía sau phải đảo ngược trạng thái đứt/liền
  const docConeNeg = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'cone',
      rotation: 30,
      tilt: -20, // tilt âm
      points: [
        { id: 'S', x: 0, y: 2, z: 0, label: 'S' },
        { id: 'O', x: 0, y: -1.2, z: 0, label: 'O' }
      ]
    }
  };

  const tikz = exportTikZ3D(docConeNeg);
  const matchO = tikz.match(/\\coordinate \(O\) at \(([-\d.]+), ([-\d.]+)\);/);
  const ox = parseFloat(matchO![1]);
  const oy = parseFloat(matchO![2]);
  const rx = 1.80;

  // Khi tilt < 0: nửa 0..180 là nét LIỀN (\draw), nửa 180..360 là nét ĐỨT (\draw[dashed])
  const rightX = (ox + rx).toFixed(2);
  const leftX = (ox - rx).toFixed(2);
  const oyStr = oy.toFixed(2);

  assert.ok(tikz.includes(`\\draw (${rightX}, ${oyStr}) arc (0:180:`), 'Khi tilt < 0: nửa 0:180 là nét liền');
  assert.ok(tikz.includes(`\\draw[dashed] (${leftX}, ${oyStr}) arc (180:360:`), 'Khi tilt < 0: nửa 180:360 là nét đứt');
});

test('[Challenger 2 - 3D Sphere] Khối cầu: Đường bao silhouette và xích đạo đứt/liền chung tâm', () => {
  const doc = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'sphere',
      rotation: 15,
      tilt: 25,
      points: [
        { id: 'O', x: 2, y: 1, z: -1, label: 'O' }
      ]
    }
  };

  const tikz = exportTikZ3D(doc);
  const matchO = tikz.match(/\\coordinate \(O\) at \(([-\d.]+), ([-\d.]+)\);/);
  assert.ok(matchO, 'Phải có tọa độ tâm O của cầu');
  const ox = parseFloat(matchO[1]);
  const oy = parseFloat(matchO[2]);
  const rx = 1.80;

  // Silhouette circle
  assert.ok(tikz.includes(`\\draw (${ox.toFixed(2)}, ${oy.toFixed(2)}) circle (${rx.toFixed(2)});`), 'Đường bao khối cầu phải là circle');

  // Xích đạo có 2 nửa arc
  const rightX = (ox + rx).toFixed(2);
  const leftX = (ox - rx).toFixed(2);
  assert.ok(tikz.includes(`\\draw[dashed] (${rightX}, ${oy.toFixed(2)}) arc (0:180:`), 'Xích đạo sau nét đứt');
  assert.ok(tikz.includes(`\\draw (${leftX}, ${oy.toFixed(2)}) arc (180:360:`), 'Xích đạo trước nét liền');
});

// ============================================================================
// CHALLENGE 3: ĐỐI KHÁNG OCCLUSION KHỐI ĐA DIỆN MỚI (TỨ DIỆN ĐỀU & CHÓP CỤT)
// - Xoay Tứ diện đều ở nhiều góc yaw/pitch (rotation: 0, 30, 60, 90, 120, 180, 240)
// - Xoay Chóp cụt ở nhiều góc yaw/pitch (rotation: 0, 30, 45, 90, 135, 180, 225, 270)
// - Kiểm chứng mã TikZ sinh ra LUÔN CÓ CẢ:
//   * \draw[dashed] (cạnh khuất đứt nét)
//   * \draw (cạnh nhìn thấy liền nét)
// - Không bao giờ xảy ra tình trạng thoái hóa (100% nét liền hoặc 100% nét đứt)
// ============================================================================

test('[Challenger 3 - Regular Tetrahedron] Tứ diện đều luôn có cả cạnh khuất (dashed) và cạnh thấy (solid) khi xoay các góc', () => {
  // Danh sách các góc xoay đối kháng chuẩn SGK hình học không gian THPT
  const testRotations = [0, 30, 45, 60, 90, 120, 150, 180, 210, 240, 300, 330];
  const testTilts = [15, 20, 25, 30];

  for (const rot of testRotations) {
    for (const tilt of testTilts) {
      const doc = {
        version: 1,
        mode: 'solid',
        solid: {
          type: 'regular-tetrahedron',
          rotation: rot,
          tilt: tilt,
          points: [
            { id: 'A', x: 2, y: -1.2, z: 0 },
            { id: 'B', x: -1, y: -1.2, z: 1.732 },
            { id: 'C', x: -1, y: -1.2, z: -1.732 },
            { id: 'S', x: 0, y: 1.8, z: 0 }
          ],
          segments: [
            { id: 'AB', refs: ['A', 'B'], styleMode: 'auto' },
            { id: 'BC', refs: ['B', 'C'], styleMode: 'auto' },
            { id: 'CA', refs: ['C', 'A'], styleMode: 'auto' },
            { id: 'SA', refs: ['S', 'A'], styleMode: 'auto' },
            { id: 'SB', refs: ['S', 'B'], styleMode: 'auto' },
            { id: 'SC', refs: ['S', 'C'], styleMode: 'auto' }
          ]
        }
      };

      const tikz = exportTikZ3D(doc);

      // Phải có cạnh đứt \draw[dashed]
      const hasDashed = tikz.includes('\\draw[dashed]');
      // Phải có cạnh liền \draw (A) -- (B)
      const hasSolid = /\\draw \([A-Z0-9]+\) -- \([A-Z0-9]+\);/.test(tikz);

      assert.ok(
        hasDashed,
        `Tứ diện đều tại rotation=${rot}, tilt=${tilt} PHẢI CÓ CẠNH KHUẤT (dashed), nhưng không tìm thấy!\nMã TikZ:\n${tikz}`
      );
      assert.ok(
        hasSolid,
        `Tứ diện đều tại rotation=${rot}, tilt=${tilt} PHẢI CÓ CẠNH NHÌN THẤY (solid), nhưng không tìm thấy!\nMã TikZ:\n${tikz}`
      );

      // Đếm tổng số cạnh được vẽ phải đúng 6 cạnh
      const dashedCount = (tikz.match(/\\draw\[dashed\] \([A-Z0-9]+\) -- \([A-Z0-9]+\);/g) || []).length;
      const solidCount = (tikz.match(/\\draw \([A-Z0-9]+\) -- \([A-Z0-9]+\);/g) || []).length;
      assert.equal(
        dashedCount + solidCount,
        6,
        `Tổng số cạnh tứ diện đều tại rotation=${rot}, tilt=${tilt} phải là 6, thực tế: ${dashedCount} dashed + ${solidCount} solid`
      );
    }
  }
});

test('[Challenger 3 - Frustum] Chóp cụt luôn có cả cạnh khuất (dashed) và cạnh thấy (solid) khi xoay các góc', () => {
  const testRotations = [0, 25, 45, 70, 90, 135, 180, 225, 270, 315];
  const testTilts = [15, 20, 25, 30];

  for (const rot of testRotations) {
    for (const tilt of testTilts) {
      const doc = {
        version: 1,
        mode: 'solid',
        solid: {
          type: 'frustum',
          rotation: rot,
          tilt: tilt,
          points: [
            { id: 'A', x: -1.8, y: -1.3, z: -1.2 },
            { id: 'B', x: 1.8, y: -1.3, z: -1.2 },
            { id: 'C', x: 1.8, y: -1.3, z: 1.2 },
            { id: 'D', x: -1.8, y: -1.3, z: 1.2 },
            { id: 'A1', x: -0.9, y: 1.2, z: -0.6 },
            { id: 'B1', x: 0.9, y: 1.2, z: -0.6 },
            { id: 'C1', x: 0.9, y: 1.2, z: 0.6 },
            { id: 'D1', x: -0.9, y: 1.2, z: 0.6 }
          ],
          segments: [
            // Đáy dưới
            { id: 'AB', refs: ['A', 'B'], styleMode: 'auto' },
            { id: 'BC', refs: ['B', 'C'], styleMode: 'auto' },
            { id: 'CD', refs: ['C', 'D'], styleMode: 'auto' },
            { id: 'DA', refs: ['D', 'A'], styleMode: 'auto' },
            // Đáy trên
            { id: 'A1B1', refs: ['A1', 'B1'], styleMode: 'auto' },
            { id: 'B1C1', refs: ['B1', 'C1'], styleMode: 'auto' },
            { id: 'C1D1', refs: ['C1', 'D1'], styleMode: 'auto' },
            { id: 'D1A1', refs: ['D1', 'A1'], styleMode: 'auto' },
            // Cạnh bên
            { id: 'AA1', refs: ['A', 'A1'], styleMode: 'auto' },
            { id: 'BB1', refs: ['B', 'B1'], styleMode: 'auto' },
            { id: 'CC1', refs: ['C', 'C1'], styleMode: 'auto' },
            { id: 'DD1', refs: ['D', 'D1'], styleMode: 'auto' }
          ]
        }
      };

      const tikz = exportTikZ3D(doc);

      const hasDashed = tikz.includes('\\draw[dashed]');
      const hasSolid = /\\draw \([A-Z0-9]+\) -- \([A-Z0-9]+\);/.test(tikz);

      assert.ok(
        hasDashed,
        `Chóp cụt tại rotation=${rot}, tilt=${tilt} PHẢI CÓ CẠNH KHUẤT (dashed)!\nMã TikZ:\n${tikz}`
      );
      assert.ok(
        hasSolid,
        `Chóp cụt tại rotation=${rot}, tilt=${tilt} PHẢI CÓ CẠNH THẤY (solid)!\nMã TikZ:\n${tikz}`
      );

      const dashedCount = (tikz.match(/\\draw\[dashed\] \([A-Z0-9]+\) -- \([A-Z0-9]+\);/g) || []).length;
      const solidCount = (tikz.match(/\\draw \([A-Z0-9]+\) -- \([A-Z0-9]+\);/g) || []).length;
      assert.equal(
        dashedCount + solidCount,
        12,
        `Tổng số cạnh chóp cụt tại rotation=${rot}, tilt=${tilt} phải là 12, thực tế: ${dashedCount} dashed + ${solidCount} solid`
      );
    }
  }
});

test('[Challenger 3 - Fallback Standard Geometry] Tự động sinh mesh khi doc.solid.points rỗng', () => {
  // Khi người dùng chỉ định type: 'regular-tetrahedron' hoặc 'frustum' mà không truyền points/segments
  const docTetraAuto = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'regular-tetrahedron',
      rotation: 30,
      tilt: 20
    }
  };
  const tikzTetra = exportTikZ3D(docTetraAuto);
  assert.ok(tikzTetra.includes('\\coordinate (S)'), 'Tự động sinh tọa độ đỉnh S');
  assert.ok(tikzTetra.includes('\\coordinate (A)'), 'Tự động sinh tọa độ đáy A');
  assert.ok(tikzTetra.includes('\\draw[dashed]'), 'Có cạnh khuất nét đứt');
  assert.ok(tikzTetra.includes('\\draw (S) --'), 'Có cạnh thấy nét liền');

  const docFrustumAuto = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'frustum',
      rotation: 30,
      tilt: 20
    }
  };
  const tikzFrustum = exportTikZ3D(docFrustumAuto);
  assert.ok(tikzFrustum.includes('\\coordinate (A1)'), 'Tự động sinh đỉnh chóp cụt A1');
  assert.ok(tikzFrustum.includes('\\draw[dashed]'), 'Có cạnh khuất nét đứt cho chóp cụt');
  assert.ok(tikzFrustum.includes('\\draw (A1) --') || tikzFrustum.includes('\\draw (B1) --') || tikzFrustum.includes('\\draw (C1) --'), 'Có cạnh thấy nét liền cho chóp cụt');
});
