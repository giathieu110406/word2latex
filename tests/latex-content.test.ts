import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { renderLatexContent, applySmartFormatting, parseMultipleChoice, convertTabTableToMarkdown, maskProtectedContent } from '../src/utils/latex-content';
function equations(text: string) { const doc = new JSDOM(renderLatexContent(text)).window.document; assert.equal(doc.querySelectorAll('.katex-error').length, 0); return Array.from(doc.querySelectorAll('.katex-custom-wrapper')).map(e => e.getAttribute('data-latex')); }
test('multiline inline equations retain whole source', () => { assert.deepEqual(equations('Đề bài $x^2 +\n y^2 = 1$ và lời giải.'), ['x^2 +\n y^2 = 1']); });
test('nested bare environments retain complete outer equation', () => { const tex = String.raw `\begin{aligned} f(x)&=\begin{cases}x^2 & x>0\\0 & x\le0\end{cases}\\g(x)&=1\end{aligned}`; assert.deepEqual(equations(tex), [tex]); });
test('smart formatting is compiled before preview', () => { assert.deepEqual(equations('Cho x² và y₁.'), ['x^2', 'y_1']); });
test('code and escaped dollars are literal', () => { assert.deepEqual(equations('`$x^2$` và \\$10, công thức \\(x+1\\).'), ['x+1']); });
test('bare matrices survive smart formatting verbatim', () => { const tex = String.raw `\begin{pmatrix}x^2 & y_1\\x_1 & y^2\end{pmatrix}`; assert.equal(applySmartFormatting(tex), tex); assert.deepEqual(equations(tex), [tex]); });
test('Markdown, links, Vietnamese and math survive together', () => { const html = renderLatexContent('**Đề bài**: $f(x)=x^3-3x^2+2$.\nXem https://example.com/a_1\nLời giải: \\(f\u0027(1)=-3\\).'); const doc = new JSDOM(html).window.document; assert.equal(doc.querySelector('strong')?.textContent, 'Đề bài'); assert.equal(doc.querySelector('a')?.getAttribute('href'), 'https://example.com/a_1'); assert.equal(doc.querySelectorAll('.katex-custom-wrapper').length, 2); });
test('option labels inside math do not split questions or choices', () => { const equation = String.raw `\[\text{A. không phải đáp án}\]`; const parsed = parseMultipleChoice('Đề ' + equation + '\nA. $x^2 +\n y^2$\nB. $2$\nC. $3$\nD. $4$'); assert.equal(parsed.options.length, 4); assert.ok(parsed.questionBody.includes(equation)); assert.equal(parsed.options[0].text, '$x^2 +\n y^2$'); });
test('math tabs and blank lines are never converted into table structure', () => { const tex = '\\[\\begin{matrix}1\t&2\\\\\n\n3&4\\end{matrix}\\]'; assert.equal(convertTabTableToMarkdown(tex), tex); });
test('question and answer headings inside math stay inside their block', () => { const tex = 'Câu 1. \\[\\text{\nCâu 2.\nLời giải: giữ nguyên\n}\\]'; const { masked, restore } = maskProtectedContent(tex); assert.equal(masked.split('\n').length, 1); assert.equal(restore(masked), tex); });
test('nested protection preserves already masked formulas', () => { const outer = maskProtectedContent('$x^2$'); assert.equal(outer.restore(convertTabTableToMarkdown(outer.masked)), '$x^2$'); });
test('Unicode powers stay inline within a sentence', () => { const doc = new JSDOM(renderLatexContent('Cho x² và y₁.')).window.document; assert.deepEqual(Array.from(doc.querySelectorAll('.katex-custom-wrapper')).map(e => e.getAttribute('data-display')), ['false', 'false']); });
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const appSource = readFileSync('src/App.tsx', 'utf8').replace(/\r\n/g, '\n');
function appFunction(name: string) {
  const start = appSource.indexOf(`  const ${name} =`);
  assert.ok(start >= 0, `${name} exists in App`);
  const end = appSource.indexOf('\n  };', start) + 5;
  return appSource.slice(start, end);
}
const parserContext: any = {maskProtectedContent, applySmartFormatting, convertTabTableToMarkdown, newQuestionType: 'tu_luan', newTracNghiemColumns: 4};
vm.createContext(parserContext);
const parserSource = ['normalizeInputText','mergeAdjacentBoldBlocks','getCleanQuestionBody','getCleanAnswerBody','detectQuestionTypeFromBlockContent','parseMultipleQuestionsTextToPreview'].map(appFunction).join('\n') + '\nglobalThis.parsePreview = parseMultipleQuestionsTextToPreview; globalThis.cleanQuestion = getCleanQuestionBody;';
vm.runInContext(ts.transpileModule(parserSource, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText, parserContext);
test('actual smart paste parser preserves math headings and separates external solution',()=>{
  const tex = '\\[\\text{\nA. ký hiệu trong toán\nCâu 9. không phải câu mới\nLời giải: vẫn thuộc công thức\n}\\]';
  const result = parserContext.parsePreview('Câu 1. Bài tự luận '+tex+'\nLời giải: $x=1$\nCâu 2. Tìm $y$.');
  assert.equal(result.length,2);
  assert.equal(result[0].type,'tu_luan');
  assert.ok(result[0].questionText.includes(tex));
  assert.equal(result[0].answerText,'Lời giải: $x=1$');
});
test('question cleanup must not treat text inside math as question prefix',()=>{
  const input='Cho \\[\\text{Câu 9. giữ nguyên}\\] và tính $x$.';
  assert.equal(parserContext.cleanQuestion(input),input);
});
import {prepareWordEquations} from '../src/utils/word-export';
test('shared renderer feeds native Word math without losing question or solution equations',()=>{
  const dom=new JSDOM('<div id="preview"></div>');
  Object.assign(globalThis,{document:dom.window.document,DOMParser:dom.window.DOMParser,Node:dom.window.Node,HTMLElement:dom.window.HTMLElement});
  const root=dom.window.document.getElementById('preview')!;
  root.innerHTML=renderLatexContent('Đề: $x^2 +\n y^2=1$.\nLời giải: \\[\\begin{aligned}f(x)&=\\begin{cases}x&x>0\\\\0&x\\le0\\end{cases}\\\\g(x)&=1\\end{aligned}\\]');
  prepareWordEquations(root);
  const eq=Array.from(root.querySelectorAll('.word-equation'));
  assert.equal(eq.length,2);assert.ok(eq.every(e=>e.getAttribute('data-word-omml')?.includes('<m:oMath')));assert.equal(root.querySelectorAll('.katex').length,0);
});
test('answer choices stay inline while explicit display delimiters remain display',()=>{
  const inline=new JSDOM(renderLatexContent("$f'(1)=-3$",true,false)).window.document;
  assert.equal(inline.querySelector('.katex-custom-wrapper')?.getAttribute('data-display'),'false');
  const display=new JSDOM(renderLatexContent('$$x=1$$',true,false)).window.document;
  assert.equal(display.querySelector('.katex-custom-wrapper')?.getAttribute('data-display'),'true');
});
