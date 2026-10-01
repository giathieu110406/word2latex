// tests/components/SplitViewWorkspace.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { SplitViewWorkspace } from '../../src/components/SplitViewWorkspace';

describe('SplitViewWorkspace', () => {
  it('renders two main panels', () => {
    render(<SplitViewWorkspace documentId="123" />);
    expect(screen.getByTestId('left-panel-ai')).toBeDefined();
    expect(screen.getByTestId('right-panel-docs')).toBeDefined();
  });
});
