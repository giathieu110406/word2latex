/**
 * 3D TikZ LaTeX Exporter
 * Generates clean, 100% compatible 2D projected TikZ LaTeX code without tikz-3dplot.
 * Compatible with pdfLaTeX, XeLaTeX, Overleaf for Vietnamese high school exams.
 */

import { resolve } from '../math.js';
import { project3D } from './projection.js';
import {
  evaluateFaceVisibility,
  evaluatePolyhedronEdges,
  evaluateSegmentOcclusion,
  resolveSegmentDashed,
  orientPolyhedronFaces,
  edgeKey
} from './occlusion.js';
import { computeLabelPlacement3D } from './label3d.js';

/**
 * Standard base mesh vertices and faces for predefined solids.
 * @param {string} type
 * @param {number} sides
 * @returns {{verts: Record<string, {x: number, y: number, z: number}>, faces: Array<{name: string, verts: string[]}>, edges: Array<[string, string]>}}
 */
export function getStandardSolidGeometry(type = 'pyramid', sides = 4) {
  if (type === 'pyramid') {
    // Standard pyramid with square base ABCD and apex S
    // S lies directly above A (common Vietnamese exam setup) or centered
    // We provide standard coordinates with A in the back-left
    const A = { id: 'A', x: 0, y: -1.5, z: -2.12 };
    const B = { id: 'B', x: 2.12, y: -1.5, z: 0 };
    const C = { id: 'C', x: 0, y: -1.5, z: 2.12 };
    const D = { id: 'D', x: -2.12, y: -1.5, z: 0 };
    const S = { id: 'S', x: 0, y: 2.0, z: -2.12 };

    const verts = { A, B, C, D, S };
    const faces = [
      { name: 'base', verts: ['A', 'B', 'C', 'D'] },
      { name: 'SAB', verts: ['S', 'A', 'B'] },
      { name: 'SBC', verts: ['S', 'B', 'C'] },
      { name: 'SCD', verts: ['S', 'C', 'D'] },
      { name: 'SDA', verts: ['S', 'D', 'A'] }
    ];
    const edges = [
      ['S', 'A'], ['S', 'B'], ['S', 'C'], ['S', 'D'],
      ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A']
    ];
    return { verts, faces, edges };
  }

  if (type === 'cube' || type === 'box') {
    const y = type === 'cube' ? 1.5 : 1.2;
    const z = type === 'cube' ? 1.5 : 1.2;
    const x = 1.5;
    const verts = {
      A: { id: 'A', x: -x, y: -y, z: -z },
      B: { id: 'B', x: x, y: -y, z: -z },
      C: { id: 'C', x: x, y: -y, z: z },
      D: { id: 'D', x: -x, y: -y, z: z },
      A1: { id: 'A1', x: -x, y: y, z: -z },
      B1: { id: 'B1', x: x, y: y, z: -z },
      C1: { id: 'C1', x: x, y: y, z: z },
      D1: { id: 'D1', x: -x, y: y, z: z }
    };
    const faces = [
      { name: 'bottom', verts: ['A', 'B', 'C', 'D'] },
      { name: 'top', verts: ['A1', 'D1', 'C1', 'B1'] },
      { name: 'front', verts: ['D', 'C', 'C1', 'D1'] },
      { name: 'back', verts: ['B', 'A', 'A1', 'B1'] },
      { name: 'left', verts: ['A', 'D', 'D1', 'A1'] },
      { name: 'right', verts: ['C', 'B', 'B1', 'C1'] }
    ];
    const edges = [
      ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'],
      ['A1', 'B1'], ['B1', 'C1'], ['C1', 'D1'], ['D1', 'A1'],
      ['A', 'A1'], ['B', 'B1'], ['C', 'C1'], ['D', 'D1']
    ];
    return { verts, faces, edges };
  }

  if (type === 'tetrahedron') {
    const r = 2;
    const A = { id: 'A', x: r * Math.cos(0), y: -1.2, z: r * Math.sin(0) };
    const B = { id: 'B', x: r * Math.cos(2 * Math.PI / 3), y: -1.2, z: r * Math.sin(2 * Math.PI / 3) };
    const C = { id: 'C', x: r * Math.cos(4 * Math.PI / 3), y: -1.2, z: r * Math.sin(4 * Math.PI / 3) };
    const S = { id: 'S', x: 0, y: 1.8, z: 0 };
    const verts = { A, B, C, S };
    const faces = [
      { name: 'base', verts: ['A', 'B', 'C'] },
      { name: 'SAB', verts: ['S', 'A', 'B'] },
      { name: 'SBC', verts: ['S', 'B', 'C'] },
      { name: 'SCA', verts: ['S', 'C', 'A'] }
    ];
    const edges = [
      ['A', 'B'], ['B', 'C'], ['C', 'A'],
      ['S', 'A'], ['S', 'B'], ['S', 'C']
    ];
    return { verts, faces, edges };
  }

  // Fallback default
  return { verts: {}, faces: [], edges: [] };
}

