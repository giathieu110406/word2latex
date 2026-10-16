import { resolve } from './math.js';
import { exportTikZ3D } from './engine3d/tikz3d.js';

export { exportTikZ3D };

/**
 * Convert color string to standard TikZ color name or {rgb,255:red,R;green,G;blue,B}
 * @param {string} color
 * @returns {string|null}
 */
export function formatTikZColor(color) {
  if (!color || typeof color !== 'string') return null;
  const c = color.trim().toLowerCase();
  const standardNamed = [
    'black', 'blue', 'brown', 'cyan', 'darkgray', 'gray', 'green',
    'lightgray', 'lime', 'magenta', 'olive', 'orange', 'pink',
    'purple', 'red', 'teal', 'violet', 'white', 'yellow'
  ];
  if (standardNamed.includes(c) || c.includes('!')) return c;

  if (c.startsWith('#')) {
    const hex = c.slice(1);
    let r, g, b;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return `{rgb,255:red,${r};green,${g};blue,${b}}`;
    }
  }
  return null;
}

/**
 * Build TikZ option string from shape attributes
 * @param {any} s
 * @param {string[]} extra
 * @returns {string}
 */
export function buildTikZOptions(s, extra = []) {
  const opts = [...extra];
  if (s.dashed) opts.push('dashed');
  if (s.color && s.color !== '#176b52' && s.color !== '#000000' && s.color !== 'black') {
    const col = formatTikZColor(s.color);
    if (col) opts.push(`draw=${col}`);
  }
  if (s.strokeWidth && Number.isFinite(s.strokeWidth)) {
    if (Math.abs(s.strokeWidth - 1.5) < 0.2) opts.push('thin');
    else if (Math.abs(s.strokeWidth - 2.5) < 0.3) { /* default */ }
    else if (s.strokeWidth >= 3.5) opts.push('ultra thick');
    else opts.push(`line width=${s.strokeWidth.toFixed(1)}pt`);
  }
  return opts.length > 0 ? `[${opts.join(', ')}]` : '';
}

