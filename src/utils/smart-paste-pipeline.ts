import { maskProtectedContent } from './latex-content';

export type QuestionType =
  | 'trac_nghiem'
  | 'trac_nghiem_dung_sai'
  | 'trac_nghiem_tra_loi_ngan'
  | 'tu_luan';

export interface ParsedStatementItem {
  id: string;
  label: string;
  content: string;
  isTrue: boolean;
}

export interface SmartPasteParsedQuestion {
  number?: number;
  question: string;
  answer: string;
  type: QuestionType;
  columns?: number;
  statements?: ParsedStatementItem[];
  shortAnswer?: string;
}

export interface TrailingAnswerExtraction {
  bodyWithoutTrailingKey: string;
  answerKeyByNum: Map<number, string>;
  solutionByNum: Map<number, string>;
}

const TRAILING_HEADER_REGEX = /(?:^|\n)\s*(?:\*\*|__)?(?:BẢNG\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN\s+THAM\s+KHẢO|HƯỚNG\s+DẪN\s+GIẢI(?:\s+CHI\s+TIẾT)?|LỜI\s+GIẢI\s+CHI\s+TIẾT)(?:\*\*|__)?\s*:?\s*(?:\n|$)/i;

export function extractTrailingAnswerKeyMap(rawText: string): TrailingAnswerExtraction {
  const normalized = (rawText || '').replace(/\r\n/g, '\n');
  const answerKeyByNum = new Map<number, string>();
  const solutionByNum = new Map<number, string>();

  const { masked, restore } = maskProtectedContent(normalized);
  const headerMatch = masked.match(TRAILING_HEADER_REGEX);
  if (!headerMatch || headerMatch.index === undefined) {
    return { bodyWithoutTrailingKey: normalized, answerKeyByNum, solutionByNum };
  }

  const cutIdx = headerMatch.index;
  const bodyWithoutTrailingKey = restore(masked.slice(0, cutIdx)).trim();
  const trailingPartMasked = masked.slice(cutIdx);
  const trailingPart = restore(trailingPartMasked);

  // Tách phần LỜI GIẢI CHI TIẾT nếu có bên trong trailingPart
  const solutionHeaderRegex = /(?:^|\n)\s*(?:\*\*|__)?(?:HƯỚNG\s+DẪN\s+GIẢI(?:\s+CHI\s+TIẾT)?|LỜI\s+GIẢI\s+CHI\s+TIẾT)(?:\*\*|__)?\s*:?\s*(?:\n|$)/i;
  const solHeaderMatch = trailingPartMasked.match(solutionHeaderRegex);

  let keyGridSection = trailingPart;
  let detailedSolutionSection = '';

  if (solHeaderMatch && solHeaderMatch.index !== undefined) {
    keyGridSection = restore(trailingPartMasked.slice(0, solHeaderMatch.index));
    detailedSolutionSection = restore(
      trailingPartMasked.slice(solHeaderMatch.index + solHeaderMatch[0].length)
    );
  }

  // Parse compact grid: "1.A 2.C 3.D" hoặc "Câu 1: A" hoặc "| 1 | A |"
  const compactPairRegex = /(?:Câu\s*)?(\d{1,3})\s*[\.\:\-\)\s\|]\s*([A-D])\b/gi;
  let m: RegExpExecArray | null;
  while ((m = compactPairRegex.exec(keyGridSection)) !== null) {
    const num = Number(m[1]);
    const letter = m[2].toUpperCase();
    if (num > 0 && !answerKeyByNum.has(num)) {
      answerKeyByNum.set(num, letter);
    }
  }

  // Parse detailed solutions per question: "Câu 1: ... Câu 2: ..."
  const solSource = detailedSolutionSection || trailingPart;
  const solMasked = maskProtectedContent(solSource);
  const qSplitRegex = /(?:^|\n)\s*(?:\*\*|__)?(?:Câu|Bài)\s+(\d{1,3})\s*[\.\:\-\)]?\s*(?:\*\*|__)?/gi;
  const matches: { num: number; start: number; contentStart: number }[] = [];
  let qm: RegExpExecArray | null;
  while ((qm = qSplitRegex.exec(solMasked.masked)) !== null) {
    const leadNewline = qm[0].startsWith('\n') ? 1 : 0;
    matches.push({
      num: Number(qm[1]),
      start: qm.index + leadNewline,
      contentStart: qm.index + qm[0].length,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].start : solMasked.masked.length;
    const rawSol = solMasked.restore(solMasked.masked.slice(cur.contentStart, nextStart)).trim();
    if (rawSol) {
      solutionByNum.set(cur.num, rawSol);
      // Nếu trong lời giải có "Chọn A" và chưa có trong bảng đáp án
      if (!answerKeyByNum.has(cur.num)) {
        const chooseMatch = rawSol.match(/\bChọn\s+([A-D])\b/i);
        if (chooseMatch) answerKeyByNum.set(cur.num, chooseMatch[1].toUpperCase());
      }
    }
  }

  return { bodyWithoutTrailingKey, answerKeyByNum, solutionByNum };
}

