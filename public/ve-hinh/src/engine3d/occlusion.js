/**
 * 3D Occlusion Engine
 * Backface culling, Raycast depth testing for internal segments, and manual override resolution.
 */

import { project3D } from './projection.js';

const EPS = 1e-6;

/**
 * Robust 2D Point-in-Polygon test (Ray Casting algorithm).
 * @param {{x: number, y: number} | [number, number]} pt
 * @param {Array<{x: number, y: number} | [number, number]>} poly
 * @returns {boolean}
 */
export function pointInPolygon2D(pt, poly) {
  if (!poly || poly.length < 3) return false;
  const px = pt.x ?? pt.u ?? pt[0];
  const py = pt.y ?? pt.v ?? pt[1];

  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x ?? poly[i].u ?? poly[i][0];
    const yi = poly[i].y ?? poly[i].v ?? poly[i][1];
    const xj = poly[j].x ?? poly[j].u ?? poly[j][0];
    const yj = poly[j].y ?? poly[j].v ?? poly[j][1];

    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Compute signed area of 2D polygon (Shoelace formula).
 * Positive area indicates counter-clockwise orientation (front-facing in standard projection).
 * @param {Array<{u: number, v: number} | {x: number, y: number} | [number, number]>} pts2D
 * @returns {number}
 */
export function computeSignedArea2D(pts2D) {
  if (!pts2D || pts2D.length < 3) return 0;
  let area2 = 0;
  const n = pts2D.length;
  for (let i = 0; i < n; i++) {
    const p1 = pts2D[i];
    const p2 = pts2D[(i + 1) % n];
    const x1 = p1.u ?? p1.x ?? p1[0];
    const y1 = p1.v ?? p1.y ?? p1[1];
    const x2 = p2.u ?? p2.x ?? p2[0];
    const y2 = p2.v ?? p2.y ?? p2[1];
    area2 += x1 * y2 - x2 * y1;
  }
  return area2 / 2;
}

/**
 * Evaluate if a 3D face is front-facing (visible) from current camera viewpoint.
 * @param {Array<{x: number, y: number, z: number} | [number, number, number]>} face3DVerts
 * @param {{rotation?: number, tilt?: number, projection?: string, dist?: number}} camera
 * @returns {boolean}
 */
export function evaluateFaceVisibility(face3DVerts, camera = {}) {
  if (!face3DVerts || face3DVerts.length < 3) return false;
  const projected = face3DVerts.map(v => project3D(v, camera));
  const area = computeSignedArea2D(projected);
  return area > EPS;
}

/**
 * Normalizes edge representation as sorted key 'A,B'.
 * @param {string | number} a
 * @param {string | number} b
 * @returns {string}
 */
export function edgeKey(a, b) {
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? `${sa},${sb}` : `${sb},${sa}`;
}

/**
 * Classify polyhedron edges into visible (solid) or hidden (dashed) via Backface Culling.
 * An edge is visible if at least one adjacent face is visible.
 * An edge is hidden if all adjacent faces are back-facing.
 * @param {Array<{id?: string, name?: string, verts: Array<any>}>} faces
 * @param {{rotation?: number, tilt?: number}} camera
 * @returns {{
 *   faceVisibility: Map<any, boolean>,
 *   edgeVisibility: Map<string, boolean>,
 *   solidEdges: Set<string>,
 *   dashedEdges: Set<string>
 * }}
 */
export function evaluatePolyhedronEdges(faces, camera = {}) {
  const faceVisibility = new Map();
  const edgeFaces = new Map();

  faces.forEach((face, fIndex) => {
    const fId = face.id ?? face.name ?? fIndex;
    const isVisible = evaluateFaceVisibility(face.verts, camera);
    faceVisibility.set(fId, isVisible);

    const n = face.verts.length;
    for (let i = 0; i < n; i++) {
      const v1 = face.verts[i];
      const v2 = face.verts[(i + 1) % n];
      const key = edgeKey(v1.id ?? v1, v2.id ?? v2);
      if (!edgeFaces.has(key)) edgeFaces.set(key, []);
      edgeFaces.get(key).push(isVisible);
    }
  });

  const edgeVisibility = new Map();
  const solidEdges = new Set();
  const dashedEdges = new Set();

  for (const [key, visList] of edgeFaces.entries()) {
    // Edge is visible if any adjacent face is visible
    const isVisible = visList.some(v => v === true);
    edgeVisibility.set(key, isVisible);
    if (isVisible) {
      solidEdges.add(key);
    } else {
      dashedEdges.add(key);
    }
  }

  return {
    faceVisibility,
    edgeVisibility,
    solidEdges,
    dashedEdges
  };
}

/**
 * Compute the 3D plane normal and depth z at camera projection coordinates (u, v).
 * @param {number} u
 * @param {number} v
 * @param {{u: number, v: number, depth: number}} v0
 * @param {{u: number, v: number, depth: number}} v1
 * @param {{u: number, v: number, depth: number}} v2
 * @returns {number | null}
 */
export function getPlaneDepthAt(u, v, v0, v1, v2) {
  const ax = v1.u - v0.u, ay = v1.v - v0.v, az = v1.depth - v0.depth;
  const bx = v2.u - v0.u, by = v2.v - v0.v, bz = v2.depth - v0.depth;

  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;

  if (Math.abs(nz) < 1e-9) return null;
  return v0.depth - (nx * (u - v0.u) + ny * (v - v0.v)) / nz;
}

/**
 * Raycast Depth Test for internal / free segments against front-facing polyhedron faces.
 * Tests if the segment is occluded by any front-facing face.
 * @param {{x: number, y: number, z: number}} p1
 * @param {{x: number, y: number, z: number}} p2
 * @param {Array<{verts: Array<{x: number, y: number, z: number}>}>} faces
 * @param {{rotation?: number, tilt?: number}} camera
 * @param {{samples?: number[], bias?: number}} options
 * @returns {boolean} true if occluded (should be dashed), false if visible (solid)
 */
export function evaluateSegmentOcclusion(p1, p2, faces, camera = {}, { samples = [0.25, 0.5, 0.75], bias = 0.05 } = {}) {
  // Pre-project front faces
  const frontFaces = [];
  for (const face of faces) {
    const projVerts = face.verts.map(v => project3D(v, camera));
    const area = computeSignedArea2D(projVerts);
    if (area > EPS) {
      frontFaces.push({
        origVerts: face.verts,
        projVerts
      });
    }
  }

  if (frontFaces.length === 0) return false;

  // Check each sample point along the segment
  for (const t of samples) {
    const samplePt = {
      x: (1 - t) * p1.x + t * p2.x,
      y: (1 - t) * p1.y + t * p2.y,
      z: (1 - t) * (p1.z ?? 0) + t * (p2.z ?? 0)
    };
    const projSample = project3D(samplePt, camera);

    for (const ff of frontFaces) {
      // Check if sample point's 2D projection falls inside the 2D projected face
      if (pointInPolygon2D(projSample, ff.projVerts)) {
        // Compute face plane depth at (u, v)
        const v0 = ff.projVerts[0];
        const v1 = ff.projVerts[1];
        const v2 = ff.projVerts[2];
        const zPlane = getPlaneDepthAt(projSample.u, projSample.v, v0, v1, v2);

        if (zPlane !== null && zPlane > projSample.depth + bias) {
          // The face is strictly in front of the sample point
          return true; // Occluded!
        }
      }
    }
  }

  return false;
}

/**
 * Resolve whether a segment is dashed based on styleMode override or calculated occlusion.
 * @param {{styleMode?: 'auto' | 'solid' | 'dashed' | string, style?: string}} segment
 * @param {boolean} isOccluded
 * @returns {boolean} true = dashed, false = solid
 */
export function resolveSegmentDashed(segment, isOccluded) {
  const mode = segment?.styleMode ?? segment?.style ?? 'auto';
  if (mode === 'solid') return false;
  if (mode === 'dashed') return true;
  return Boolean(isOccluded);
}

/**
 * Automatically orient polyhedron faces so their normals point outward relative to the polyhedron centroid.
 * @param {Array<{id?: string, name?: string, verts: any[]}>} rawFaces
 * @param {Record<string, {x: number, y: number, z: number}> | Array<{x: number, y: number, z: number}>} points
 * @returns {Array<{id?: string, name?: string, verts: any[]}>}
 */
export function orientPolyhedronFaces(rawFaces, points) {
  const getPt = v => (typeof v === 'string' ? points[v] : v);

  // Compute centroid of all vertices
  let cx = 0, cy = 0, cz = 0, count = 0;
  const allPts = Array.isArray(points) ? points : Object.values(points);
  for (const p of allPts) {
    if (p) {
      cx += p.x ?? 0;
      cy += p.y ?? 0;
      cz += p.z ?? 0;
      count++;
    }
  }
  if (count > 0) {
    cx /= count;
    cy /= count;
    cz /= count;
  }

  return rawFaces.map(f => {
    const verts = [...f.verts];
    if (verts.length < 3) return f;
    const p0 = getPt(verts[0]);
    const p1 = getPt(verts[1]);
    const p2 = getPt(verts[2]);
    if (!p0 || !p1 || !p2) return f;

    const ax = p1.x - p0.x, ay = p1.y - p0.y, az = (p1.z ?? 0) - (p0.z ?? 0);
    const bx = p2.x - p0.x, by = p2.y - p0.y, bz = (p2.z ?? 0) - (p0.z ?? 0);
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;

    let fx = 0, fy = 0, fz = 0;
    for (const v of verts) {
      const pt = getPt(v);
      fx += pt.x ?? 0;
      fy += pt.y ?? 0;
      fz += pt.z ?? 0;
    }
    fx /= verts.length;
    fy /= verts.length;
    fz /= verts.length;

    const toOutX = fx - cx;
    const toOutY = fy - cy;
    const toOutZ = fz - cz;
    const dot = nx * toOutX + ny * toOutY + nz * toOutZ;

    if (dot < 0) {
      verts.reverse();
    }
    return { ...f, verts };
  });
}

/**
 * Compute 3D Occlusion for a solid: returns dashedSegmentIds and solidSegmentIds
 * @param {any} solidData
 * @param {{rotation?: number, tilt?: number}} camera
 * @returns {{dashedSegmentIds: Set<string>, solidSegmentIds: Set<string>}}
 */
export function compute3DOcclusion(solidData, camera = {}) {
  const dashedSegmentIds = new Set();
  const solidSegmentIds = new Set();
  if (!solidData) return { dashedSegmentIds, solidSegmentIds };

  const rot = camera.rotation ?? solidData.rotation ?? 30;
  const tilt = camera.tilt ?? solidData.tilt ?? 20;
  const cam = { rotation: rot, tilt };

  const ptsMap = {};
  for (const p of solidData.points || []) {
    ptsMap[p.id] = { x: p.x ?? 0, y: p.y ?? 0, z: p.z ?? 0 };
  }

  // Derive faces
  let rawFaces = [];
  if (solidData.type === 'pyramid') {
    rawFaces = [
      { name: 'base', verts: ['A', 'B', 'C', 'D'] },
      { name: 'SAB', verts: ['S', 'A', 'B'] },
      { name: 'SBC', verts: ['S', 'B', 'C'] },
      { name: 'SCD', verts: ['S', 'C', 'D'] },
      { name: 'SDA', verts: ['S', 'D', 'A'] }
    ];
  } else if (solidData.type === 'cube' || solidData.type === 'box') {
    rawFaces = [
      { name: 'bottom', verts: ['A', 'B', 'C', 'D'] },
      { name: 'top', verts: ['A1', 'D1', 'C1', 'B1'] },
      { name: 'front', verts: ['D', 'C', 'C1', 'D1'] },
      { name: 'back', verts: ['B', 'A', 'A1', 'B1'] },
      { name: 'left', verts: ['A', 'D', 'D1', 'A1'] },
      { name: 'right', verts: ['C', 'B', 'B1', 'C1'] }
    ];
  } else if (solidData.type === 'tetrahedron' || solidData.type === 'regular-tetrahedron') {
    rawFaces = [
      { name: 'base', verts: ['A', 'B', 'C'] },
      { name: 'SAB', verts: ['S', 'A', 'B'] },
      { name: 'SBC', verts: ['S', 'B', 'C'] },
      { name: 'SCA', verts: ['S', 'C', 'A'] }
    ];
  } else if (solidData.type === 'frustum') {
    rawFaces = [
      { name: 'bottom', verts: ['A', 'B', 'C', 'D'] },
      { name: 'top', verts: ['A1', 'D1', 'C1', 'B1'] },
      { name: 'front', verts: ['D', 'C', 'C1', 'D1'] },
      { name: 'back', verts: ['B', 'A', 'A1', 'B1'] },
      { name: 'left', verts: ['A', 'D', 'D1', 'A1'] },
      { name: 'right', verts: ['C', 'B', 'B1', 'C1'] }
    ];
  } else if (solidData.type === 'prism') {
    rawFaces = [
      { name: 'bottom', verts: ['A', 'B', 'C'] },
      { name: 'top', verts: ['A1', 'C1', 'B1'] },
      { name: 'ABB1A1', verts: ['A', 'B', 'B1', 'A1'] },
      { name: 'BCC1B1', verts: ['B', 'C', 'C1', 'B1'] },
      { name: 'CAA1C1', verts: ['C', 'A', 'A1', 'C1'] }
    ];
  }

  if (Array.isArray(solidData.planes)) {
    for (const pl of solidData.planes) {
      if (pl.transparent === false && pl.refs && pl.refs.length >= 3) {
        rawFaces.push({ name: pl.id || 'plane', verts: pl.refs });
      }
    }
  }

  const validFaces = rawFaces
    .filter(f => f.verts.every(v => ptsMap[v]))
    .map(f => ({ ...f, verts: f.verts.map(v => ptsMap[v]) }));

  const orientedFaces = orientPolyhedronFaces(validFaces, ptsMap);
  const occPoly = evaluatePolyhedronEdges(orientedFaces, cam);

  for (const s of solidData.segments || []) {
    const p1Id = s.refs?.[0];
    const p2Id = s.refs?.[1];
    const p1 = ptsMap[p1Id];
    const p2 = ptsMap[p2Id];

    let isOccluded = false;
    const isPolyEdge = occPoly.edgeVisibility.get(edgeKey(p1Id, p2Id));
    if (isPolyEdge !== undefined) {
      isOccluded = !isPolyEdge;
    } else if (p1 && p2 && orientedFaces.length > 0) {
      isOccluded = evaluateSegmentOcclusion(p1, p2, orientedFaces, cam);
    }

    const isDashed = resolveSegmentDashed(s, isOccluded);
    if (isDashed) {
      dashedSegmentIds.add(s.id);
    } else {
      solidSegmentIds.add(s.id);
    }
  }

  return { dashedSegmentIds, solidSegmentIds };
}
