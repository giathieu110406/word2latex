import katex from 'katex';
import JSZip from 'jszip';

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

/** Normalize KaTeX layout struts and text accents without merging arguments. */
function normalizeMath(math: Element): void {
  math.setAttribute('xmlns', MML_NS);
  math.querySelectorAll('annotation, annotation-xml').forEach(el => el.remove());
  // KaTeX encodes negative thin spacing as thin-space + invisible separator.
  // Treat it as negative spacing instead of emitting a visible positive space.
  for (const text of Array.from(math.querySelectorAll('mtext'))) {
    if (text.textContent === '\u2009\u2063') {
      const space = math.ownerDocument.createElementNS(MML_NS, 'mspace');
      space.setAttribute('width', '-0.1667em');
      text.replaceWith(space);
    }
  }
  for (const padding of Array.from(math.querySelectorAll('mpadded')).reverse()) {
    const attrs = Array.from(padding.attributes).map(attr => attr.name);
    const space = padding.firstElementChild;
    // KaTeX's \vdots includes an invisible zero-width strut to set browser
    // metrics. Word calculates matrix row metrics itself; the ⋮ token is a
    // separate sibling and must be retained.
    const dotsStrut = attrs.every(name => ['height', 'voffset'].includes(name)) &&
      padding.getAttribute('height') === '0em' && padding.getAttribute('voffset') === '0em' &&
      padding.children.length === 1 && space?.localName === 'mspace' &&
      space.getAttribute('width') === '0em' && space.getAttribute('height') === '1.5em' &&
      !space.children.length && !space.textContent;
    if (dotsStrut) { padding.remove(); continue; }
    // Extended-arrow labels have symmetric horizontal padding. Native Office
    // limit arguments provide centering; preserve the complete label group.
    const arrowLabel = attrs.every(name => ['width', 'lspace'].includes(name)) &&
      padding.getAttribute('width') === '+0.6em' && padding.getAttribute('lspace') === '0.3em' &&
      ['mover', 'munder', 'munderover'].includes(padding.parentElement?.localName || '');
    if (arrowLabel) {
      const group = math.ownerDocument.createElementNS(MML_NS, 'mrow');
      group.append(...Array.from(padding.childNodes));
      padding.replaceWith(group);
    }
  }
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
      // Group characters below a base must stay below it in native math.
      el.setAttribute('accentunder', 'false');
      if (base.localName !== 'mrow') {
        const row = math.ownerDocument.createElementNS(MML_NS, 'mrow');
        base.replaceWith(row);
        row.appendChild(base);
      }
    }
  }
  // Other padding/phantom layouts still fail explicitly rather than flattening.
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

