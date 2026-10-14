/**
 * 3D Projection Engine
 * Euler rotation matrix R_x(beta) * R_y(alpha), Orthographic and Perspective projections.
 */

const DEG2RAD = Math.PI / 180;

/**
 * Rotate a 3D point around Y-axis (rotation/yaw) then X-axis (tilt/pitch).
 * @param {{x: number, y: number, z: number} | [number, number, number]} p
 * @param {{rotation?: number, tilt?: number}} options
 * @returns {{x: number, y: number, z: number}}
 */
export function rotateEuler(p, { rotation = 0, tilt = 0 } = {}) {
  const x = p.x ?? p[0] ?? 0;
  const y = p.y ?? p[1] ?? 0;
  const z = p.z ?? p[2] ?? 0;

  const rad = rotation * DEG2RAD;
  const tiltRad = tilt * DEG2RAD;

  const cr = Math.cos(rad);
  const sr = Math.sin(rad);
  const ct = Math.cos(tiltRad);
  const st = Math.sin(tiltRad);

  // R_y(alpha)
  const xx = x * cr + z * sr;
  const zz = -x * sr + z * cr;

  // R_x(beta)
  const yy = y * ct - zz * st;
  const zFinal = y * st + zz * ct;

  return { x: xx, y: yy, z: zFinal };
}

/**
 * Project a 3D point to camera coordinates.
 * @param {{x: number, y: number, z: number} | [number, number, number]} point3D
 * @param {{rotation?: number, tilt?: number, projection?: 'orthographic' | 'perspective', dist?: number}} options
 * @returns {{u: number, v: number, depth: number, x: number, y: number}}
 */
export function project3D(point3D, { rotation = 0, tilt = 0, projection = 'orthographic', dist = 10 } = {}) {
  const rotated = rotateEuler(point3D, { rotation, tilt });

  if (projection === 'perspective') {
    const d = dist > 0 ? dist : 10;
    const denom = d + rotated.z;
    const factor = denom > 0.001 ? d / denom : 1;
    const u = rotated.x * factor;
    const v = rotated.y * factor;
    return {
      u,
      v,
      depth: rotated.z,
      x: u,
      y: v
    };
  }

  // Orthographic projection (default for textbook 3D geometry)
  return {
    u: rotated.x,
    v: rotated.y,
    depth: rotated.z,
    x: rotated.x,
    y: rotated.y
  };
}

/**
 * Map a 3D point to SVG screen coordinates.
 * Default canvas size W=1000, H=660, cx=500, cy=330, scale=85.
 * @param {{x: number, y: number, z: number} | [number, number, number]} point3D
 * @param {{rotation?: number, tilt?: number, scale?: number, pan?: {x: number, y: number}, cx?: number, cy?: number, projection?: string, dist?: number}} options
 * @returns {{x: number, y: number, depth: number, u: number, v: number}}
 */
export function screen3D(point3D, {
  rotation = 0,
  tilt = 0,
  scale = 85,
  pan = { x: 0, y: 0 },
  cx = 500,
  cy = 330,
  projection = 'orthographic',
  dist = 10
} = {}) {
  const proj = project3D(point3D, { rotation, tilt, projection, dist });
  const panX = pan?.x || 0;
  const panY = pan?.y || 0;

  const svgX = cx + proj.u * scale + panX;
  const svgY = cy - proj.v * scale + panY;

  return {
    x: svgX,
    y: svgY,
    depth: proj.depth,
    u: proj.u,
    v: proj.v
  };
}

/**
 * Standard Cavalier / Cabinet oblique projection for mathematical chalkboard style.
 * @param {{x: number, y: number, z: number}} p
 * @param {{angle?: number, ratio?: number}} options
 * @returns {{x: number, y: number, depth: number, u: number, v: number}}
 */
export function cavalierProject(p, { angle = 45, ratio = 0.5 } = {}) {
  const x = p.x ?? p[0] ?? 0;
  const y = p.y ?? p[1] ?? 0;
  const z = p.z ?? p[2] ?? 0;

  const rad = angle * DEG2RAD;
  const u = x - ratio * z * Math.cos(rad);
  const v = y - ratio * z * Math.sin(rad);

  return { u, v, depth: z, x: u, y: v };
}