/**
 * Export 3D Document to standard 2D Projected TikZ LaTeX code.
 * @param {any} doc
 * @param {{rotation?: number, tilt?: number, scale?: number, projection?: string, dist?: number}} cameraOptions
 * @returns {string}
 */
export function exportTikZ3D(doc, cameraOptions = {}) {
  const rotation = cameraOptions.rotation ?? doc.solid?.rotation ?? 30;
  const tilt = cameraOptions.tilt ?? doc.solid?.tilt ?? 20;
  const camera = {
    rotation,
    tilt,
    projection: cameraOptions.projection ?? 'orthographic',
    dist: cameraOptions.dist ?? 10
  };
  const tikzScale = cameraOptions.scale ?? 1;

  // Resolve points
  const resolved = resolve(doc);
  const docPoints = { ...resolved.points, ...(resolved.solidPoints || {}) };

  // Collect 3D points
  const points3D = {};
  const pointLabels = {};

  // If doc.solid.points exists
  if (doc.solid?.points?.length > 0) {
    for (const p of doc.solid.points) {
      const resP = docPoints[p.id] || p;
      if (resP.visible !== false) {
        points3D[p.id] = {
          x: resP.x ?? 0,
          y: resP.y ?? 0,
          z: resP.z ?? 0
        };
        pointLabels[p.id] = resP.label || p.label || p.id;
      }
    }
  }

  // Also check top-level points with 3D coordinates
  for (const [id, p] of Object.entries(docPoints)) {
    if (p.visible !== false && p.z !== undefined) {
      points3D[id] = {
        x: p.x ?? 0,
        y: p.y ?? 0,
        z: p.z ?? 0
      };
      pointLabels[id] = p.label || id;
    }
  }

  // If no explicit points, fallback to standard solid geometry
  let polyFaces = [];
  let polyEdges = [];

  if (Object.keys(points3D).length === 0 && doc.solid?.type) {
    const std = getStandardSolidGeometry(doc.solid.type, doc.solid.sides);
    for (const [id, v] of Object.entries(std.verts)) {
      points3D[id] = v;
      pointLabels[id] = id;
    }
    polyFaces = std.faces;
    polyEdges = std.edges;
  }

  // Construct faces for occlusion testing if solid has predefined type or explicit faces
  if (polyFaces.length === 0 && doc.solid?.type && doc.solid.type !== 'custom') {
    const std = getStandardSolidGeometry(doc.solid.type, doc.solid.sides);
    // Map standard faces to existing points if IDs match
    polyFaces = std.faces.filter(f => f.verts.every(vid => points3D[vid]));
    polyEdges = std.edges.filter(([a, b]) => points3D[a] && points3D[b]);
  }

  // If faces exist, ensure outward orientation
  const orientedFaces = orientPolyhedronFaces(
    polyFaces.map(f => ({
      ...f,
      verts: f.verts.map(vid => points3D[vid]).filter(Boolean)
    })),
    points3D
  );

  // Evaluate face visibility and polyhedron edge visibility
  const polyOcclusion = evaluatePolyhedronEdges(orientedFaces, camera);

  // Project all points to 2D
  const projected2D = {};
  for (const [id, p] of Object.entries(points3D)) {
    const proj = project3D(p, camera);
    projected2D[id] = {
      x: proj.u * tikzScale,
      y: proj.v * tikzScale,
      u: proj.u,
      v: proj.v,
      depth: proj.depth
    };
  }

  // Collect segments to draw
  const segmentsToProcess = [];

  // Check explicit segments in doc.solid.segments
  if (doc.solid?.segments?.length > 0) {
    for (const s of doc.solid.segments) {
      if (s.visible !== false && s.refs?.length === 2) {
        const [a, b] = s.refs;
        if (points3D[a] && points3D[b]) {
          segmentsToProcess.push({
            id: s.id,
            a,
            b,
            styleMode: s.styleMode ?? 'auto',
            color: s.color,
            strokeWidth: s.strokeWidth
          });
        }
      }
    }
  }

  // Also check top-level shapes of type segment with 3D endpoints
  for (const s of (doc.shapes || [])) {
    if (s.type === 'segment' && s.visible !== false && s.refs?.length === 2) {
      const [a, b] = s.refs;
      if (points3D[a] && points3D[b] && !segmentsToProcess.some(sp => (sp.a === a && sp.b === b) || (sp.a === b && sp.b === a))) {
        segmentsToProcess.push({
          id: s.id,
          a,
          b,
          styleMode: s.dashed ? 'dashed' : 'auto',
          color: s.color
        });
      }
    }
  }

  // If no explicit segments, use standard polyhedron edges
  if (segmentsToProcess.length === 0 && polyEdges.length > 0) {
    for (const [a, b] of polyEdges) {
      if (points3D[a] && points3D[b]) {
        segmentsToProcess.push({
          id: `edge_${a}_${b}`,
          a,
          b,
          styleMode: 'auto'
        });
      }
    }
  }

  // Classify each segment into dashed or solid
  const dashedSegments = [];
  const solidSegments = [];

  for (const seg of segmentsToProcess) {
    const p1 = points3D[seg.a];
    const p2 = points3D[seg.b];
    const key = edgeKey(seg.a, seg.b);

    let isOccluded = false;

    // First check if this is an exterior polyhedron edge
    if (polyOcclusion.edgeVisibility.has(key)) {
      isOccluded = !polyOcclusion.edgeVisibility.get(key);
    } else if (orientedFaces.length > 0) {
      // Internal or free segment: perform Raycast depth test against front-facing faces
      isOccluded = evaluateSegmentOcclusion(p1, p2, orientedFaces, camera);
    }

    const dashed = resolveSegmentDashed(seg, isOccluded);
    if (dashed) {
      dashedSegments.push(seg);
    } else {
      solidSegments.push(seg);
    }
  }

  // Setup neighbors for smart label placement
  const neighborsMap = new Map();
  for (const id of Object.keys(points3D)) neighborsMap.set(id, []);
  const allCanvasSegments = [];

  for (const seg of [...dashedSegments, ...solidSegments]) {
    const pa = projected2D[seg.a];
    const pb = projected2D[seg.b];
    if (pa && pb) {
      allCanvasSegments.push({
        a: { x: pa.x * 50 + 500, y: 330 - pa.y * 50 },
        b: { x: pb.x * 50 + 500, y: 330 - pb.y * 50 }
      });
      neighborsMap.get(seg.a)?.push({ x: pb.x * 50 + 500, y: 330 - pb.y * 50 });
      neighborsMap.get(seg.b)?.push({ x: pa.x * 50 + 500, y: 330 - pa.y * 50 });
    }
  }

  // Compute smart label placements
  const placedLabels = [];
  const labelDirectives = {};

  for (const [id, proj] of Object.entries(projected2D)) {
    const canvasPt = { x: proj.x * 50 + 500, y: 330 - proj.y * 50 };
    const placement = computeLabelPlacement3D(
      canvasPt,
      neighborsMap.get(id) || [],
      allCanvasSegments,
      placedLabels,
      { label: pointLabels[id], isApex: id === 'S' || pointLabels[id] === 'S' }
    );
    placedLabels.push({ x: placement.centerX, y: placement.centerY });
    labelDirectives[id] = placement.tikzNode;
  }

  // Build TikZ LaTeX output
  let tikz = '\\begin{tikzpicture}[scale=1, line join=round, line cap=round, >=stealth]\n';

  // 1. Define coordinates
  tikz += '  %% Định nghĩa tọa độ điểm đã chiếu theo góc nhìn\n';
  for (const [id, p] of Object.entries(projected2D)) {
    tikz += `  \\coordinate (${id}) at (${p.x.toFixed(2)}, ${p.y.toFixed(2)});\n`;
  }

  // 2. Cross sections if any
  if (doc.solid?.crossSections?.length > 0) {
    tikz += '\n  %% Thiết diện cắt khối đa diện\n';
    for (const cs of doc.solid.crossSections) {
      if (cs.visible !== false) {
        const refs = cs.planeRefs || cs.refs;
        if (refs && refs.length >= 3 && refs.every(r => projected2D[r])) {
          const color = (!cs.color || cs.color.toLowerCase() === '#808080' || cs.color === 'gray') ? 'gray' : (cs.color.startsWith('#') ? `gray` : cs.color);
          const opacity = cs.opacity ?? 0.2;
          tikz += `  \\fill[fill=${color}, fill opacity=${opacity}] (${refs.join(') -- (')}) -- cycle;\n`;
        }
      }
    }
  }

  // 3. Dashed segments
  if (dashedSegments.length > 0) {
    tikz += '\n  %% Các đoạn nét đứt (bị khuất theo góc nhìn hoặc người dùng gán)\n';
    for (const s of dashedSegments) {
      tikz += `  \\draw[dashed] (${s.a}) -- (${s.b});\n`;
    }
  }

  // 4. Solid segments
  if (solidSegments.length > 0) {
    tikz += '\n  %% Các đoạn nét liền (nhìn thấy)\n';
    for (const s of solidSegments) {
      tikz += `  \\draw (${s.a}) -- (${s.b});\n`;
    }
  }

  // 5. Spatial right angles if any
  const angles = (doc.shapes || []).filter(s => s.type === 'angle' && s.mark === 'right' && s.refs?.length === 3);
  if (angles.length > 0) {
    tikz += '\n  %% Ký hiệu góc vuông không gian\n';
    for (const a of angles) {
      const [r0, vertex, r2] = a.refs;
      if (projected2D[r0] && projected2D[vertex] && projected2D[r2]) {
        const isDashed = a.dashed ? '[dashed]' : '';
        tikz += `  \\draw${isDashed} ($ (${vertex})!8pt!(${r0}) $) -- ($ (${vertex})!8pt!(${r0}) + (${vertex})!8pt!(${r2}) - (${vertex}) $) -- ($ (${vertex})!8pt!(${r2}) $);\n`;
      }
    }
  }

  // 6. Points and smart labels
  tikz += '\n  %% Điểm và nhãn thông minh (tránh đè nét)\n';
  for (const [id] of Object.entries(projected2D)) {
    const label = pointLabels[id] || id;
    const dir = labelDirectives[id] || 'above';
    tikz += `  \\fill (${id}) circle (1.2pt) node[${dir}] {$${label}$};\n`;
  }

  tikz += '\\end{tikzpicture}';
  return tikz;
}
