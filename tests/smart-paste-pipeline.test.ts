import assert from 'node:assert/strict';
import test from 'node:test';
import {
  splitAndClassifyExamText,
  extractTrailingAnswerKeyMap,
  chunkQuestionsForAi,
} from '../src/utils/smart-paste-pipeline';

test('extractTrailingAnswerKeyMap extracts compact answer table and detailed solutions at the end of exam', () => {
  const raw = [
    'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn',
    'Câu 1: Đạo hàm của hàm số $y = x^2$ là:',
    'A. $2x$   B. $x$   C. $2$   D. $x^3$',
    'Câu 2: Nghiệm của phương trình $x - 3 = 0$ là:',
    'A. $1$    B. $2$   C. $3$   D. $4$',
    'BẢNG ĐÁP ÁN',
    '1.A 2.C 3.D',
    'LỜI GIẢI CHI TIẾT',
    'Câu 1: Ta có $(x^2)\\prime = 2x$. Chọn A.',
    'Câu 2: Chuyển vế ta được $x = 3$. Chọn C.',
  ].join('\n');

  const extracted = extractTrailingAnswerKeyMap(raw);
  assert.equal(extracted.answerKeyByNum.get(1), 'A');
  assert.equal(extracted.answerKeyByNum.get(2), 'C');
  assert.equal(extracted.answerKeyByNum.get(3), 'D');
  assert.match(extracted.solutionByNum.get(1) || '', /Chọn A/);
  assert.match(extracted.solutionByNum.get(2) || '', /x = 3/);
  assert.equal(extracted.bodyWithoutTrailingKey.includes('BẢNG ĐÁP ÁN'), false);
});

test('splitAndClassifyExamText classifies all 4 question types across sections and attaches trailing answers', () => {
  const raw = [
    'PHẦN I. Trắc nghiệm 4 phương án',
    'Câu 1: Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ ![Hình 1](img:img_1). Giá trị cực đại là:',
    'A. 2   B. 3   C. 4   D. 5',
    'PHẦN II. Trắc nghiệm đúng sai',
    'Câu 2: Cho hàm số $f(x) = \\sin x$.',
    'a) Tập xác định là $\\mathbb{R}$.',
    'b) Đạo hàm $f\\prime(x) = -\\cos x$.',
    'c) Hàm số tuần hoàn với chu kỳ $2\\pi$.',
    'd) $f(0) = 1$.',
    'PHẦN III. Trắc nghiệm trả lời ngắn',
    'Câu 3: Tính tích phân $I = \\int_0^1 2x dx$.',
    'Đáp án: 1',
    'PHẦN IV. Tự luận',
    'Câu 4: Giải phương trình $x^2 - 5x + 6 = 0$ (giả sử trong biểu thức có chữ Câu 99: giả tạo $f(\\text{Câu 99: } x) = 0$).',
    'BẢNG ĐÁP ÁN',
    '1.B',
    'LỜI GIẢI CHI TIẾT',
    'Câu 1: Nhìn hình vẽ ![Hình 1](img:img_1) ta thấy cực đại bằng 3.',
    'Câu 2: a) Đúng b) Sai c) Đúng d) Sai',
    'Câu 4: Phương trình có 2 nghiệm $x=2, x=3$.',
  ].join('\n');

  const items = splitAndClassifyExamText(raw);
  assert.equal(items.length, 4);

  assert.equal(items[0].type, 'trac_nghiem');
  assert.match(items[0].question, /!\[Hình 1\]\(img:img_1\)/);
  assert.match(items[0].answer, /Đáp án đúng:\s*B/i);
  assert.match(items[0].answer, /cực đại bằng 3/);

  assert.equal(items[1].type, 'trac_nghiem_dung_sai');
  assert.equal(items[1].statements?.length, 4);
  assert.equal(items[1].statements?.[0].isTrue, true);
  assert.equal(items[1].statements?.[1].isTrue, false);
  assert.equal(items[1].statements?.[2].isTrue, true);
  assert.equal(items[1].statements?.[3].isTrue, false);

  assert.equal(items[2].type, 'trac_nghiem_tra_loi_ngan');
  assert.equal(items[2].shortAnswer, '1');

  assert.equal(items[3].type, 'tu_luan');
  assert.match(items[3].question, /Câu 99:/);
  assert.match(items[3].answer, /x=2, x=3/);
});

test('chunkQuestionsForAi groups raw question blocks into bounded batches', () => {
  const blocks = Array.from({ length: 23 }, (_, i) => `Câu ${i + 1}: Nội dung câu ${i + 1}`);
  const chunks = chunkQuestionsForAi(blocks, 10);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 10);
  assert.equal(chunks[1].length, 10);
  assert.equal(chunks[2].length, 3);
});