function detectSectionHint(headerText: string): QuestionType | null {
  if (/đúng\s*[/\-]?\s*sai/i.test(headerText) || /PHẦN\s+II\b/i.test(headerText)) {
    return 'trac_nghiem_dung_sai';
  }
  if (/trả\s+lời\s+ngắn/i.test(headerText) || /PHẦN\s+III\b/i.test(headerText)) {
    return 'trac_nghiem_tra_loi_ngan';
  }
  if (/tự\s+luận/i.test(headerText) || /PHẦN\s+IV\b/i.test(headerText)) {
    return 'tu_luan';
  }
  if (/nhiều\s+phương\s+án|trắc\s+nghiệm|PHẦN\s+I\b/i.test(headerText)) {
    return 'trac_nghiem';
  }
  return null;
}

function parseStatementsFromQuestionAndSolution(
  questionBlock: string,
  solutionText: string
): { cleanStem: string; statements: ParsedStatementItem[] } | null {
  const { masked, restore } = maskProtectedContent(questionBlock);
  const stmtRegex = /(?:^|\n)\s*(?:\*\*|__)?([a-d])[\)\.]\s*(?:\*\*|__)?\s*/gi;
  const matches: { label: string; index: number; endIndex: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = stmtRegex.exec(masked)) !== null) {
    const lead = m[0].startsWith('\n') ? 1 : 0;
    matches.push({
      label: m[1].toLowerCase(),
      index: m.index + lead,
      endIndex: m.index + m[0].length,
    });
  }
  if (matches.length < 2) return null;

  const cleanStem = restore(masked.slice(0, matches[0].index)).trim();
  const statements: ParsedStatementItem[] = [];

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].index : masked.length;
    let rawStmt = restore(masked.slice(cur.endIndex, nextStart)).trim();

    let isTrue = false;
    // Kiểm tra hậu tố [Đ], (Đúng), - Đúng ngay trên mệnh đề
    const inlineTruth = rawStmt.match(/(?:[\[\(\-]\s*(Đúng|Sai|Đ|S|True|False)\s*[\]\)]?)\s*$/i);
    if (inlineTruth) {
      isTrue = /^(đúng|đ|true)$/i.test(inlineTruth[1]);
      rawStmt = rawStmt.slice(0, inlineTruth.index).trim();
    } else if (solutionText) {
      // Dò trong lời giải: "a) Đúng", "a: Sai", "a-Đ"
      const solRegex = new RegExp(`\\b${cur.label}\\s*[\\)\\.\\:\\-]\\s*(Đúng|Sai|Đ|S|True|False)\\b`, 'i');
      const solMatch = solutionText.match(solRegex);
      if (solMatch) {
        isTrue = /^(đúng|đ|true)$/i.test(solMatch[1]);
      }
    }

    statements.push({
      id: `${cur.label}_${i}`,
      label: cur.label,
      content: rawStmt,
      isTrue,
    });
  }

  return { cleanStem, statements };
}

