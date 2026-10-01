// tests/components/GooglePickerBtn.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { GooglePickerBtn } from '../../src/components/GooglePickerBtn';

describe('GooglePickerBtn', () => {
  it('renders a button with correct text', () => {
    render(<GooglePickerBtn onFileSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /Chọn từ Google Drive/i })).toBeDefined();
  });
});
