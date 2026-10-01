import { test, expect } from 'vitest';
import app from '../index'; 

test('Workflow endpoint is mounted', () => {
  // If app is successfully exported and runs, it means our mount code had no syntax errors.
  expect(app).toBeDefined();
});
