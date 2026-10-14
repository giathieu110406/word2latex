import test from 'node:test';
import assert from 'node:assert/strict';
import { getDrawingProviderConfig, parseProposal } from '../api/ve-hinh';

test('getDrawingProviderConfig prioritizes gemini-2.5-flash', () => {
  const config = getDrawingProviderConfig({ GEMINI_API_KEY: 'test-key' });
  assert.equal(config.provider, 'gemini');
  assert.equal(config.model, 'gemini-2.5-flash');
  assert.equal(config.configured, true);
});

test('parseProposal parses valid proposal JSON', () => {
  const jsonStr = JSON.stringify({
    document: {
      version: 1,
      title: 'Tam giác ABC',
      points: [
        { id: 'A', x: 0, y: 0, label: 'A' },
        { id: 'B', x: 4, y: 0, label: 'B' },
        { id: 'C', x: 0, y: 3, label: 'C' }
      ],
      shapes: [
        { id: 's1', type: 'polygon', refs: ['A', 'B', 'C'] }
      ]
    },
    uncertainties: [],
    extractedText: 'Cho tam giác ABC'
  });
  const result = parseProposal(jsonStr);
  assert.equal(result.document.title, 'Tam giác ABC');
  assert.equal(result.document.points.length, 3);
});
