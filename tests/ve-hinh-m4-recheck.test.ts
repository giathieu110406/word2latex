import test from 'node:test';
import assert from 'node:assert/strict';
import { exportTikZ, formatTikZColor, buildTikZOptions } from '../public/ve-hinh/src/tikz.js';
import { exportTikZ3D, getStandardSolidGeometry } from '../public/ve-hinh/src/engine3d/tikz3d.js';
import { exportSVG } from '../public/ve-hinh/src/render.js';

// ============================================================================
// STRESS TEST SUITE 1: TÁI THẨM ĐỊNH LÕI exportSVG & TRIỆT TIÊU WATERMARK 3D
// ============================================================================

test('RECHECK-1.1: exportSVG eliminates title watermark across ALL 3D solid types and preserves point labels', () => {
  const solidConfigs = [
    { type: 'pyramid', title: 'Hình chóp' },
    { type: 'prism', title: 'Hình lăng trụ' },
    { type: 'box', title: 'Hình hộp' },
    { type: 'cube', title: 'Hình lập phương' },
    { type: 'tetrahedron', title: 'Tứ diện' },
    { type: 'regular-tetrahedron', title: 'Tứ diện đều' },
    { type: 'frustum', title: 'Hình chóp cụt' },
    { type: 'cylinder', title: 'Hình trụ' },
    { type: 'cone', title: 'Hình nón' },
    { type: 'sphere', title: 'Khối cầu' },
    { type: 'custom', title: 'Hình học không gian' },
    { type: undefined, title: 'Hình học không gian' }
  ];

  for (const cfg of solidConfigs) {
    const doc = {
      version: 1,
      mode: 'solid',
      solid: {
        type: cfg.type,
        rotation: 35,
        tilt: 25,
        points: [
          { id: 'P_TEST1', x: 0, y: 1, z: 0, label: 'Apex_S' },
          { id: 'P_TEST2', x: 1, y: 0, z: 0, label: 'Base_A' }
        ],
        segments: [
          { id: 'seg1', refs: ['P_TEST1', 'P_TEST2'], styleMode: 'solid' }
        ]
      }
    };

    const svg = exportSVG(doc, 'solid');

    // 1. Phải không chứa watermark tag text x=30 y=40
    assert.equal(
      /<text x="30" y="40"[^>]*>/i.test(svg),
      false,
      `Solid type "${cfg.type}" must NOT contain <text x="30" y="40"> in exportSVG`
    );

    // 2. Phải không chứa chuỗi tiêu đề tiếng Việt watermark
    if (cfg.title) {
      assert.equal(
        svg.includes(cfg.title),
        false,
        `Solid type "${cfg.type}" must NOT contain watermark title "${cfg.title}" in exportSVG`
      );
    }

    // 3. Phải loại bỏ thẻ rect nền và pattern dots
    assert.equal(svg.includes('fill="url(#dots)"'), false, 'Must not contain dots pattern fill');
    assert.equal(svg.includes('id="dots"'), false, 'Must not contain pattern id="dots"');

    // 4. BẢO TOÀN ĐỘNG: Phải bảo tồn nhãn điểm hợp lệ (không bị xóa nhầm các thẻ <text> khác)
    assert.ok(
      svg.includes('Apex_S') || svg.includes('Base_A'),
      `Solid type "${cfg.type}" must preserve valid point labels in SVG output`
    );
  }
});

test('RECHECK-1.2: exportSVG handles 2D geometry mode with custom text and does not strip arbitrary <text> tags', () => {
  const doc2D = {
    version: 1,
    mode: 'geometry',
    geometry: {
      enabled: true
    },
    points: [
      { id: 'A', x: 0, y: 0, label: 'Point_A' },
      { id: 'B', x: 3, y: 4, label: 'Point_B' }
    ],
    shapes: [
      { id: 'segAB', type: 'segment', refs: ['A', 'B'], color: '#2563eb' }
    ]
  };

  const svg2D = exportSVG(doc2D, 'geometry');
  assert.ok(svg2D.includes('<svg'), 'Exported 2D SVG must contain <svg tag');
  assert.ok(svg2D.includes('Point_A'), 'Exported 2D SVG must preserve Point_A label');
  assert.ok(svg2D.includes('Point_B'), 'Exported 2D SVG must preserve Point_B label');
  assert.equal(svg2D.includes('<pattern id="dots"'), false, 'Must not contain dots pattern');
});

// ============================================================================
// STRESS TEST SUITE 2: TÁI THẨM ĐỊNH MÃ MÀU VÀ THIẾT DIỆN (crossSections) TIKZ 3D
// ============================================================================

