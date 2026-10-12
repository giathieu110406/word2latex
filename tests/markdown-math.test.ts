import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { normalizeMarkdownMath } from '../src/utils/markdown-math.js';

test('normalizeMarkdownMath: splits adjacent display math blocks with case environment', () => {
  const input = `
Cho bài toán gốc:
$$(P) : f(x) = 10x_1 - 5x_2 + 2x_3 \\to \\text{Max}$$
Các ràng buộc:
$$\\begin{cases} 
2x_1 + 14x_2 + 2x_3 \\le 0 \\\\ 
x_1 - 7x_2 - x_3 \\le 1 \\\\ 
16x_1 - 2x_2 \\le 10 
\\end{cases}$$
$$x_1 \\ge 0, \\quad x_2 \\ge 0, \\quad x_3 \\ge 0$$

## Câu 2 (3 điểm):
Nội dung câu 2
`;

  const normalized = normalizeMarkdownMath(input);
  
  // Render test
  const html = renderToStaticMarkup(
    React.createElement(
      Markdown,
      {
        remarkPlugins: [remarkMath, remarkGfm],
        rehypePlugins: [[rehypeKatex, { throwOnError: false, strict: false }]],
      },
      normalized
    )
  );

  assert.ok(!html.includes('undefined'), 'HTML must not contain "undefined" error node');
  assert.ok(html.includes('Câu 2'), 'HTML must preserve subsequent text (Câu 2)');
  assert.ok(html.includes('Nội dung câu 2'), 'HTML must preserve details of Câu 2');
});

test('normalizeMarkdownMath: preserves code blocks without modifying math inside', () => {
  const input = '```markdown\n$$\\begin{cases}\nx = 1\n\\end{cases}$$\n```\n\nNội dung ngoài code block';
  const normalized = normalizeMarkdownMath(input);

  assert.ok(normalized.includes('```markdown\n$$\\begin{cases}\nx = 1\n\\end{cases}$$\n```'));
  assert.ok(normalized.includes('Nội dung ngoài code block'));
});

test('normalizeMarkdownMath: handles single-line display math correctly', () => {
  const input = '$$(P) : f(x) = 10x_1 - 5x_2 + 2x_3 \\to \\text{Max}$$';
  const normalized = normalizeMarkdownMath(input);

  assert.ok(normalized.includes('$$(P) : f(x) = 10x_1 - 5x_2 + 2x_3 \\to \\text{Max}$$'));
});

import fs from 'node:fs';

test('normalizeMarkdownMath: handles user test file full output without errors', () => {
  if (fs.existsSync('scratch/ai_output.md')) {
    const raw = fs.readFileSync('scratch/ai_output.md', 'utf-8');
    const normalized = normalizeMarkdownMath(raw);
    const html = renderToStaticMarkup(
      React.createElement(
        Markdown,
        {
          remarkPlugins: [remarkMath, remarkGfm],
          rehypePlugins: [[rehypeKatex, { throwOnError: false, strict: false }]],
        },
        normalized
      )
    );

    assert.ok(!html.includes('undefined'), 'Full document must not have undefined error');
    assert.ok(html.includes('Câu 2'), 'Full document must render Câu 2');
    assert.ok(html.includes('Câu 3'), 'Full document must render Câu 3');
    assert.ok(html.includes('Đáp án'), 'Full document must render Đáp án');
  }
});
