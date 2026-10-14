import test from 'node:test';
import assert from 'node:assert/strict';

export interface Doc {
  points: Array<{ id: string; label?: string; x: number; y: number; visible?: boolean }>;
  shapes: Array<{ id: string; type: string; refs: string[]; dashed?: boolean; color?: string; visible?: boolean }>;
}

export function exportTikZ(doc: Doc): string {
  let tikz = '\\begin{tikzpicture}[scale=1, line join=round, line cap=round, >=stealth]\n';
  const pointMap = new Map(doc.points.map(p => [p.id, p]));
  for (const p of doc.points) {
    if (p.visible === false) continue;
    const x = typeof p.x === 'number' && Number.isFinite(p.x) ? p.x.toFixed(2) : '0.00';
    const y = typeof p.y === 'number' && Number.isFinite(p.y) ? p.y.toFixed(2) : '0.00';
    tikz += `  \\coordinate (${p.id}) at (${x}, ${y});\n`;
  }
  for (const s of doc.shapes) {
    if (s.visible === false) continue;
    const opt = s.dashed ? '[dashed]' : '';
    if (s.type === 'segment' && s.refs.length >= 2) {
      tikz += `  \\draw${opt} (${s.refs[0]}) -- (${s.refs[1]});\n`;
    } else if (s.type === 'line' && s.refs.length >= 2) {
      tikz += `  \\draw${opt} ($(${s.refs[0]})! -0.5 !(${s.refs[1]})$) -- ($(${s.refs[0]})! 1.5 !(${s.refs[1]})$);\n`;
    } else if (s.type === 'polygon' && s.refs.length >= 3) {
      tikz += `  \\draw${opt} (${s.refs.join(') -- (')}) -- cycle;\n`;
    } else if (s.type === 'vector' && s.refs.length >= 2) {
      tikz += `  \\draw[->${s.dashed ? ', dashed' : ''}] (${s.refs[0]}) -- (${s.refs[1]});\n`;
    } else if (s.type === 'circle' && s.refs.length >= 2) {
      const p1 = pointMap.get(s.refs[0]);
      const p2 = pointMap.get(s.refs[1]);
      const r = p1 && p2 && Number.isFinite(p1.x) && Number.isFinite(p2.x) ? Math.hypot(p2.x - p1.x, p2.y - p1.y).toFixed(2) : '1.00';
      tikz += `  \\draw${opt} (${s.refs[0]}) circle (${r});\n`;
    }
  }
  for (const p of doc.points) {
    if (p.visible === false) continue;
    const label = p.label || p.id;
    tikz += `  \\fill (${p.id}) circle (1.5pt) node[below right] {$${label}$};\n`;
  }
  tikz += '\\end{tikzpicture}';
  return tikz;
}

test('exportTikZ produces valid TikZ code for a triangle', () => {
  const doc: Doc = {
    points: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 4, y: 0, label: 'B' },
      { id: 'C', x: 0, y: 3, label: 'C' }
    ],
    shapes: [
      { id: 's1', type: 'polygon', refs: ['A', 'B', 'C'] }
    ]
  };
  const tikz = exportTikZ(doc);
  assert.match(tikz, /\\begin{tikzpicture}/);
  assert.match(tikz, /\\draw \(A\) -- \(B\) -- \(C\) -- cycle;/);
  assert.match(tikz, /\\coordinate \(A\) at \(0\.00, 0\.00\);/);
  assert.match(tikz, /\\end{tikzpicture}/);
});
