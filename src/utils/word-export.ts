import katex from 'katex';
import JSZip from 'jszip';
import { mml2omml } from 'mathml2omml';

const MATH_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MML_NS = 'http://www.w3.org/1998/Math/MathML';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const supportedMath = new Set('math semantics mrow mi mn mo mtext ms mspace mfrac msqrt mroot mstyle msub msup msubsup munder mover munderover mtable mtr mtd menclose mmultiscripts mprescripts none'.split(' '));

function parseXml(text: string): XMLDocument {
  const parsed = new DOMParser().parseFromString(text, 'application/xml');
  if (parsed.getElementsByTagName('parsererror').length) throw new Error('Cấu trúc công thức Word không hợp lệ.');
  return parsed;
}

/** Normalize only text accents; never merge separate mathematical arguments. */
function normalizeMath(math: Element): void {
  math.setAttribute('xmlns', MML_NS);
  math.querySelectorAll('annotation, annotation-xml').forEach(el => el.remove());
  const accents: Record<string, string> = { '´': '\u0301', 'ˊ': '\u0301', '\u0301': '\u0301', '`': '\u0300', 'ˋ': '\u0300', '\u0300': '\u0300', '^': '\u0302', 'ˆ': '\u0302', '\u0302': '\u0302', '~': '\u0303', '˜': '\u0303', '\u0303': '\u0303', '˘': '\u0306', '\u0306': '\u0306', '\u0309': '\u0309', '\u0323': '\u0323' };
  for (const mover of Array.from(math.querySelectorAll('mover')).reverse()) {
    const [base, accent] = Array.from(mover.children);
    // x-hat is a mathematical accent, not a Vietnamese text accent.
    if (base?.localName === 'mtext' && !base.children.length && accent) {
      const combining = accents[accent.textContent || ''];
      if (combining) {
        const text = math.ownerDocument.createElementNS(MML_NS, 'mtext');
        text.textContent = ((base.textContent || '') + combining).normalize('NFC');
        mover.replaceWith(text);
      }
    }
    if (accent?.localName === 'mo' && /^[→←↔]$/.test(accent.textContent || '')) mover.setAttribute('accent', 'true');
  }
  for (const el of Array.from(math.querySelectorAll('mover, munder'))) {
    const [base, mark] = Array.from(el.children);
    if (mark?.localName !== 'mo') continue;
    if (mark.textContent === '\u203e') mark.textContent = el.localName === 'munder' ? '_' : '\u00af';
    if (el.localName === 'munder' && el.getAttribute('accentunder') === 'true' && mark.textContent !== '_' && mark.textContent !== '\u0332') {
      // The library maps accentunder to an above accent. A below group
      // character keeps its position and stretch instead.
      el.setAttribute('accentunder', 'false');
      if (base.localName !== 'mrow') {
        const row = math.ownerDocument.createElementNS(MML_NS, 'mrow');
        base.replaceWith(row);
        row.appendChild(base);
      }
    }
  }
  // KaTeX may emit mpadded for overset/phantoms; don't silently discard its layout.
  for (const node of [math, ...Array.from(math.querySelectorAll('*'))]) {
    if (!supportedMath.has(node.localName)) throw new Error(`Công thức chứa cấu trúc chưa hỗ trợ: ${node.localName}.`);
    const arity: Record<string, number> = { mfrac: 2, mroot: 2, msub: 2, msup: 2, msubsup: 3, munder: 2, mover: 2, munderover: 3 };
    if (arity[node.localName] && node.children.length !== arity[node.localName]) throw new Error(`Cấu trúc ${node.localName} thiếu thành phần công thức.`);
    if (node.localName === 'menclose') {
      const notation = node.getAttribute('notation') || 'longdiv';
      if (!['box', 'left', 'right', 'top', 'bottom', 'updiagonalstrike', 'downdiagonalstrike', 'verticalstrike', 'horizontalstrike'].includes(notation)) throw new Error(`Kiểu bao công thức chưa hỗ trợ: ${notation}.`);
    }
    if (node.localName === 'mtd' && (Number(node.getAttribute('rowspan') || 1) > 1 || Number(node.getAttribute('columnspan') || 1) > 1)) throw new Error('Ma trận có ô gộp chưa hỗ trợ xuất Word.');
  }
}