test('RECHECK-2.1: exportTikZ3D applies formatTikZColor correctly to crossSections with diverse hex codes and 0 occurrences of "#"', () => {
  const testColors = [
    { input: '#176b52', expectedName: '{rgb,255:red,23;green,107;blue,82}' },
    { input: '#2563eb', expectedName: '{rgb,255:red,37;green,99;blue,235}' },
    { input: '#dc2626', expectedName: '{rgb,255:red,220;green,38;blue,38}' },
    { input: '#d97706', expectedName: '{rgb,255:red,217;green,119;blue,6}' },
    { input: '#1f2937', expectedName: '{rgb,255:red,31;green,41;blue,55}' },
    { input: '#f00', expectedName: '{rgb,255:red,255;green,0;blue,0}' },
    { input: '#0f0', expectedName: '{rgb,255:red,0;green,255;blue,0}' },
    { input: '#00f', expectedName: '{rgb,255:red,0;green,0;blue,255}' },
    { input: '#abc', expectedName: '{rgb,255:red,170;green,187;blue,204}' },
    { input: '#FF5733', expectedName: '{rgb,255:red,255;green,87;blue,51}' },
    { input: 'red', expectedName: 'red' },
    { input: 'blue', expectedName: 'blue' },
    { input: 'orange', expectedName: 'orange' },
    { input: 'teal', expectedName: 'teal' }
  ];

  for (const { input, expectedName } of testColors) {
    const doc = {
      version: 1,
      mode: 'solid',
      solid: {
        type: 'pyramid',
        rotation: 30,
        tilt: 20,
        points: [
          { id: 'S', x: 0, y: 2, z: 0 },
          { id: 'M', x: 1, y: 0, z: 0 },
          { id: 'N', x: 0, y: 0, z: 1 },
          { id: 'P', x: -1, y: 0, z: 0 }
        ],
        segments: [],
        crossSections: [
          { id: 'cs1', refs: ['M', 'N', 'P'], color: input, opacity: 0.45 }
        ]
      }
    };

    const tikz = exportTikZ3D(doc);

    // Không được chứa ký tự '#' trong mã TikZ
    assert.equal(
      tikz.includes('#'),
      false,
      `Cross section TikZ output must NOT contain '#' for input color ${input}`
    );

    // Phải chứa đúng chuỗi fill color chuyển đổi
    assert.ok(
      tikz.includes(`fill=${expectedName}`),
      `Cross section TikZ must contain "fill=${expectedName}" for input "${input}". Got:\n${tikz}`
    );

    // Phải bảo tồn opacity 0.45
    assert.ok(
      tikz.includes('fill opacity=0.45'),
      `Cross section TikZ must preserve fill opacity=0.45. Got:\n${tikz}`
    );
  }
});

test('RECHECK-2.2: exportTikZ3D crossSections defaults cleanly to gray for neutral, missing or #808080 colors', () => {
  const neutralInputs = [
    undefined,
    null,
    '',
    'gray',
    '#808080',
    '#808080'.toLowerCase()
  ];

  for (const input of neutralInputs) {
    const doc = {
      version: 1,
      mode: 'solid',
      solid: {
        type: 'pyramid',
        rotation: 30,
        tilt: 20,
        points: [
          { id: 'S', x: 0, y: 2, z: 0 },
          { id: 'A', x: 1, y: 0, z: 0 },
          { id: 'B', x: 0, y: 0, z: 1 },
          { id: 'C', x: -1, y: 0, z: 0 }
        ],
        crossSections: [
          { id: 'cs_neutral', refs: ['A', 'B', 'C'], color: input }
        ]
      }
    };

    const tikz = exportTikZ3D(doc);
    assert.equal(tikz.includes('#'), false, `Must not contain '#' for neutral input "${input}"`);
    assert.ok(
      tikz.includes('fill=gray'),
      `Cross section with neutral/fallback color "${input}" must output fill=gray`
    );
    assert.ok(
      tikz.includes('fill opacity=0.2'),
      'Cross section without explicit opacity must default to fill opacity=0.2'
    );
  }
});

test('RECHECK-2.3: exportTikZ3D ignores invisible crossSections (visible: false)', () => {
  const doc = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'pyramid',
      points: [
        { id: 'A', x: 0, y: 0, z: 0 },
        { id: 'B', x: 1, y: 0, z: 0 },
        { id: 'C', x: 0, y: 1, z: 0 }
      ],
      crossSections: [
        { id: 'cs_hidden', refs: ['A', 'B', 'C'], color: '#2563eb', visible: false }
      ]
    }
  };

  const tikz = exportTikZ3D(doc);
  assert.equal(
    tikz.includes('\\fill['),
    false,
    'No fill command should be generated for invisible crossSection'
  );
  assert.equal(
    tikz.includes('-- cycle;'),
    false,
    'No cycle path should be generated for invisible crossSection'
  );
});

// ============================================================================
// STRESS TEST SUITE 3: ĐỘNG THÁI TỔNG HỢP & PHÒNG NGỪA HỒI QUY (REGRESSION)
// ============================================================================

test('RECHECK-3.1: 3D planes with custom hex colors and opacities output valid PGF/TikZ without "#"', () => {
  const doc = {
    version: 1,
    mode: 'solid',
    solid: {
      type: 'pyramid',
      rotation: 40,
      tilt: 30,
      points: [
        { id: 'S', x: 0, y: 2, z: 0 },
        { id: 'A', x: 1, y: -1, z: 0 },
        { id: 'B', x: 0, y: -1, z: 1 },
        { id: 'C', x: -1, y: -1, z: 0 }
      ],
      planes: [
        { id: 'pl_alpha', refs: ['S', 'A', 'B'], color: '#9333ea', opacity: 0.6 }
      ]
    }
  };

  const tikz = exportTikZ3D(doc);
  assert.equal(tikz.includes('#'), false, '3D Plane output must not contain "#"');
  assert.ok(
    tikz.includes('fill={rgb,255:red,147;green,51;blue,234}'),
    'Hex #9333ea must be converted to xcolor rgb'
  );
  assert.ok(
    tikz.includes('fill opacity=0.6'),
    'Plane opacity 0.6 must be preserved'
  );
});

test('RECHECK-3.2: FormatTikZColor handles invalid or empty inputs gracefully', () => {
  assert.equal(formatTikZColor(null), null);
  assert.equal(formatTikZColor(undefined), null);
  assert.equal(formatTikZColor(''), null);
  assert.equal(formatTikZColor('   '), null);
  assert.equal(formatTikZColor('invalid-color-string'), null);
  assert.equal(formatTikZColor('#xyz'), null);
  assert.equal(formatTikZColor('#12345'), null);
});