const officeFont = (font: string) => font.split(',')[0].trim().replace(/^['"]|['"]$/g, '') || 'Times New Roman';

function naryBase(node: Element): Element | undefined {
  let base = node;
  if (['msub', 'msup', 'msubsup', 'munder', 'mover', 'munderover'].includes(node.localName)) base = node.children[0];
  while (['mrow', 'mstyle'].includes(base.localName) && base.children.length === 1) base = base.firstElementChild!;
  return base.localName === 'mo' && /^[∑∏∐∫∬∭∮∯∰⋀⋁⋂⋃]$/.test(base.textContent || '') && node.getAttribute('accent') !== 'true' && node.getAttribute('accentunder') !== 'true' ? base : undefined;
}

/** Convert presentation groups explicitly: Word requires growing delimiters,
 * valid math styles and a non-empty operand inside each n-ary operator. */
function officeMathNodes(nodes: Element[], variant = ''): string {
  let output = '';
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const kind = node.localName;
    const children = Array.from(node.children);
    const inherited = node.getAttribute('mathvariant') || variant;
    const convert = (el: Element | undefined) => el ? officeMathNodes([el], inherited) : '';
    const arg = (name: string, el: Element | undefined) => `<m:${name}>${convert(el)}</m:${name}>`;
    let base = node;
    if (['msub', 'msup', 'msubsup', 'munder', 'mover', 'munderover'].includes(kind)) base = children[0];
    while (['mrow', 'mstyle'].includes(base.localName) && base.children.length === 1) base = base.firstElementChild!;
    const nary = naryBase(node);
    if (nary) {
      const below = ['msub', 'msubsup', 'munder', 'munderover'].includes(kind) ? children[1] : undefined;
      const above = ['msup', 'mover'].includes(kind) ? children[1] : ['msubsup', 'munderover'].includes(kind) ? children[2] : undefined;
      // Presentation MathML gives operators and operands as siblings. Stop at
      // the next additive term or relation. Explicit mrow groups and
      // consecutive nested sums/integrals remain inside the operand.
      let end = i + 1;
      while (end < nodes.length) {
        const next = nodes[end], previous = nodes[end - 1];
        const unary = end === i + 1 || !!naryBase(previous) || (previous.localName === 'mo' && /^[+−×⋅/÷]$/.test(previous.textContent || ''));
        if (next.localName === 'mo' && (/^[=<>≤≥≠≈≡⇒⇔,;]$/.test(next.textContent || '') || (!unary && /^[+−±∓]$/.test(next.textContent || '')))) break;
        end++;
      }
      const body = officeMathNodes(nodes.slice(i + 1, end), variant) || mathRun('\u200b', 'normal');
      output += `<m:nary><m:naryPr><m:chr m:val="${escapeXml(base.textContent!)}"/><m:limLoc m:val="${['munder', 'mover', 'munderover'].includes(kind) ? 'undOvr' : 'subSup'}"/><m:grow m:val="1"/><m:subHide m:val="${below ? '0' : '1'}"/><m:supHide m:val="${above ? '0' : '1'}"/></m:naryPr>${arg('sub', below)}${arg('sup', above)}<m:e>${body}</m:e></m:nary>`;
      i = end - 1;
      continue;
    }
    switch (kind) {
      case 'math': case 'semantics': case 'mstyle': case 'mtd':
        output += officeMathNodes(children, inherited); break;
      case 'mrow': {
        const first = children[0], last = children.at(-1);
        const opening = first?.localName === 'mo' && first.getAttribute('fence') === 'true';
        const closing = last?.localName === 'mo' && last.getAttribute('fence') === 'true' && first !== last;
        if (opening || closing) {
          output += `<m:d><m:dPr><m:begChr m:val="${escapeXml(opening ? first.textContent || '' : '')}"/><m:endChr m:val="${escapeXml(closing ? last.textContent || '' : '')}"/><m:grow m:val="1"/></m:dPr><m:e>${officeMathNodes(children.slice(opening ? 1 : 0, closing ? -1 : undefined), inherited)}</m:e></m:d>`;
        } else output += officeMathNodes(children, inherited);
        break;
      }
      case 'mi': case 'mn': case 'mo': case 'mtext': case 'ms':
        output += mathRun(node.textContent || '', inherited || (kind === 'mi' && (node.textContent || '').length === 1 ? 'italic' : 'normal'), kind === 'mtext' || kind === 'ms'); break;
      case 'mspace': {
        const width = node.getAttribute('width') || '0em';
        if (!/^-?\d*\.?\d+em$/.test(width)) throw new Error(`Khoảng cách công thức chưa hỗ trợ: ${width}.`);
        const em = parseFloat(width);
        if (em < 0) output += mathRun('\u200b', 'normal', true).replace('</w:rPr>', `<w:spacing w:val="${Math.round(em * 260)}"/></w:rPr>`);
        else if (em >= 1) output += mathRun('\u2003'.repeat(Math.floor(em)) + (em % 1 ? '\u2009' : ''), 'normal', true);
        else if (em > 0) output += mathRun(em <= 0.17 ? '\u2006' : em <= 0.23 ? '\u205f' : em <= 0.28 ? '\u2005' : em <= 0.34 ? '\u2004' : '\u2002', 'normal', true);
        break;
      }
      case 'mfrac':
        output += `<m:f><m:fPr><m:type m:val="${/^0(?:px|em|pt)?$/.test(node.getAttribute('linethickness') || '') ? 'noBar' : 'bar'}"/></m:fPr>${arg('num', children[0])}${arg('den', children[1])}</m:f>`; break;
      case 'msqrt': case 'mroot':
        output += `<m:rad><m:radPr><m:degHide m:val="${kind === 'msqrt' ? '1' : '0'}"/></m:radPr><m:deg>${kind === 'mroot' ? convert(children[1]) : ''}</m:deg><m:e>${kind === 'msqrt' ? officeMathNodes(children, inherited) : convert(children[0])}</m:e></m:rad>`; break;
      case 'msub': case 'msup': case 'msubsup': {
        const type = kind === 'msub' ? 'sSub' : kind === 'msup' ? 'sSup' : 'sSubSup';
        output += `<m:${type}>${arg('e', children[0])}${kind !== 'msup' ? arg('sub', children[1]) : ''}${kind !== 'msub' ? arg('sup', children[kind === 'msubsup' ? 2 : 1]) : ''}</m:${type}>`; break;
      }
      case 'munder': case 'mover': case 'munderover': {
        const mark = children[1]?.textContent || '';
        const isUnder = kind === 'munder';
        const accent = node.getAttribute(isUnder ? 'accentunder' : 'accent') === 'true';
        const marks: Record<string, string> = { '→': '\u20d7', '←': '\u20d6', '↔': '\u20e1', '^': '\u0302', 'ˆ': '\u0302', '~': '\u0303', '˜': '\u0303', '˙': '\u0307', '¨': '\u0308' };
        if (!accent && base.localName === 'mo' && /^[←→↔⇌⇋⟵⟶⟷]$/.test(base.textContent || '')) {
          const above = kind !== 'munder';
          const label = children[kind === 'munderover' ? 2 : 1];
          let arrow = `<m:groupChr><m:groupChrPr><m:chr m:val="${escapeXml(base.textContent!)}"/><m:pos m:val="${above ? 'bot' : 'top'}"/><m:vertJc m:val="${above ? 'top' : 'bot'}"/></m:groupChrPr>${arg('e', label)}</m:groupChr>`;
          if (kind === 'munderover') arrow = `<m:limLow><m:e>${arrow}</m:e>${arg('lim', children[1])}</m:limLow>`;
          output += arrow;
        } else if (children[1]?.localName === 'mo' && ['¯', '‾', '_', '\u0332', '\u0305'].includes(mark)) {
          output += `<m:bar><m:barPr><m:pos m:val="${isUnder ? 'bot' : 'top'}"/></m:barPr>${arg('e', children[0])}</m:bar>`;
        } else if (accent && !isUnder && kind !== 'munderover' && !['⏞', '⏟'].includes(mark)) {
          output += `<m:acc><m:accPr><m:chr m:val="${escapeXml(marks[mark] || mark)}"/></m:accPr>${arg('e', children[0])}</m:acc>`;
        } else if (children[1]?.localName === 'mo' && ['⏞', '⏟'].includes(mark)) {
          output += `<m:groupChr><m:groupChrPr><m:chr m:val="${mark}"/><m:pos m:val="${isUnder ? 'bot' : 'top'}"/><m:vertJc m:val="${isUnder ? 'top' : 'bot'}"/></m:groupChrPr>${arg('e', children[0])}</m:groupChr>`;
        } else {
          let value = convert(children[0]);
          if (kind !== 'mover') value = `<m:limLow><m:e>${value}</m:e>${arg('lim', children[1])}</m:limLow>`;
          if (kind !== 'munder') value = `<m:limUpp><m:e>${value}</m:e>${arg('lim', children[kind === 'munderover' ? 2 : 1])}</m:limUpp>`;
          output += value;
        }
        break;
      }
      case 'mtable': {
        const columns = Math.max(1, ...children.map(row => row.children.length));
        const alignment = (node.getAttribute('columnalign') || 'center').split(/\s+/);
        const columnProps = Array.from({ length: columns }, (_, index) => `<m:mc><m:mcPr><m:count m:val="1"/><m:mcJc m:val="${['left', 'right'].includes(alignment[index] || alignment[0]) ? alignment[index] || alignment[0] : 'center'}"/></m:mcPr></m:mc>`).join('');
        output += `<m:m><m:mPr><m:baseJc m:val="center"/><m:plcHide m:val="1"/><m:mcs>${columnProps}</m:mcs></m:mPr>${children.map(row => `<m:mr>${Array.from({ length: columns }, (_, index) => `<m:e>${convert(row.children[index])}</m:e>`).join('')}</m:mr>`).join('')}</m:m>`; break;
      }
      case 'mmultiscripts': {
        let value = convert(children[0]);
        const pre = children.findIndex(el => el.localName === 'mprescripts');
        for (let index = 1; index < children.length; index += 2) {
          if (index === pre) index++;
          if (index >= children.length) break;
          const type = pre >= 0 && index > pre ? 'sPre' : 'sSubSup';
          const scripts = `${arg('sub', children[index])}${arg('sup', children[index + 1])}`;
          value = `<m:${type}>${type === 'sPre' ? scripts : ''}<m:e>${value}</m:e>${type !== 'sPre' ? scripts : ''}</m:${type}>`;
        }
        output += value; break;
      }
      case 'none': case 'mprescripts': break;
      case 'menclose': {
        const notation = node.getAttribute('notation') || 'box';
        const sides = ['Top', 'Bot', 'Left', 'Right'].map((side, index) => `<m:hide${side} m:val="${notation === 'box' || notation === ['top', 'bottom', 'left', 'right'][index] ? '0' : '1'}"/>`).join('');
        const strikes: Record<string, string> = { updiagonalstrike: 'strikeBLTR', downdiagonalstrike: 'strikeTLBR', verticalstrike: 'strikeV', horizontalstrike: 'strikeH' };
        output += `<m:borderBox><m:borderBoxPr>${sides}${strikes[notation] ? `<m:${strikes[notation]} m:val="1"/>` : ''}</m:borderBoxPr><m:e>${officeMathNodes(children, inherited)}</m:e></m:borderBox>`; break;
      }
      default: throw new Error(`Cấu trúc ${kind} chưa hỗ trợ Equation của Word.`);
    }
  }
  return output;
}

function mathRun(text: string, variant: string, normalText = false): string {
  const scripts: Record<string, string> = { 'double-struck': 'double-struck', 'script': 'script', 'bold-script': 'script', 'fraktur': 'fraktur', 'bold-fraktur': 'fraktur', 'sans-serif': 'sans-serif', 'sans-serif-bold': 'sans-serif', 'sans-serif-italic': 'sans-serif', 'sans-serif-bold-italic': 'sans-serif', 'monospace': 'monospace' };
  const bold = variant.includes('bold');
  const italic = variant.includes('italic');
  const style = bold ? italic ? 'bi' : 'b' : italic ? 'i' : 'p';
  return `<m:r><m:rPr>${normalText ? '<m:nor/>' : ''}${scripts[variant] ? `<m:scr m:val="${scripts[variant]}"/>` : ''}<m:sty m:val="${style}"/></m:rPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr><m:t xml:space="preserve">${escapeXml(text)}</m:t></m:r>`;
}

export function mathmlToOfficeMath(input: string): string {
  const container = document.createElement('div');
  container.innerHTML = input;
  const math = container.querySelector('math');
  if (!math) throw new Error('Không tìm thấy cấu trúc MathML của công thức.');
  normalizeMath(math);
  const result = `<m:oMath xmlns:m="${MATH_NS}" xmlns:w="${WORD_NS}">${officeMathNodes(Array.from(math.children))}</m:oMath>`;
  parseXml(result);
  return result;
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
  font = officeFont(font);
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
  font = officeFont(font);
  // Run serializer validation for copy as well, so unsupported content is not
  // accepted by one path and silently lost by another.
  blocks(root, font);
  const clone = root.cloneNode(true) as HTMLElement;
  let marker = 'WORD_EQUATION';
  while (clone.innerHTML.includes(marker)) marker += '_';
  const equations: string[] = [];
  clone.querySelectorAll<HTMLElement>('.word-equation').forEach(el => {
    const omml = officeEquation(el);
    // Word's HTML importer uses its legacy OMML namespace. Put one equation
    // directly in the fragment: browser/Word conditional-comment handling can
    // otherwise select the MathML fallback and flatten every formula.
    const htmlMath = omml.replaceAll(MATH_NS, 'http://schemas.microsoft.com/office/2004/12/omml');
    const content = el.getAttribute('data-display') === 'true' ? `<div style="text-align:center"><m:oMathPara>${htmlMath}</m:oMathPara></div>` : htmlMath;
    el.replaceWith(document.createComment(`${marker}_${equations.length}`));
    equations.push(content);
  });
  // HTML DOM serialization lowercases foreign prefixed tags. Insert the XML
  // after serializing the surrounding HTML so oMath/rPr names stay intact.
  const content = clone.innerHTML.replace(new RegExp(`<!--${marker}_(\\d+)-->`, 'g'), (_, index) => equations[Number(index)]);
  return {
    html: `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="${WORD_NS}" xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"><head><meta charset="utf-8"><style>body{font-family:'${escapeXml(font)}';font-size:13pt}p{margin:0 0 4pt}table{border-collapse:collapse}</style></head><body><!--StartFragment-->${content}<!--EndFragment--></body></html>`,
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