export function splitAndClassifyExamText(
  rawText: string,
  fallbackType: QuestionType = 'tu_luan',
  defaultColumns = 4
): SmartPasteParsedQuestion[] {
  if (!rawText || !rawText.trim()) return [];

  const { bodyWithoutTrailingKey, answerKeyByNum, solutionByNum } =
    extractTrailingAnswerKeyMap(rawText);

  const { masked, restore } = maskProtectedContent(bodyWithoutTrailingKey);

  // Tìm vị trí các tiêu đề PHẦN I, II, III, IV và Câu 1..N
  const sectionRegex = /(?:^|\n)\s*(?:\*\*|__)?(PHẦN\s+(?:I{1,3}|IV|\d+)[^\n]*)/gi;
  const sections: { index: number; type: QuestionType }[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = sectionRegex.exec(masked)) !== null) {
    const hint = detectSectionHint(sm[1]);
    if (hint) sections.push({ index: sm.index, type: hint });
  }

  const questionHeaderRegex =
    /(?:^|\n)\s*(?:\*\*|__)?(?:Câu|Bài|Question)\s+(\d{1,3})\s*[\.\:\-\)]?\s*(?:\*\*|__)?\s*/gi;
  const qPositions: { num: number; start: number; bodyStart: number }[] = [];
  let qm: RegExpExecArray | null;
  while ((qm = questionHeaderRegex.exec(masked)) !== null) {
    const lead = qm[0].startsWith('\n') ? 1 : 0;
    qPositions.push({
      num: Number(qm[1]),
      start: qm.index + lead,
      bodyStart: qm.index + qm[0].length,
    });
  }

  if (qPositions.length === 0) {
    return [
      {
        question: bodyWithoutTrailingKey.trim(),
        answer: '',
        type: fallbackType,
        columns: defaultColumns,
      },
    ];
  }

  const results: SmartPasteParsedQuestion[] = [];

  for (let i = 0; i < qPositions.length; i++) {
    const cur = qPositions[i];
    // Cắt trước tiêu đề PHẦN tiếp theo nếu tiêu đề PHẦN nằm giữa 2 câu
    let endIdx = i + 1 < qPositions.length ? qPositions[i + 1].start : masked.length;
    for (const sec of sections) {
      if (sec.index > cur.start && sec.index < endIdx) {
        endIdx = sec.index;
        break;
      }
    }

    // Xác định section hiện hành của câu hỏi
    let activeSectionType: QuestionType | null = null;
    for (const sec of sections) {
      if (sec.index <= cur.start) activeSectionType = sec.type;
    }

    const rawBlock = restore(masked.slice(cur.bodyStart, endIdx)).trim();
    const externalKey = answerKeyByNum.get(cur.num) || '';
    const externalSol = solutionByNum.get(cur.num) || '';

    // Tách phần Lời giải/Đáp án nội tại nếu được viết ngay bên dưới câu hỏi
    const blockMasked = maskProtectedContent(rawBlock);
    const inlineAnsRegex =
      /(?:^|\n)\s*(?:\*\*|__)?(?:Lời\s+giải|Hướng\s+dẫn(?:\s+giải)?|Đáp\s+án|Đáp\s+số|Trả\s+lời)(?:\*\*|__)?\s*[:\.\-]\s*/i;
    const inlineAnsMatch = blockMasked.masked.match(inlineAnsRegex);

    let questionPart = rawBlock;
    let inlineAnswerPart = '';
    if (inlineAnsMatch && inlineAnsMatch.index !== undefined) {
      questionPart = blockMasked.restore(blockMasked.masked.slice(0, inlineAnsMatch.index)).trim();
      inlineAnswerPart = blockMasked
        .restore(blockMasked.masked.slice(inlineAnsMatch.index + inlineAnsMatch[0].length))
        .trim();
    }

    const combinedSolution = [inlineAnswerPart, externalSol].filter(Boolean).join('\n').trim();

    // Phân loại câu hỏi
    const hasChoicesABCD =
      /(?:^|\n|\s)A[\.\)]\s+[\s\S]+(?:^|\n|\s)B[\.\)]\s+[\s\S]+(?:^|\n|\s)C[\.\)]\s+/i.test(
        blockMasked.masked
      );
    const parsedTf = parseStatementsFromQuestionAndSolution(questionPart, combinedSolution);

    let detectedType: QuestionType = activeSectionType || fallbackType;
    if (parsedTf && parsedTf.statements.length >= 2) {
      detectedType = 'trac_nghiem_dung_sai';
    } else if (hasChoicesABCD) {
      detectedType = 'trac_nghiem';
    } else if (
      activeSectionType === 'trac_nghiem_tra_loi_ngan' ||
      (inlineAnswerPart && inlineAnswerPart.length <= 25 && /^[-+]?[\d.,\/a-zA-Z]+$/.test(inlineAnswerPart))
    ) {
      detectedType = 'trac_nghiem_tra_loi_ngan';
    }

    if (detectedType === 'trac_nghiem_dung_sai' && parsedTf) {
      results.push({
        number: cur.num,
        question: parsedTf.cleanStem,
        answer: combinedSolution,
        type: 'trac_nghiem_dung_sai',
        statements: parsedTf.statements,
      });
      continue;
    }

    if (detectedType === 'trac_nghiem_tra_loi_ngan') {
      const shortVal =
        inlineAnswerPart.split('\n')[0].trim() || externalKey || '';
      results.push({
        number: cur.num,
        question: questionPart,
        answer: externalSol || inlineAnswerPart,
        type: 'trac_nghiem_tra_loi_ngan',
        shortAnswer: shortVal,
      });
      continue;
    }

    if (detectedType === 'trac_nghiem') {
      // Chuẩn hóa A. B. C. D. nằm cùng dòng về từng dòng riêng
      const qNormalized = questionPart.replace(
        /(?:\s{2,}|\t+)(?=(?:\*\*|__)?[B-D][\.\)]\s+)/g,
        '\n'
      );
      let finalAnswer = combinedSolution;
      if (externalKey && !/Đáp\s*án\s*đúng/i.test(finalAnswer)) {
        finalAnswer = finalAnswer
          ? `Đáp án đúng: ${externalKey}\n${finalAnswer}`
          : `Đáp án đúng: ${externalKey}`;
      }
      results.push({
        number: cur.num,
        question: qNormalized,
        answer: finalAnswer,
        type: 'trac_nghiem',
        columns: defaultColumns,
      });
      continue;
    }

    results.push({
      number: cur.num,
      question: questionPart,
      answer: combinedSolution,
      type: 'tu_luan',
    });
  }

  return results;
}

export function chunkQuestionsForAi<T>(items: T[], maxQuestionsPerChunk = 10): T[][] {
  const size = Math.max(1, maxQuestionsPerChunk);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