export function mathmlToOfficeMath(input: string): string {
  const container = document.createElement('div');
  container.innerHTML = input;
  const math = container.querySelector('math');
  if (!math) throw new Error('Không tìm thấy cấu trúc MathML của công thức.');
  normalizeMath(math);
  const safeMath = math.cloneNode(true) as Element;
  let prefix = '\ue000WORDTEXT';
  while (input.includes(prefix)) prefix += 'X';
  const protectedText: Array<[string, string]> = [];
  // This converter decodes input entities but writes raw XML text. Double-escape
  // token text before conversion so &, < and > remain valid XML afterward.
  safeMath.querySelectorAll('mi, mn, mo, mtext, ms').forEach(el => {
    if (el.children.length) throw new Error(`Cấu trúc ${el.localName} lồng nhau chưa được hỗ trợ.`);
    if (el.localName === 'mtext') {
      // The library trims token edges. Preserve all original text/whitespace
      // via placeholders, then restore it through the XML DOM after conversion.
      const key = `${prefix}${protectedText.length}\ue001`;
      protectedText.push([key, el.textContent || '']);
      el.textContent = key;
    } else el.textContent = escapeXml(el.textContent || '');
  });
  const raw = mml2omml(new XMLSerializer().serializeToString(safeMath));
  const office = parseXml(raw.replace('<m:oMath ', `<m:oMath xmlns:w="${WORD_NS}" `));
  if (office.documentElement.localName !== 'oMath') throw new Error('Không chuyển được công thức thành Equation của Word.');
  for (const text of Array.from(office.getElementsByTagNameNS(MATH_NS, 't'))) {
    for (const [key, original] of protectedText) text.textContent = (text.textContent || '').replaceAll(key, original);
  }
  for (const bar of Array.from(office.getElementsByTagNameNS(MATH_NS, 'bar'))) {
    const argument = Array.from(bar.children).find(el => el.localName === 'e');
    const script = argument?.firstElementChild;
    // The dependency inserts a spurious empty script in every bar argument,
    // including an invalid m:sub under m:sSup. Keep only the true base argument.
    if (script && ['sSub', 'sSup'].includes(script.localName)) {
      const base = Array.from(script.children).find(el => el.localName === 'e');
      if (base) argument!.replaceWith(base);
    }
  }
  for (const chr of Array.from(office.getElementsByTagNameNS(MATH_NS, 'chr'))) {
    if (chr.getAttribute('m:val') === '↔') chr.setAttribute('m:val', '\u20e1');
    const pos = chr.getAttribute('m:pos');
    if (pos) {
      chr.removeAttribute('m:pos');
      const position = office.createElementNS(MATH_NS, 'm:pos');
      position.setAttribute('m:val', pos);
      chr.parentElement!.appendChild(position);
    }
  }
  Array.from(office.getElementsByTagNameNS(MATH_NS, 'r')).forEach(run => {
    if (run.namespaceURI !== MATH_NS) return;
    const mathPr = Array.from(run.children).find(el => el.namespaceURI === MATH_NS && el.localName === 'rPr');
    if (mathPr) run.insertBefore(mathPr, run.firstChild);
  });
  return new XMLSerializer().serializeToString(office.documentElement);
}

