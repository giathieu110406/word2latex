/**
 * 3D Smart Label Placement Engine
 * Maximum Angular Gap Bisector, Edge avoidance penalty scoring, and TikZ direction mapping.
 */

import { distToSegment } from '../render.js';

const TWO_PI = 2 * Math.PI;

function normalizeAngle(a) {
  let res = a % TWO_PI;
  if (res < 0) res += TWO_PI;
  return res;
}

function angleDiff(a, b) {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return d > Math.PI ? TWO_PI - d : d;
}

/**
 * The 8 standard TikZ directional nodes with their SVG layout offsets.
 * In SVG canvas (W=1000, H=660), +x is right, +y is down.
 */
export const CANDIDATE_DIRECTIONS = [
  {
    dir: 'right',
    angle: 0,
    dx: 10, dy: 0,
    cx: 16, cy: 0,
    anchor: 'start',
    baseline: 'central'
  },
  {
    dir: 'below right',
    angle: Math.PI / 4,
    dx: 8, dy: 8,
    cx: 14, cy: 12,
    anchor: 'start',
    baseline: 'hanging'
  },
  {
    dir: 'below',
    angle: Math.PI / 2,
    dx: 0, dy: 10,
    cx: 0, cy: 16,
    anchor: 'middle',
    baseline: 'hanging'
  },
  {
    dir: 'below left',
    angle: (3 * Math.PI) / 4,
    dx: -8, dy: 8,
    cx: -14, cy: 12,
    anchor: 'end',
    baseline: 'hanging'
  },
  {
    dir: 'left',
    angle: Math.PI,
    dx: -10, dy: 0,
    cx: -16, cy: 0,
    anchor: 'end',
    baseline: 'central'
  },
  {
    dir: 'above left',
    angle: (5 * Math.PI) / 4,
    dx: -8, dy: -8,
    cx: -14, cy: -12,
    anchor: 'end',
    baseline: 'auto'
  },
  {
    dir: 'above',
    angle: (3 * Math.PI) / 2,
    dx: 0, dy: -10,
    cx: 0, cy: -16,
    anchor: 'middle',
    baseline: 'auto'
  },
  {
    dir: 'above right',
    angle: (7 * Math.PI) / 4,
    dx: 8, dy: -8,
    cx: 14, cy: -12,
    anchor: 'start',
    baseline: 'auto'
  }
];

/**
 * Compute optimal smart label placement for a projected 2D point.
 * @param {{x: number, y: number}} p - 2D point on canvas
 * @param {Array<{x: number, y: number}>} incidentNeighbors - Neighbors connected to p
 * @param {Array<{a: {x: number, y: number}, b: {x: number, y: number}}>} allSegments - All canvas segments to avoid
 * @param {Array<{x: number, y: number}>} placedLabels - Label centers already placed
 * @param {{label?: string, isApex?: boolean}} options - Context flags
 * @returns {{
 *   x: number,
 *   y: number,
 *   centerX: number,
 *   centerY: number,
 *   anchor: string,
 *   baseline: string,
 *   tikzNode: string,
 *   dir: string,
 *   score: number
 * }}
 */
export function computeLabelPlacement3D(
  p,
  incidentNeighbors = [],
  allSegments = [],
  placedLabels = [],
  options = {}
) {
  const edgeAngles = [];
  for (const n of incidentNeighbors) {
    if (!n) continue;
    const dx = n.x - p.x;
    const dy = n.y - p.y;
    if (Math.hypot(dx, dy) > 1e-3) {
      edgeAngles.push(normalizeAngle(Math.atan2(dy, dx)));
    }
  }

  // Find maximum angular gap bisector
  let bestBisector = (3 * Math.PI) / 2; // Default above
  let maxGap = 0;

  if (edgeAngles.length >= 2) {
    edgeAngles.sort((a, b) => a - b);
    const k = edgeAngles.length;
    for (let i = 0; i < k; i++) {
      const a1 = edgeAngles[i];
      const a2 = i === k - 1 ? edgeAngles[0] + TWO_PI : edgeAngles[i + 1];
      const gap = a2 - a1;
      if (gap > maxGap) {
        maxGap = gap;
        bestBisector = normalizeAngle(a1 + gap / 2);
      }
    }
  } else if (edgeAngles.length === 1) {
    bestBisector = normalizeAngle(edgeAngles[0] + Math.PI);
    maxGap = Math.PI;
  } else {
    maxGap = TWO_PI;
  }

  const isApex = options.isApex || options.label === 'S' ||
    (edgeAngles.length > 0 && edgeAngles.every(a => a >= 0 && a <= Math.PI)); // All edges point down

  let bestCand = null;
  let bestScore = -Infinity;

  for (const cand of CANDIDATE_DIRECTIONS) {
    let score = 100;

    // Alignment with maximum gap bisector
    const diffToBisector = angleDiff(cand.angle, bestBisector);
    score += Math.cos(diffToBisector) * 300;

    // Penalty for being too close to any incident edge line
    for (const ea of edgeAngles) {
      const diff = angleDiff(cand.angle, ea);
      if (diff < 0.44) {
        // within ~25 deg
        score -= 5000;
      } else if (diff < 0.78) {
        // within ~45 deg
        score -= (0.78 - diff) * 2000;
      } else {
        score += diff * 50;
      }
    }

    const labelCenterX = p.x + cand.cx;
    const labelCenterY = p.y + cand.cy;

    // Penalty for collision with any line segment
    for (const seg of allSegments) {
      if (!seg?.a || !seg?.b) continue;
      const d = distToSegment(labelCenterX, labelCenterY, seg.a.x, seg.a.y, seg.b.x, seg.b.y);
      if (d < 8) {
        score -= 6000;
      } else if (d < 16) {
        score -= (16 - d) * 300;
      } else {
        score += Math.min(d, 35) * 6;
      }
    }

    // Penalty for collision with previously placed labels
    for (const pl of placedLabels) {
      const dPl = Math.hypot(labelCenterX - pl.x, labelCenterY - pl.y);
      if (dPl < 22) {
        score -= 4000;
      } else if (dPl < 35) {
        score -= (35 - dPl) * 100;
      }
    }

    // Bonus for top apex prioritizing upward directions (above, above left, above right)
    if (isApex) {
      if (cand.dir === 'above') score += 1200;
      else if (cand.dir === 'above left' || cand.dir === 'above right') score += 800;
      else if (cand.dir.startsWith('below')) score -= 2500;
    }

    // Canvas boundary avoidance
    if (labelCenterX < 20 || labelCenterX > 980 || labelCenterY < 20 || labelCenterY > 640) {
      score -= 5000;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCand = {
        cand,
        labelCenterX,
        labelCenterY
      };
    }
  }

  const chosen = bestCand ? bestCand.cand : CANDIDATE_DIRECTIONS[6]; // default above
  const textX = p.x + chosen.dx;
  const textY = p.y + chosen.dy;
  const centerX = bestCand ? bestCand.labelCenterX : p.x;
  const centerY = bestCand ? bestCand.labelCenterY : p.y - 14;

  return {
    x: textX,
    y: textY,
    centerX,
    centerY,
    anchor: chosen.anchor,
    baseline: chosen.baseline,
    tikzNode: chosen.dir,
    dir: chosen.dir,
    score: bestScore
  };
}
