import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import katex from 'katex';
import JSZip from 'jszip';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {
  prepareWordEquations, mathmlToOfficeMath, buildWordDocx,
  buildWordClipboard, copyWordContent,
} from '../src/utils/word-export';

const dom = new JSDOM('<!doctype html><body><input id="focus"></body>', { url: 'https://localhost' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document,
  DOMParser: dom.window.DOMParser, XMLSerializer: dom.window.XMLSerializer,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });

function fixture(html: string) {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}
function equation(source: string, display = false) {
  const el = document.createElement(display ? 'div' : 'span');
  el.className = 'katex-custom-wrapper';
  el.dataset.latex = source;
  el.dataset.display = String(display);
  el.innerHTML = katex.renderToString(source, { throwOnError: false });
  return el.outerHTML;
}
function xml(input: string) {
  const doc = new DOMParser().parseFromString(input, 'application/xml');
  assert.equal(doc.querySelector('parsererror'), null, input);
  return doc;
}
const mml = (source: string) => katex.renderToString(source, { output: 'mathml', throwOnError: true, strict: 'ignore' });

test('reported matrix with vdots/ddots works in both clipboard and DOCX without losing cells', async () => {
  const source = String.raw`M=\begin{pmatrix}1&a_1&a_1^2&\cdots&a_1^n\\1&a_2&a_2^2&\cdots&a_2^n\\\vdots&\vdots&\vdots&\ddots&\vdots\\1&a_n&a_n^2&\cdots&a_n^n\end{pmatrix}`;
  const root = fixture(equation(source, true));
  prepareWordEquations(root);
  const omml = root.querySelector('.word-equation')!.getAttribute('data-word-omml')!;
  const doc = xml(omml);
  assert.equal(doc.getElementsByTagName('m:mr').length, 4);
  for (const row of Array.from(doc.getElementsByTagName('m:mr'))) assert.equal(row.children.length, 5);
  assert.equal(doc.documentElement.textContent!.split('⋮').length - 1, 4);
  assert.match(doc.documentElement.textContent!, /⋱/);
  const payload = buildWordClipboard(root, 'Times New Roman');
  assert.match(payload.html, /<m:m>/);
  assert.ok(payload.text.includes(source));
  const zip = await JSZip.loadAsync(await (await buildWordDocx(root, 'Times New Roman')).arrayBuffer());
  assert.match(await zip.file('word/document.xml')!.async('string'), /⋮/);
});

test('KaTeX padded arrow labels preserve above/below arguments and Vietnamese text', () => {
  for (const source of [String.raw`\xrightarrow{n\to\infty}`, String.raw`\xleftarrow{\text{Kẹp giữa}}`, String.raw`\xrightleftharpoons[\text{H}_2\text{SO}_4]{\text{phản ứng thuận nghịch}}`]) {
    const doc = xml(mathmlToOfficeMath(mml(source)));
    assert.ok(doc.getElementsByTagName('m:lim').length > 0);
    assert.ok(doc.documentElement.textContent!.length > 2);
    if (source.includes('Kẹp')) assert.match(doc.documentElement.textContent!.replace(/\u00a0/g, ' '), /Kẹp giữa/);
    if (source.includes('SO')) {
      assert.match(doc.documentElement.textContent!.replace(/\u00a0/g, ' '), /phản ứng thuận nghịch/);
      assert.match(doc.documentElement.textContent!, /H2SO4/);
    }
  }
  // Arbitrary overlays/smashes must still fail; never flatten unknown padding.
  assert.throws(() => mathmlToOfficeMath(mml(String.raw`\smash{x}`)), /mpadded/);
});

test('vectors preserve accent over the entire DA/DC/DB/zero base', () => {
  for (const base of ['DA', 'DC', 'DB', '0']) {
    const doc = xml(mathmlToOfficeMath(mml(`\\overrightarrow{${base}}`)));
    const acc = doc.getElementsByTagName('m:acc')[0];
    assert.ok(acc, base);
    assert.equal(acc.getElementsByTagName('m:e')[0].textContent, base);
    assert.equal(acc.getElementsByTagName('m:chr')[0].getAttribute('m:val'), '\u20d7');
  }
});

test('fraction arguments remain separated, roots/scripts/matrices stay structured', () => {
  const fraction = xml(mathmlToOfficeMath(mml('\\frac{\\text{tử}}{\\text{mẫu}}')));
  assert.equal(fraction.getElementsByTagName('m:num')[0].textContent, 'tử');
  assert.equal(fraction.getElementsByTagName('m:den')[0].textContent, 'mẫu');
  const complex = mathmlToOfficeMath(mml('\\sqrt[3]{x_i^2}+\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}'));
  xml(complex);
  assert.match(complex, /<m:rad>/);
  assert.match(complex, /<m:sSubSup>/);
  assert.match(complex, /<m:m>/);
});

test('Vietnamese accents and XML special characters survive without lost text', () => {
  const result = xml(mathmlToOfficeMath(mml('\\text{Độ dài, tiếng Việt} + \\hat{x}')));
  assert.match(result.documentElement.textContent!.replace(/\u00a0/g, ' '), /Độ dài, tiếng Việt/);
  xml(mathmlToOfficeMath('<math xmlns="http://www.w3.org/1998/Math/MathML"><mtext>A &amp; B &lt; C</mtext></math>'));
});

