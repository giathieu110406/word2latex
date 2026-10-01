import { test, expect } from 'vitest';
import { markItDownJob } from '../src/workflows/markitdown';

test('Workflow is defined correctly', () => {
  expect(markItDownJob).toBeDefined();
});