/** Called on an isolated clone, before QBuild's table/style transformations. */
export function prepareWordEquations(root: HTMLElement): void {
  for (const wrapper of Array.from(root.querySelectorAll<HTMLElement>('.katex-custom-wrapper'))) {
    const source = wrapper.getAttribute('data-latex');
    if (!source) throw new Error('Công thức thiếu mã LaTeX nguồn.');
    const display = wrapper.getAttribute('data-display') === 'true';
    try {
      const rendered = katex.renderToString(source, { output: 'mathml', displayMode: display, throwOnError: true, strict: 'ignore', trust: false });
      const temp = document.createElement('div');
      temp.innerHTML = rendered;
      const math = temp.querySelector('math')!;
      normalizeMath(math);
      const omml = mathmlToOfficeMath(math.outerHTML);
      // QBuild turns divs inside option cells into plain spans. Keep equation
      // metadata on a span so that transformation cannot erase its OMML.
      const replacement = document.createElement('span');
      replacement.className = 'word-equation';
      replacement.setAttribute('data-word-omml', omml);
      replacement.setAttribute('data-latex', source);
      replacement.setAttribute('data-display', String(display));
      if (display) {
        replacement.style.display = 'block';
        replacement.style.textAlign = 'center';
      }
      replacement.appendChild(math);
      wrapper.replaceWith(replacement);
    } catch (error) {
      throw new Error(`Không chuyển được công thức “${source}”: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (root.querySelector('.katex, .katex-error')) throw new Error('Có công thức chưa được chuẩn hóa cho Word.');
}

interface TextStyle { bold?: boolean; italic?: boolean; underline?: boolean; size?: number; color?: string; align?: string; background?: string; pre?: boolean; }
function color(value: string): string | undefined {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.slice(1);
  if (/^#[0-9a-f]{3}$/i.test(value)) return value.slice(1).split('').map(c => c + c).join('');
  const rgb = value.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/);
  return rgb ? rgb.slice(1).map(v => Number(v).toString(16).padStart(2, '0')).join('') : undefined;
}
function styles(el: HTMLElement, parent: TextStyle): TextStyle {
  const css = el.style;
  const classes = el.classList;
  const tag = el.tagName.toLowerCase();
  let size = parent.size;
  if (css.fontSize) {
    const value = parseFloat(css.fontSize);
    if (css.fontSize.endsWith('pt')) size = value * 2;
    else if (css.fontSize.endsWith('px')) size = value * 1.5;
  }
  const heading = /^h[1-6]$/.test(tag);
  return {
    ...parent, size: size || (heading ? 28 : 26),
    bold: css.fontWeight ? css.fontWeight === 'bold' || Number(css.fontWeight) >= 600 : parent.bold || ['b', 'strong'].includes(tag) || heading || ['font-bold', 'font-black', 'font-semibold'].some(c => classes.contains(c)),
    italic: css.fontStyle ? css.fontStyle === 'italic' : parent.italic || ['i', 'em'].includes(tag) || classes.contains('italic'),
    underline: parent.underline || tag === 'u' || css.textDecoration.includes('underline'),
    align: css.textAlign || (classes.contains('text-center') ? 'center' : classes.contains('text-right') ? 'right' : classes.contains('text-left') ? 'left' : parent.align),
    color: color(css.color) || parent.color,
    background: color(css.backgroundColor) || parent.background,
    pre: parent.pre || tag === 'pre' || css.whiteSpace.startsWith('pre') || classes.contains('whitespace-pre-wrap'),
  };
}

function wordRun(text: string, style: TextStyle, font: string): string {
  if (!text) return '';
  const props = `<w:rFonts w:ascii="${escapeXml(font)}" w:hAnsi="${escapeXml(font)}" w:eastAsia="${escapeXml(font)}"/>${style.bold ? '<w:b/>' : ''}${style.italic ? '<w:i/>' : ''}${style.underline ? '<w:u w:val="single"/>' : ''}<w:sz w:val="${Math.round(style.size || 26)}"/>${style.color ? `<w:color w:val="${style.color}"/>` : ''}`;
  return `<w:r><w:rPr>${props}</w:rPr>${text.split(/(\n|\t)/).map(part => part === '\n' ? '<w:br/>' : part === '\t' ? '<w:tab/>' : `<w:t xml:space="preserve">${escapeXml(part)}</w:t>`).join('')}</w:r>`;
}
function officeEquation(el: HTMLElement): string {
  const omml = el.getAttribute('data-word-omml');
  if (!omml) throw new Error('Công thức chưa được chuyển thành Equation của Word.');
  parseXml(omml);
  return omml;
}
function inline(node: Node, style: TextStyle, font: string): string {
  if (node.nodeType === Node.TEXT_NODE) return wordRun(style.pre ? node.textContent || '' : (node.textContent || '').replace(/\s+/g, ' '), style, font);
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  if (el.classList.contains('word-equation')) return officeEquation(el);
  const tag = el.tagName.toLowerCase();
  if (['img', 'svg', 'canvas', 'iframe', 'video', 'audio', 'object', 'math'].includes(tag)) throw new Error(`Nội dung ${tag === 'img' ? 'ảnh (image)' : tag} chưa hỗ trợ xuất Word dạng văn bản.`);
  if (['script', 'style', 'button'].includes(tag)) return '';
  if (tag === 'br') return '<w:r><w:br/></w:r>';
  const nextStyle = styles(el, style);
  return Array.from(el.childNodes).map(child => inline(child, nextStyle, font)).join('');
}
const blockTags = new Set('p div h1 h2 h3 h4 h5 h6 blockquote pre section article header footer ul ol li table hr'.split(' '));
function isBlock(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE && (blockTags.has((node as Element).tagName.toLowerCase()) || (node as HTMLElement).style.display === 'block' || (node as Element).getAttribute('data-display') === 'true');
}
function paragraph(content: string, style: TextStyle): string {
  const align = ['left', 'right', 'center', 'justify'].includes(style.align || '') ? style.align : 'left';
  return `<w:p><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/><w:jc w:val="${align}"/></w:pPr>${content}</w:p>`;
}

function blocks(root: HTMLElement, font: string, inherited: TextStyle = {}): string {
  const style = styles(root, inherited);
  let output = '';
  let pending = '';
  const flush = () => { if (pending) output += paragraph(pending, style); pending = ''; };
  for (const node of Array.from(root.childNodes)) {
    if (!isBlock(node)) {
      if (!pending && node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) continue;
      pending += inline(node, style, font);
      continue;
    }
    flush();
    const el = node as HTMLElement;
    const nextStyle = styles(el, style);
    const tag = el.tagName.toLowerCase();
    if (el.classList.contains('word-equation')) {
      output += paragraph(`<m:oMathPara><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr>${officeEquation(el)}</m:oMathPara>`, { ...nextStyle, align: 'center' });
    } else if (tag === 'table') output += table(el, font, nextStyle);
    else if (tag === 'hr') output += '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:color="808080"/></w:pBdr></w:pPr></w:p>';
    else if (Array.from(el.childNodes).some(isBlock)) output += blocks(el, font, style);
    else output += paragraph(inline(el, style, font), nextStyle);
  }
  flush();
  return output;
}

function table(el: HTMLElement, font: string, style: TextStyle): string {
  const rows = Array.from(el.querySelectorAll('tr')).filter(row => row.closest('table') === el);
  const columns = Math.max(1, ...rows.map(row => Array.from(row.children).reduce((count, cell) => count + Number(cell.getAttribute('colspan') || 1), 0)));
  const width = Math.floor(9638 / columns);
  const borderless = el.classList.contains('doc-options-table') || el.classList.contains('doc-header-table') || el.getAttribute('border') === '0' || el.style.border === 'none';
  const border = borderless ? 'nil' : 'single';
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(edge => `<w:${edge} w:val="${border}" w:sz="4" w:color="B0B0B0"/>`).join('');
  const content = rows.map(row => `<w:tr>${Array.from(row.children).filter(cell => ['td', 'th'].includes(cell.tagName.toLowerCase())).map(cell => {
    const td = cell as HTMLElement;
    if (Number(td.getAttribute('rowspan') || 1) > 1) throw new Error('Bảng có ô gộp theo chiều dọc chưa hỗ trợ xuất Word.');
    const span = Number(td.getAttribute('colspan') || 1);
    const cellStyle = styles(td, style);
    const body = blocks(td, font, { ...cellStyle, bold: td.tagName.toLowerCase() === 'th' || cellStyle.bold });
    return `<w:tc><w:tcPr><w:tcW w:w="${width * span}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${cellStyle.background ? `<w:shd w:val="clear" w:fill="${cellStyle.background}"/>` : ''}<w:vAlign w:val="top"/></w:tcPr>${body || '<w:p/>'}${body.endsWith('</w:tbl>') ? '<w:p/>' : ''}</w:tc>`;
  }).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${Array.from({ length: columns }, () => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${content}</w:tbl>`;
}

export async function buildWordDocx(root: HTMLElement, font: string): Promise<Blob> {
  const body = blocks(root, font);
  const zip = new JSZip();
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const parts: Record<string, string> = {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/_rels/document.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>',
    'word/document.xml': `<w:document xmlns:w="${WORD_NS}" xmlns:m="${MATH_NS}"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    'word/styles.xml': `<w:styles xmlns:w="${WORD_NS}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${escapeXml(font)}" w:hAnsi="${escapeXml(font)}"/><w:sz w:val="26"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`,
    'word/settings.xml': `<w:settings xmlns:w="${WORD_NS}" xmlns:m="${MATH_NS}"><w:view w:val="print"/><w:zoom w:percent="100"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat><m:mathPr><m:mathFont m:val="Cambria Math"/><m:dispDef/></m:mathPr></w:settings>`,
  };
  for (const [name, content] of Object.entries(parts)) {
    parseXml(content);
    zip.file(name, declaration + content);
  }
  const bytes = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  return new Blob([bytes], { type: DOCX_MIME });
}

function plainText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  if (el.classList.contains('word-equation')) return el.getAttribute('data-display') === 'true' ? `\\[${el.getAttribute('data-latex')}\\]` : `\\(${el.getAttribute('data-latex')}\\)`;
  if (el.tagName === 'BR') return '\n';
  const text = Array.from(el.childNodes).map(plainText).join('');
  return text + (['TD', 'TH'].includes(el.tagName) ? '\t' : isBlock(el) ? '\n' : '');
}

export function buildWordClipboard(root: HTMLElement, font: string): { html: string; text: string } {
  // Run serializer validation for copy as well, so unsupported content is not
  // accepted by one path and silently lost by another.
  blocks(root, font);
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>('.word-equation').forEach(el => {
    const omml = officeEquation(el);
    const math = el.querySelector('math');
    if (!math) throw new Error('Công thức thiếu MathML cho clipboard.');
    const container = document.createElement(el.getAttribute('data-display') === 'true' ? 'div' : 'span');
    if (el.getAttribute('data-display') === 'true') container.style.textAlign = 'center';
    // Conditional comments keep Word's native math and other consumers' MathML
    // mutually exclusive. Neither branch contains an equation image.
    container.innerHTML = `<!--[if gte mso 12]>${omml}<![endif]--><!--[if !(gte mso 12)]><!-->${math.outerHTML}<!--<![endif]-->`;
    el.replaceWith(container);
  });
  return {
    html: `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="${WORD_NS}" xmlns:m="${MATH_NS}"><head><meta charset="utf-8"><style>body{font-family:'${escapeXml(font)}';font-size:13pt}p{margin:0 0 4pt}table{border-collapse:collapse}</style></head><body><!--StartFragment-->${clone.innerHTML}<!--EndFragment--></body></html>`,
    text: plainText(root).trimEnd(),
  };
}

export async function copyWordContent(payload: { html: string; text: string }): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([payload.html], { type: 'text/html' }),
        'text/plain': new Blob([payload.text], { type: 'text/plain' }),
      })]);
      return;
    } catch { /* Permission/support varies; try the synchronous copy event. */ }
  }
  const active = document.activeElement as HTMLElement | null;
  const selection = window.getSelection();
  const saved = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const temp = document.createElement('div');
  temp.contentEditable = 'true';
  temp.style.cssText = 'position:fixed;left:-10000px;top:0';
  temp.textContent = payload.text;
  let written = false;
  const listener = (event: ClipboardEvent) => {
    if (!event.clipboardData) return;
    event.preventDefault();
    event.clipboardData.setData('text/html', payload.html);
    event.clipboardData.setData('text/plain', payload.text);
    written = true;
  };
  try {
    if (!selection) throw new Error('No selection');
    document.body.appendChild(temp);
    temp.focus();
    const range = document.createRange();
    range.selectNodeContents(temp);
    selection.removeAllRanges();
    selection.addRange(range);
    document.addEventListener('copy', listener);
    if (!document.execCommand('copy') || !written) throw new Error('Clipboard rejected');
  } catch {
    throw new Error('Không thể sao chép công thức. Hãy tải file Word (.docx), mở trong Word rồi sao chép từ file đó.');
  } finally {
    document.removeEventListener('copy', listener);
    temp.remove();
    active?.focus({ preventScroll: true });
    selection?.removeAllRanges();
    saved.forEach(range => selection?.addRange(range));
  }
}

export async function downloadWordDocument(root: HTMLElement, font: string, filename: string): Promise<void> {
  const blob = await buildWordDocx(root, font);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Do not revoke before the browser has acquired the download resource.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