test('text boundary spaces survive decomposed Vietnamese accents exactly', () => {
  for (const text of ['ấ ệ ộ', 'ấ & ệ < ộ']) {
    const doc = xml(mathmlToOfficeMath(mml(`\\text{${text.replace(/&/g, '\\&')}}`)));
    assert.equal(doc.documentElement.textContent!.replace(/\u00a0/g, ' '), text);
  }
  const literal = xml(mathmlToOfficeMath('<math xmlns="http://www.w3.org/1998/Math/MathML"><mtext>  x  </mtext></math>'));
  assert.equal(literal.documentElement.textContent, '  x  ');
});

test('underlines and overlines use native bars on the correct side, without fake scripts', () => {
  for (const [source, position] of [['\\underline{AB}', 'bot'], ['\\overline{AB}', 'top']]) {
    const doc = xml(mathmlToOfficeMath(mml(source)));
    const bar = doc.getElementsByTagName('m:bar')[0];
    assert.ok(bar, source);
    assert.equal(bar.getElementsByTagName('m:pos')[0].getAttribute('m:val'), position);
    assert.equal(bar.getElementsByTagName('m:e')[0].textContent, 'AB');
    assert.equal(bar.getElementsByTagName('m:sSup').length, 0);
    assert.equal(bar.getElementsByTagName('m:sSub').length, 0);
  }
});

test('QBuild actual preparation preserves display equations, option columns and answers', async () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const styleCode = app.slice(app.indexOf('  const injectInlineStyles = '), app.indexOf('  const injectMathML = '));
  const js = ts.transpileModule(styleCode, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const applyStyles = new Function('wordFont', `${js}; return injectInlineStyles;`)('Times New Roman');
  const root = fixture(`<div class="doc-header-block"><h3>Tài liệu</h3></div><div class="doc-section-header"><span class="doc-section-title">PHẦN I</span></div><div class="doc-question-item"><div class="flex items-start"><span class="doc-type-badge">Câu 1.</span><div><p>Nội dung ${equation('\\overrightarrow{DA}')}</p></div></div><div class="doc-options-container" data-columns="2"><div class="doc-option-item"><span class="doc-option-label">A.</span><div class="doc-option-text"><p>${equation('\\frac{1}{2}', true)}</p></div></div><div class="doc-option-item"><span class="doc-option-label">B.</span><div class="doc-option-text"><p>${equation('x^2')}</p></div></div></div><div class="doc-answer-block"><span class="doc-answer-title">Lời giải</span><div class="doc-answer-body"><p>Chọn A. ${equation('\\sqrt{x}')}</p></div></div></div>`);
  prepareWordEquations(root);
  applyStyles(root);
  assert.equal(root.querySelectorAll('.word-equation').length, 4);
  const payload = buildWordClipboard(root, 'Times New Roman');
  assert.match(payload.text, /Câu 1\./);
  const zip = await JSZip.loadAsync(await (await buildWordDocx(root, 'Times New Roman')).arrayBuffer());
  const doc = xml(await zip.file('word/document.xml')!.async('string'));
  assert.equal(doc.getElementsByTagName('w:tbl').length, 2);
  assert.equal(doc.getElementsByTagName('m:oMath').length, 4);
  assert.match(doc.documentElement.textContent!, /Lời giải/);
  assert.equal(doc.getElementsByTagName('w:gridCol')[0].getAttribute('w:w'), '4819');
});

test('invalid equations and unsupported structures fail explicitly', () => {
  const root = fixture(equation('\\notARealCommand{x}'));
  assert.throws(() => prepareWordEquations(root), /notARealCommand/);
  assert.throws(() => mathmlToOfficeMath('<math><unknown>x</unknown></math>'), /unknown/);
  assert.throws(() => mathmlToOfficeMath('<math><mfrac><mi>x</mi></mfrac></math>'), /mfrac/);
  assert.throws(() => mathmlToOfficeMath('<math><menclose notation="circle"><mi>x</mi></menclose></math>'), /circle/);
});

test('clipboard has exclusive Office OMML/non-Office MathML and source LaTeX plain text', () => {
  const root = fixture(`<p>Vectơ ${equation('\\overrightarrow{DA}')} &amp; tiếng Việt.</p>`);
  const original = root.innerHTML;
  prepareWordEquations(root);
  const payload = buildWordClipboard(root, 'Times New Roman');
  assert.match(payload.html, /\[if gte mso 12\]/);
  assert.match(payload.html, /<m:acc>/);
  assert.match(payload.html, /\[if !\(gte mso 12\)\]/);
  assert.match(payload.html, /<math/);
  assert.match(payload.text, /\\\(\\overrightarrow\{DA\}\\\)/);
  assert.doesNotMatch(payload.html, /<img|data:image/);
  assert.ok(original.includes('katex'));
});

