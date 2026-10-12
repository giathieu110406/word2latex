/**
 * Tiện ích chuẩn hóa công thức toán LaTeX trong Markdown.
 * Đảm bảo remark-math và rehype-katex phân tích cú pháp chính xác,
 * ngăn chặn lỗi tràn block hoặc nuốt nội dung phía sau tài liệu.
 */

export function normalizeMarkdownMath(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return '';

  // 1. Tách và bảo vệ các khối code block (``` ... ```)
  const codeBlocks: string[] = [];
  let placeholderIndex = 0;
  const withProtectedCode = markdown.replace(/```[\s\S]*?```/g, (match) => {
    const key = `@@CODE_BLOCK_${placeholderIndex++}@@`;
    codeBlocks.push(match);
    return key;
  });

  // 2. Chuẩn hóa từng dòng để tách opening/closing delimiter nếu bị dính text
  const lines = withProtectedCode.split(/\r?\n/);
  const normalizedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // TH1: Dòng bắt đầu bằng $$ nhưng có chứa nội dung và không kết thúc bằng $$
    // Ví dụ: "$$\begin{cases}" hoặc "$$ [P] : f(x) ..." (kéo dài nhiều dòng)
    if (trimmed.startsWith('$$') && !trimmed.endsWith('$$') && trimmed.length > 2) {
      const rest = trimmed.slice(2).trim();
      normalizedLines.push('$$');
      if (rest) {
        normalizedLines.push(rest);
      }
      continue;
    }

    // TH2: Dòng kết thúc bằng $$ nhưng có chứa nội dung và không bắt đầu bằng $$
    // Ví dụ: "\end{cases}$$"
    if (!trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 2) {
      const rest = trimmed.slice(0, trimmed.length - 2).trim();
      if (rest) {
        normalizedLines.push(rest);
      }
      normalizedLines.push('$$');
      continue;
    }

    normalizedLines.push(line);
  }

  let text = normalizedLines.join('\n');

  // 3. Đảm bảo trước và sau các dòng chỉ chứa "$$" đều có dòng trống
  // Để remark-math nhận diện đúng block fence trong CommonMark
  text = text.replace(/([^\n])\n(\s*\$\$\s*)\n/g, (_, p1, p2) => `${p1}\n\n${p2}\n`);
  text = text.replace(/\n(\s*\$\$\s*)\n([^\n])/g, (_, p1, p2) => `\n${p1}\n\n${p2}`);

  // 4. Đảm bảo giữa 2 khối $$ liên tiếp nhau có ít nhất 1 dòng trống
  text = text.replace(/(\$\$\s*)\n(\s*\$\$)/g, (_, p1, p2) => `${p1}\n\n${p2}`);

  // 5. Khôi phục lại các code blocks đã bảo vệ
  text = text.replace(/@@CODE_BLOCK_(\d+)@@/g, (_, index) => {
    const idx = parseInt(index, 10);
    return codeBlocks[idx] ?? '';
  });

  return text;
}
