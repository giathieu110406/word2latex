import { evaluateExpression,detectExpressionType,normalizeToLHS } from './expression.js';

export const tableExpressions = expressions => expressions.filter(e => e.visible !== false && detectExpressionType(e.expr) === 'explicit');

export function generateTable(expressions, params, xStart, xEnd, xStep) {
  const rows = [];
  const pObj = Object.fromEntries(params.map(p => [p.name, p.value]));
  const visibleExprs = tableExpressions(expressions);
  const epsilon = 1e-9;
  
  if (xStep <= 0) return rows;

  for (let x = xStart; x <= xEnd + epsilon; x += xStep) {
    const cleanX = Math.round(x * 1e8) / 1e8;
    const row = { x: cleanX };
    
    for (const e of visibleExprs) {
      try {
        const val = evaluateExpression(normalizeToLHS(e.expr).lhs, cleanX, pObj);
        row[e.id] = Number.isFinite(val) ? val : null;
      } catch (err) {
        row[e.id] = null;
      }
    }
    rows.push(row);
  }
  return rows;
}