test('DOCX is a real ZIP with native math, A4 and QBuild table structure', async () => {
  const root = fixture(`<h3 style="text-align:center">ĐỀ KIỂM TRA</h3><p><b>Câu 13.</b> A &amp; B ${equation('\\overrightarrow{DA}+\\overrightarrow{DC}=\\overrightarrow{DB}')}</p><table class="doc-options-table"><tr><td style="width:50%"><b>A.</b> ${equation('\\frac{1}{2}')}</td><td style="width:50%">B. ${equation('x^2')}</td></tr></table><p>${equation('\\sqrt{x}', true)}</p>`);
  prepareWordEquations(root);
  const extra = fixture(`<p>Vectơ không: ${equation('\\overrightarrow{0}')}</p><p>Gạch trên/dưới: ${equation('\\overline{AB}+\\underline{CD}')}</p><p>Tiếng Việt: ${equation('\\text{ấ ệ ộ}')}</p><p>${equation('\\sqrt[3]{x_i^2}+\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}', true)}</p>`);
  prepareWordEquations(extra);
  root.append(...Array.from(extra.childNodes));
  const blob = await buildWordDocx(root, 'Times New Roman');
  const bytes = await blob.arrayBuffer();
  assert.equal(new Uint8Array(bytes)[0], 0x50);
  const zip = await JSZip.loadAsync(bytes);
  for (const name of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/settings.xml', 'word/_rels/document.xml.rels']) {
    assert.ok(zip.file(name), name);
    xml(await zip.file(name)!.async('string'));
  }
  const doc = await zip.file('word/document.xml')!.async('string');
  assert.match(doc, /<m:acc>/);
  assert.match(doc, /<m:f>/);
  assert.match(doc, /<m:oMathPara>/);
  assert.match(doc, /<w:tbl>/);
  assert.match(doc, /<w:b\/>/);
  assert.match(doc, /A &amp; B/);
  assert.match(doc, /w:w="11906"/);
  assert.match(doc, /w:top="1134"/);
  assert.equal(Object.keys(zip.files).some(name => name.startsWith('word/media')), false);
  await mkdir('scratch/word-export', { recursive: true });
  await writeFile('scratch/word-export/word-compatibility.docx', new Uint8Array(bytes));
});

test('unsupported HTML is rejected rather than silently dropped', async () => {
  await assert.rejects(buildWordDocx(fixture('<img src="https://example.com/a.png">'), 'Times New Roman'), /ảnh|image/i);
});

test('clipboard fallback restores selection/focus and removes temporary DOM/listeners on success/failure', async () => {
  const input = document.getElementById('focus') as HTMLInputElement;
  input.focus();
  const originalCount = document.body.childElementCount;
  let writes: Record<string, string> = {};
  (document as any).execCommand = () => {
    const e = new dom.window.Event('copy', { cancelable: true });
    Object.defineProperty(e, 'clipboardData', { value: { setData: (mime: string, value: string) => { writes[mime] = value; } } });
    document.dispatchEvent(e);
    return true;
  };
  await copyWordContent({ html: '<p>test</p>', text: 'test' });
  assert.deepEqual(writes, { 'text/html': '<p>test</p>', 'text/plain': 'test' });
  assert.equal(document.body.childElementCount, originalCount);
  assert.equal(document.activeElement, input);
  writes = {};
  document.dispatchEvent(new dom.window.Event('copy'));
  assert.deepEqual(writes, {});
  (document as any).execCommand = () => { throw new Error('denied'); };
  await assert.rejects(copyWordContent({ html: '<p>test</p>', text: 'test' }), /sao chép|clipboard/i);
  assert.equal(document.body.childElementCount, originalCount);
  assert.equal(document.activeElement, input);
  (document as any).execCommand = () => true;
  await assert.rejects(copyWordContent({ html: '<p>test</p>', text: 'test' }), /sao chép|clipboard/i);
});

test('modern Clipboard API writes both formats and rejection falls back without losing selection', async () => {
  let items: any[] = [];
  const previous = (globalThis as any).ClipboardItem;
  (globalThis as any).ClipboardItem = class { constructor(public data: Record<string, Blob>) {} };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async (value: any[]) => { items = value; } } });
  try {
    await copyWordContent({ html: '<p>Equation</p>', text: '\\(x^2\\)' });
    assert.equal(await items[0].data['text/html'].text(), '<p>Equation</p>');
    assert.equal(await items[0].data['text/plain'].text(), '\\(x^2\\)');
    const p = fixture('<p>Selected text</p>');
    document.body.appendChild(p);
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(p);
    selection.removeAllRanges(); selection.addRange(range);
    const before = selection.toString();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => { throw new Error('denied'); } } });
    (document as any).execCommand = () => {
      const event = new dom.window.Event('copy', { cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { setData() {} } });
      document.dispatchEvent(event); return true;
    };
    await copyWordContent({ html: '<p>Equation</p>', text: '\\(x^2\\)' });
    assert.equal(selection.toString(), before);
    assert.equal(document.querySelector('[contenteditable="true"]'), null);
    p.remove(); selection.removeAllRanges();
  } finally {
    (globalThis as any).ClipboardItem = previous;
    delete (navigator as any).clipboard;
  }
});
