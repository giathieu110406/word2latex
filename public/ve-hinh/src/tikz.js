import { resolve } from './math.js';

export function exportTikZ(doc) {
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
    const opt = s.dashed ? '[dashed]' : '';

    if (s.type === 'segment' && s.refs.length >= 2) {
      tikz += `  \\draw${opt} (${s.refs[0]}) -- (${s.refs[1]});\n`;
    } else if (s.type === 'line' && s.refs.length >= 2) {
      tikz += `  \\draw${opt} ($(${s.refs[0]})! -0.5 !(${s.refs[1]})$) -- ($(${s.refs[0]})! 1.5 !(${s.refs[1]})$);\n`;
    } else if (s.type === 'ray' && s.refs.length >= 2) {
      tikz += `  \\draw${opt} (${s.refs[0]}) -- ($(${s.refs[0]})! 1.5 !(${s.refs[1]})$);\n`;
    } else if (s.type === 'polygon' && s.refs.length >= 3) {
      tikz += `  \\draw${opt} (${s.refs.join(') -- (')}) -- cycle;\n`;
    } else if (s.type === 'vector' && s.refs.length >= 2) {
      tikz += `  \\draw[->${s.dashed ? ', dashed' : ''}] (${s.refs[0]}) -- (${s.refs[1]});\n`;
    } else if (s.type === 'circle' && s.refs.length >= 2) {
      const p1 = points[s.refs[0]];
      const p2 = points[s.refs[1]];
      const r = p1 && p2 ? Math.hypot(p2.x - p1.x, p2.y - p1.y).toFixed(2) : '1.00';
      tikz += `  \\draw${opt} (${s.refs[0]}) circle (${r});\n`;
    }
  }

  for (const [id, p] of Object.entries(points)) {
    if (p.visible === false) continue;
    const label = p.label || id;
    tikz += `  \\fill (${id}) circle (1.5pt) node[below right] {$${label}$};\n`;
  }

  tikz += '\\end{tikzpicture}';
  return tikz;
}