export function exportTikZ(doc, options = {}) {
  const is3D = doc?.mode === 'solid' ||
    (doc?.solid?.points && doc.solid.points.length > 0) ||
    (doc?.solid?.segments && doc.solid.segments.length > 0) ||
    (doc?.points && doc.points.some(p => p.z !== undefined)) ||
    (doc?.solid?.enabled === true && doc?.mode !== 'geometry');

  if (is3D) {
    return exportTikZ3D(doc, options);
  }

  const resolved = resolve(doc);
  const points = resolved.points;
  let tikz = '\\begin{tikzpicture}[scale=1, line join=round, line cap=round, >=stealth]\n';

  for (const [id, p] of Object.entries(points)) {
    if (p.visible === false) continue;
    const x = typeof p.x === 'number' && Number.isFinite(p.x) ? p.x.toFixed(2) : '0.00';
    const y = typeof p.y === 'number' && Number.isFinite(p.y) ? p.y.toFixed(2) : '0.00';
    tikz += `  \\coordinate (${id}) at (${x}, ${y});\n`;
  }

  for (const s of doc.shapes) {
    if (s.visible === false) continue;
    const pRefs = s.refs.map(r => points[r]);
    if (pRefs.some(p => !p)) continue;
    const opt = buildTikZOptions(s);

    if (s.type === 'segment' && s.refs.length >= 2) {
      tikz += `  \\draw${opt} (${s.refs[0]}) -- (${s.refs[1]});\n`;
      if (s.mark && ['tick', 'single', 'double', 'triple'].includes(s.mark)) {
        const p1 = points[s.refs[0]], p2 = points[s.refs[1]];
        const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy);
        if (L > 1e-4) {
          const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
          const nx = -dy / L, ny = dx / L;
          const ux = dx / L, uy = dy / L;
          const h = 0.12, sp = 0.05;
          const offsets = s.mark === 'triple' ? [-sp, 0, sp] : s.mark === 'double' ? [-sp, sp] : [0];
          for (const off of offsets) {
            const cx = mx + ux * off, cy = my + uy * off;
            tikz += `  \\draw${opt} (${(cx - nx * h).toFixed(2)}, ${(cy - ny * h).toFixed(2)}) -- (${(cx + nx * h).toFixed(2)}, ${(cy + ny * h).toFixed(2)});\n`;
          }
        }
      }
    } else if (s.type === 'line' && s.refs.length >= 2) {
      tikz += `  \\draw${opt} ($(${s.refs[0]})! -0.5 !(${s.refs[1]})$) -- ($(${s.refs[0]})! 1.5 !(${s.refs[1]})$);\n`;
    } else if (s.type === 'ray' && s.refs.length >= 2) {
      tikz += `  \\draw${opt} (${s.refs[0]}) -- ($(${s.refs[0]})! 1.5 !(${s.refs[1]})$);\n`;
    } else if (s.type === 'polygon' && s.refs.length >= 3) {
      const fillColor = formatTikZColor(s.fill) || s.fill;
      const fillOpt = s.fill ? `[fill=${fillColor}, fill opacity=${s.fillOpacity ?? 0.1}] ` : '';
      if (fillOpt) tikz += `  \\fill${fillOpt}(${s.refs.join(') -- (')}) -- cycle;\n`;
      tikz += `  \\draw${opt} (${s.refs.join(') -- (')}) -- cycle;\n`;
    } else if (s.type === 'vector' && s.refs.length >= 2) {
      const vOpts = ['->'];
      if (s.dashed) vOpts.push('dashed');
      if (s.color) {
        const col = formatTikZColor(s.color);
        if (col) vOpts.push(`draw=${col}`);
      }
      if (s.strokeWidth && Number.isFinite(s.strokeWidth)) {
        if (Math.abs(s.strokeWidth - 1.5) < 0.2) vOpts.push('thin');
        else if (Math.abs(s.strokeWidth - 2.5) < 0.3) { /* default */ }
        else if (s.strokeWidth >= 3.5) vOpts.push('ultra thick');
        else vOpts.push(`line width=${s.strokeWidth.toFixed(1)}pt`);
      }
      tikz += `  \\draw[${vOpts.join(', ')}] (${s.refs[0]}) -- (${s.refs[1]});\n`;
    } else if (s.type === 'circle' && s.refs.length >= 2) {
      const p1 = points[s.refs[0]];
      const p2 = points[s.refs[1]];
      const r = p1 && p2 ? Math.hypot(p2.x - p1.x, p2.y - p1.y).toFixed(2) : '1.00';
      tikz += `  \\draw${opt} (${s.refs[0]}) circle (${r});\n`;
    } else if ((s.type === 'arc' || s.type === 'sector') && s.refs.length >= 3) {
      const p0 = points[s.refs[0]], p1 = points[s.refs[1]], p2 = points[s.refs[2]];
      const r = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      let a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
      let a2 = Math.atan2(p2.y - p0.y, p2.x - p0.x) * 180 / Math.PI;
      if (a1 < 0) a1 += 360;
      if (a2 < 0) a2 += 360;
      const angleDiff = Math.abs(a2 - a1);
      const isFullCircle = angleDiff < 1e-4 || Math.abs(angleDiff - 360) < 1e-4;

      if (s.type === 'arc') {
        if (isFullCircle) {
          tikz += `  \\draw${opt} (${s.refs[0]}) circle (${r.toFixed(2)});\n`;
        } else {
          if (a2 <= a1 + 1e-4) a2 += 360;
          tikz += `  \\draw${opt} (${s.refs[0]}) ++(${a1.toFixed(1)}:${r.toFixed(2)}) arc (${a1.toFixed(1)}:${a2.toFixed(1)}:${r.toFixed(2)});\n`;
        }
      } else {
        if (a2 <= a1 + 1e-4) a2 += 360;
        const rawFill = s.fill || 'teal';
        const fillColor = formatTikZColor(rawFill) || rawFill;
        const opacity = s.fillOpacity ?? 0.2;
        tikz += `  \\fill[fill=${fillColor}, fill opacity=${opacity}] (${s.refs[0]}) -- ++(${a1.toFixed(1)}:${r.toFixed(2)}) arc (${a1.toFixed(1)}:${a2.toFixed(1)}:${r.toFixed(2)}) -- cycle;\n`;
        tikz += `  \\draw${opt} (${s.refs[0]}) -- ++(${a1.toFixed(1)}:${r.toFixed(2)}) arc (${a1.toFixed(1)}:${a2.toFixed(1)}:${r.toFixed(2)}) -- cycle;\n`;
      }
    } else if (s.type === 'ellipse' && s.refs.length >= 2) {
      const p0 = points[s.refs[0]], p1 = points[s.refs[1]];
      const rx = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const ry = s.refs[2] && points[s.refs[2]] ? Math.hypot(points[s.refs[2]].x - p0.x, points[s.refs[2]].y - p0.y) : (s.ry || 0.6 * rx);
      const deg = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI;
      const rotOpt = Math.abs(deg) > 0.05 ? `rotate around={${deg.toFixed(1)}:(${s.refs[0]})}` : null;
      const opt = buildTikZOptions(s, rotOpt ? [rotOpt] : []);
      if (s.fill) {
        const rawFill = s.fill;
        const fillColor = formatTikZColor(rawFill) || rawFill;
        const fillOpts = [`fill=${fillColor}`, `fill opacity=${s.fillOpacity ?? 0.2}`];
        if (rotOpt) fillOpts.unshift(rotOpt);
        tikz += `  \\fill[${fillOpts.join(', ')}] (${s.refs[0]}) ellipse (${rx.toFixed(2)} and ${ry.toFixed(2)});\n`;
      }
      tikz += `  \\draw${opt} (${s.refs[0]}) ellipse (${rx.toFixed(2)} and ${ry.toFixed(2)});\n`;
    } else if (s.type === 'angle' && s.refs.length >= 3) {
      const p0 = points[s.refs[0]], vertex = points[s.refs[1]], p2 = points[s.refs[2]];
      const u = { x: p0.x - vertex.x, y: p0.y - vertex.y };
      const v = { x: p2.x - vertex.x, y: p2.y - vertex.y };
      const nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y);
      if (nu > 1e-4 && nv > 1e-4) {
        const opt = buildTikZOptions(s);
        if (s.mark === 'right') {
          const r = 0.25;
          const pA = { x: vertex.x + (u.x / nu) * r, y: vertex.y + (u.y / nu) * r };
          const pB = { x: pA.x + (v.x / nv) * r, y: pA.y + (v.y / nu) * r };
          const pC = { x: vertex.x + (v.x / nv) * r, y: vertex.y + (v.y / nv) * r };
          tikz += `  \\draw${opt} (${pA.x.toFixed(2)}, ${pA.y.toFixed(2)}) -- (${pB.x.toFixed(2)}, ${pB.y.toFixed(2)}) -- (${pC.x.toFixed(2)}, ${pC.y.toFixed(2)});\n`;
        } else {
          let a1 = Math.atan2(u.y, u.x) * 180 / Math.PI;
          let a2 = Math.atan2(v.y, v.x) * 180 / Math.PI;
          let diff = a2 - a1;
          while (diff <= -180) diff += 360;
          while (diff > 180) diff -= 360;
          let startAngle = a1;
          let endAngle = a1 + diff;
          if (diff < 0) {
            startAngle = a1 + diff;
            endAngle = a1;
          }
          if (s.mark === 'double') {
            tikz += `  \\draw${opt} (${s.refs[1]}) ++(${startAngle.toFixed(1)}:0.30) arc (${startAngle.toFixed(1)}:${endAngle.toFixed(1)}:0.30);\n`;
            tikz += `  \\draw${opt} (${s.refs[1]}) ++(${startAngle.toFixed(1)}:0.38) arc (${startAngle.toFixed(1)}:${endAngle.toFixed(1)}:0.38);\n`;
          } else if (s.mark === 'triple') {
            tikz += `  \\draw${opt} (${s.refs[1]}) ++(${startAngle.toFixed(1)}:0.26) arc (${startAngle.toFixed(1)}:${endAngle.toFixed(1)}:0.26);\n`;
            tikz += `  \\draw${opt} (${s.refs[1]}) ++(${startAngle.toFixed(1)}:0.32) arc (${startAngle.toFixed(1)}:${endAngle.toFixed(1)}:0.32);\n`;
            tikz += `  \\draw${opt} (${s.refs[1]}) ++(${startAngle.toFixed(1)}:0.38) arc (${startAngle.toFixed(1)}:${endAngle.toFixed(1)}:0.38);\n`;
          } else if (s.mark === 'single' || s.mark === 'tick') {
            tikz += `  \\draw${opt} (${s.refs[1]}) ++(${startAngle.toFixed(1)}:0.35) arc (${startAngle.toFixed(1)}:${endAngle.toFixed(1)}:0.35);\n`;
          }
        }
      }
    }
  }

  for (const [id, p] of Object.entries(points)) {
    if (p.visible === false) continue;
    const label = p.label || id;
    const labelNode = p.labelVisible === false ? '' : ` node[below right] {$${label}$}`;
    tikz += `  \\fill (${id}) circle (1.5pt)${labelNode};\n`;
  }

  tikz += '\\end{tikzpicture}';
  return tikz;
}
