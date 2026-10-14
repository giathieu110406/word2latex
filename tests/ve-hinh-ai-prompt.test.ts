import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('app.js exports or defines modeNames at module scope before render calls', () => {
  const code = fs.readFileSync('public/ve-hinh/src/app.js', 'utf8');
  const lines = code.split('\n');
  const declIndex = lines.findIndex(l => l.includes('const modeNames =') || l.includes('export const modeNames ='));
  assert.ok(declIndex !== -1, 'modeNames must be declared');
  
  const docBlockIndex = lines.findIndex(l => l.includes("if (typeof document !== 'undefined')"));
  assert.ok(declIndex < docBlockIndex, `modeNames (line ${declIndex + 1}) must be defined before the document block (line ${docBlockIndex + 1})`);
});
