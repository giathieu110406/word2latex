import katex from 'katex';
import { marked } from 'marked';
export interface ProtectedRange {
    start: number;
    end: number;
    kind: 'math' | 'code';
    display: boolean;
}
export function findProtectedRanges(text: string): ProtectedRange[] {
    const ranges: ProtectedRange[] = [];
    const escaped = (at: number) => { let n = 0; while (at > 0 && text[--at] === '\\')
        n++; return n % 2 === 1; };
    for (let i = 0; i < text.length; i++) {
        let end = -1, display = false;
        let kind: 'math' | 'code' = 'math';
        if (text[i] === '`' && !escaped(i)) {
            kind = 'code';
            const fence = text.slice(i).match(/^`+/)![0];
            const close = text.indexOf(fence, i + fence.length);
            if (close >= 0)
                end = close + fence.length;
        }
        else if (!escaped(i) && (text.startsWith('\\[', i) || text.startsWith('\\(', i))) {
            display = text[i + 1] === '[';
            const closing = display ? '\\]' : '\\)';
            let close = text.indexOf(closing, i + 2);
            while (close >= 0 && escaped(close))
                close = text.indexOf(closing, close + 2);
            if (close >= 0)
                end = close + 2;
        }
        else if (text[i] === '$' && !escaped(i)) {
            display = text[i + 1] === '$';
            const delimiter = display ? '$$' : '$';
            let close = text.indexOf(delimiter, i + delimiter.length);
            while (close >= 0 && (escaped(close) || (!display && text[close + 1] === '$')))
                close = text.indexOf(delimiter, close + (text[close + 1] === '$' ? 2 : 1));
            if (close >= 0 && (display || !/\n\s*\n/.test(text.slice(i, close))))
                end = close + delimiter.length;
        }
        else if (text.startsWith('\\begin{', i) && !escaped(i)) {
            const opening = text.slice(i).match(/^\\begin\{(equation|align|gather|multline|eqnarray|alignat|flalign|split|cases|aligned|alignedat|pmatrix|bmatrix|vmatrix|Bmatrix|Vmatrix|matrix|array|gathered)(\*?)\}/);
            if (opening) {
                display = true;
                const stack: string[] = [];
                const tokens = /\\(begin|end)\{([^}]+)\}/g;
                tokens.lastIndex = i;
                let token: RegExpExecArray | null;
                while ((token = tokens.exec(text))) {
                    if (escaped(token.index))
                        continue;
                    if (token[1] === 'begin')
                        stack.push(token[2]);
                    else if (stack.pop() !== token[2])
                        break;
                    if (!stack.length) {
                        end = tokens.lastIndex;
                        break;
                    }
                }
            }
        }
        if (end > i) {
            ranges.push({ start: i, end, kind, display });
            i = end - 1;
        }
    }
    return ranges;
}
export function maskProtectedContent(text: string) {
    const blocks: string[] = [];
    let masked = '', last = 0;
    let prefix = '@@@PROTECTED_CONTENT_';
    while (text.includes(prefix))
        prefix = '@' + prefix;
    for (const range of findProtectedRanges(text)) {
        masked += text.slice(last, range.start) + `${prefix}${blocks.length}@@@`;
        blocks.push(text.slice(range.start, range.end));
        last = range.end;
    }
    masked += text.slice(last);
    const restore = (value: string) => value.replace(new RegExp(prefix + '(\\d+)@@@', 'g'), (match, id) => blocks[+id] ?? match);
    return { masked, restore };
}
export function escHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
// Helper functions to protect URLs from being mangled by formatting or KaTeX regexes
interface ProtectedUrl {
    placeholder: string;
    original: string;
    isBare: boolean;
}
export function protectUrls(text: string): {
    protectedText: string;
    urls: ProtectedUrl[];
} {
    if (!text)
        return { protectedText: "", urls: [] };
    const urls: ProtectedUrl[] = [];
    const URL_RE = /https?:\/\/[^\s<>\"{}]+[^.,;:!?\s<>\"){}]/gi;
    let match;
    let lastIndex = 0;
    let protectedText = "";
    URL_RE.lastIndex = 0;
    while ((match = URL_RE.exec(text)) !== null) {
        const original = match[0];
        const index = match.index;
        const beforeStr = text.slice(Math.max(0, index - 10), index);
        const isBare = !beforeStr.endsWith("](") &&
            !beforeStr.includes("href=") &&
            !beforeStr.includes("src=") &&
            !beforeStr.endsWith("<");
        const placeholder = `@@@URL_PLACE_HOLDER_${urls.length}@@@`;
        urls.push({ placeholder, original, isBare });
        protectedText += text.slice(lastIndex, index) + placeholder;
        lastIndex = URL_RE.lastIndex;
    }
    protectedText += text.slice(lastIndex);
    return { protectedText, urls };
}
export function restoreUrls(text: string, urls: ProtectedUrl[], forceOriginal: boolean = false): string {
    let restored = text;
    for (const item of urls) {
        if (item.isBare && !forceOriginal) {
            // Convert bare URLs into Markdown links so marked can render them as clickable links
            restored = restored.replace(item.placeholder, `[${item.original}](${item.original})`);
        }
        else {
            // Restore as original for pre-existing markdown links, html, or if forced
            restored = restored.replace(item.placeholder, item.original);
        }
    }
    return restored;
}
// Smart formatting to fix run-on sentences or stuck equations, numbers, percentages, quotes, etc.
export function applySmartFormatting(text: string): string {
    if (!text)
        return "";
    // 1. Mask math blocks and code blocks first to protect them from being modified
    const protectedContent = maskProtectedContent(text);
    let protectedText = protectedContent.masked;
    const generated: string[] = [];
    const wrapMath = (math: string) => {
        const marker = `@@@GENERATED_MATH_${generated.length}@@@`;
        generated.push(math);
        return marker;
    };
    // 2. Original formatting rules:
    // - Nhận dạng in đậm thiếu dấu sao ở đầu: *Đáp án đúng:** -> **Đáp án đúng**
    protectedText = protectedText.replace(/(?<!\*)\*(?!\s)([^\*\n]+?)\*\*/g, '**$1**');
    // - Nhận dạng in nghiêng thiếu dấu sao ở đầu cho mục danh sách: * Nội dung*: -> * *Nội dung*:
    protectedText = protectedText.replace(/^(\s*\*\s+)([^\*\n]+?)\*(?!\*)/gm, '$1*$2*');
    // 3. AUTO-RECOGNIZE EXPONENTS (SUPERSCRIPTS) AND SUBSCRIPTS ON NORMAL LETTERS:
    // A. Unicode superscript characters on single letters (or simple variable names):
    // Superscript characters: ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ
    const supMap: {
        [key: string]: string;
    } = {
        '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', 'ⁿ': 'n'
    };
    protectedText = protectedText.replace(/([a-zA-Z])([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ]+)/g, (match, letter, sups) => {
        let power = '';
        for (let i = 0; i < sups.length; i++) {
            power += supMap[sups[i]] || sups[i];
        }
        const formattedPower = power.length > 1 ? `{${power}}` : power;
        return wrapMath(`$${letter}^${formattedPower}$`);
    });
    // B. Unicode subscript characters on single letters (or simple variable names):
    // Subscript characters: ₀₁₂₃₄₅₆₇₈₉₊₋ₐₑₒₓᵢⱼᵤᵥ
    const subMap: {
        [key: string]: string;
    } = {
        '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
        '₊': '+', '₋': '-', 'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x', 'ᵢ': 'i', 'ⱼ': 'j', 'ᵤ': 'u', 'ᵥ': 'v'
    };
    protectedText = protectedText.replace(/([a-zA-Z])([₀₁₂₃₄₅₆₇₈₉₊₋ₐₑₒₓᵢⱼᵤᵥ]+)/g, (match, letter, subs) => {
        let index = '';
        for (let i = 0; i < subs.length; i++) {
            index += subMap[subs[i]] || subs[i];
        }
        const formattedIndex = index.length > 1 ? `{${index}}` : index;
        return wrapMath(`$${letter}_${formattedIndex}$`);
    });
    // C. Plain text caret/underscore notation: e.g. x^2, x_1, y_n, a_{i+1}, a^x, etc.
    protectedText = protectedText.replace(/\b([a-zA-Z])\^([0-9a-zA-Z+\-]+|\{[^}]+\})/g, (match, letter, power) => {
        return wrapMath(`$${letter}^${power}$`);
    });
    protectedText = protectedText.replace(/\b([a-zA-Z])_([0-9a-zA-Z+\-]+|\{[^}]+\})/g, (match, letter, index) => {
        return wrapMath(`$${letter}_${index}$`);
    });
    // D. Very common plain combinations (single math letters followed immediately by a digit, e.g. x1, x2, y1, y2, u1, v2, a1, b2, c0...)
    // We strictly target typical math variables (x, y, z, t, u, v, a, b, c, s, n, m) to avoid false positives.
    protectedText = protectedText.replace(/\b([xyztuvabcnsm])([0-9])\b/gi, (match, letter, digit) => {
        return wrapMath(`$${letter}_${digit}$`);
    });
    return protectedContent.restore(protectedText).replace(/@@@GENERATED_MATH_(\d+)@@@/g, (match, id) => generated[+id] ?? match);
}
// Bộ lọc tối ưu hóa kiểm tra xem một cụm có thực sự là công thức toán học cần LaTeX không
// hay chỉ là các con số đơn lẻ, ngày tháng, phần trăm hoặc ký tự thông thường vô lý.
export function isRealMathLaTeX(str: string): boolean {
    // Always recognize inline math enclosed by $...$ as a math equation directly, with no error-correction blocks
    return str.trim().length > 0;
}
// Normalize LaTeX helper inside mathematical formulas for MS Word rendering and KaTeX compatibility
export function normalizeLaTeX(latex: string, isInline: boolean = false): string {
    // Do not perform automatic normalization/manipulation to preserve exact user latex formulas
    return latex;
}
const convertTabTableToMarkdownMasked = (text: string): string => {
    if (!text)
        return "";
    const lines = text.split("\n");
    const result: string[] = [];
    let inTable = false;
    let tableRows: string[][] = [];
    const renderCurrentTable = (rows: string[][]): string => {
        if (rows.length === 0)
            return "";
        const maxCols = Math.max(...rows.map((r) => r.length));
        if (maxCols < 2) {
            // If it has only 1 column, it is not a real table, return as plain text lines
            return rows.map((r) => r.join(" ")).join("\n");
        }
        const header = rows[0].map((c) => c || " ");
        while (header.length < maxCols)
            header.push(" ");
        const separator = Array(maxCols).fill("---");
        let md = "\n| " + header.join(" | ") + " |\n";
        md += "| " + separator.join(" | ") + " |\n";
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].map((c) => c || " ");
            while (row.length < maxCols)
                row.push(" ");
            md += "| " + row.join(" | ") + " |\n";
        }
        md += "\n";
        return md;
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const hasTabs = line.includes("\t");
        if (hasTabs) {
            inTable = true;
            const cols = line.split("\t").map((c) => c.trim());
            tableRows.push(cols);
        }
        else {
            if (inTable && tableRows.length > 0) {
                result.push(renderCurrentTable(tableRows));
                tableRows = [];
                inTable = false;
            }
            result.push(line);
        }
    }
    if (inTable && tableRows.length > 0) {
        result.push(renderCurrentTable(tableRows));
    }
    return result.join("\n");
};
export function renderLatexContent(text: string, smartNewline = true, promoteStandaloneMath = true): string {
    if (!text)
        return "";
    // Bước 1: Normalize input (NFC, loại bỏ BOM, chuẩn hoá smart quotes) - Dựa theo thuật toán từ tài liệu
    let normalizedInput = text;
    if (normalizedInput) {
        normalizedInput = normalizedInput
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/^\uFEFF/, "")
            .normalize("NFC")
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/\u2013/g, "--")
            .replace(/\u2014/g, "---")
            .replace(/\u2026/g, "...")
            .replace(/\u00A0/g, " ")
            .replace(/\u200B/g, "")
            .replace(/\u200C/g, "");
    }
    // Protect URLs from being mangled or broken by applySmartFormatting or KaTeX parsing
    const { protectedText, urls } = protectUrls(normalizedInput);
    let input = smartNewline ? applySmartFormatting(protectedText) : protectedText;
    const mathBlocks: string[] = [];
    let mdText = "";
    let lastIdx = 0;
    for (const range of findProtectedRanges(input).filter(r => r.kind === 'math')) {
        const m = { index: range.start, 0: input.slice(range.start, range.end) };
        if (m.index > lastIdx)
            mdText += input.slice(lastIdx, m.index);
        const raw = m[0];
        let isDisplay = raw.startsWith("$$") ||
            raw.startsWith("\\[") ||
            raw.startsWith("\\begin");
        // Tự động nâng cấp công thức đứng riêng một dòng thành Display Math
        if (promoteStandaloneMath && !isDisplay && raw.startsWith("$") && !raw.startsWith("$$")) {
            const textBefore = input.slice(0, m.index);
            const textAfter = input.slice(m.index + raw.length);
            const isStartOfLine = /(?:^|\n)[ \t]*$/.test(textBefore);
            const isEndOfLine = /^[ \t]*(?:\r?\n|$)/.test(textAfter);
            if (isStartOfLine && isEndOfLine) {
                isDisplay = true;
            }
        }
        let latex = "";
        if (raw.startsWith("$$"))
            latex = raw.slice(2, -2);
        else if (raw.startsWith("\\["))
            latex = raw.slice(2, -2);
        else if (raw.startsWith("\\("))
            latex = raw.slice(2, -2);
        else if (raw.startsWith("\\begin"))
            latex = raw; // KaTeX cần toàn bộ thẻ \begin...\end
        else
            latex = raw.slice(1, -1);
        // Nếu không phải là block math và là inline math bọc bởi dấu '$' đơn
        // đồng thời nội dung bên trong KHÔNG PHẢI là một công thức toán thực sự (ví dụ: chỉ là số 10, 20%, ngày tháng, bài toán...)
        if (!isDisplay && raw.startsWith("$") && !isRealMathLaTeX(latex)) {
            mdText += "$";
            lastIdx = m.index + 1;
            continue;
        }
        let mathHtml = "";
        try {
            let normalized = normalizeLaTeX(latex.trim(), !isDisplay);
            normalized = restoreUrls(normalized, urls, true);
            const rendered = katex.renderToString(normalized, {
                displayMode: isDisplay,
                output: "html",
                throwOnError: false,
                errorColor: "#f43f5e",
                strict: "ignore",
                trust: true,
            });
            const tag = "span";
            mathHtml = `<${tag} class="katex-custom-wrapper" data-latex="${escHtml(normalized)}" data-display="${isDisplay}" style="${isDisplay ? "display: block; text-align: center; margin: 0.8em 0;" : ""}">${rendered}</${tag}>`;
        }
        catch (e: any) {
            mathHtml = `<span style="color:#f43f5e" title="${escHtml(e.message || "Error")}">${escHtml(raw)}</span>`;
        }
        const blockIdx = mathBlocks.length;
        mathBlocks.push(mathHtml);
        if (isDisplay) {
            mdText += `\n\n@@@MATH_BLOCK_${blockIdx}@@@\n\n`;
        }
        else {
            mdText += `@@@MATH_BLOCK_${blockIdx}@@@`;
        }
        lastIdx = m.index + raw.length;
    }
    if (lastIdx < input.length) {
        mdText += input.slice(lastIdx);
    }
    if (smartNewline) {
        mdText = applySmartFormatting(mdText);
    }
    // Restore URLs with linkification for bare ones just before passing to marked.parse
    mdText = restoreUrls(mdText, urls, false);
    // Parse Markdown synchronously using marked with breaks and gfm enabled
    let htmlContent = "";
    try {
        htmlContent = marked.parse(mdText, { breaks: true, gfm: true }) as string;
    }
    catch {
        htmlContent = mdText;
    }
    // Ensure all links open in a new tab and are styled beautifully
    htmlContent = htmlContent.replace(/<a\s+href=/g, '<a target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline cursor-pointer font-medium" href=');
    // Khôi phục công thức khối và loại bỏ thẻ <p> bao ngoài nếu đứng riêng lẻ
    htmlContent = htmlContent.replace(/<p>(?:\s|<br\s*\/?>)*@@@MATH_BLOCK_(\d+)@@@(?:\s|<br\s*\/?>)*<\/p>/g, (match, idStr) => {
        const block = mathBlocks[+idStr] || "";
        const isDisplay = block.includes('data-display="true"');
        return isDisplay ? block : match;
    });
    // Replace equations back an toàn không tiêu thụ ký tự kế tiếp
    htmlContent = htmlContent.replace(/@@@MATH_BLOCK_(\d+)@@@/g, (match, idStr, offset, fullStr) => {
        const block = mathBlocks[+idStr] || "";
        if (!block)
            return "";
        const isDisplay = block.includes('data-display="true"');
        if (isDisplay)
            return block;
        const nextSlice = fullStr.slice(offset + match.length);
        const nextWordMatch = nextSlice.match(/^(?:[\s\u00a0\u200b]|&nbsp;)*([^.,;:!?\)\}\]”’"`\s<@])/);
        if (nextWordMatch && !nextSlice.startsWith(" ")) {
            return block + " ";
        }
        return block;
    });
    return htmlContent;
}
interface ParsedQuestion {
    questionBody: string;
    options: {
        label: string;
        text: string;
    }[];
}
function parseMultipleChoiceMasked(text: string): ParsedQuestion {
    if (!text)
        return { questionBody: "", options: [] };
    const lines = text.split("\n");
    const questionLines: string[] = [];
    const options: {
        label: string;
        text: string;
    }[] = [];
    const optionRegex = /^\s*([A-D])[\.\)\/]\s*(.*)$/;
    // Các dòng bắt đầu bằng đánh số danh sách, bullet, ký hiệu đặc biệt hoặc từ khóa đề mục
    const nonOptionContinuationRegex = /^\s*(?:\d+[\.\)\/\s-]|[\-\*•]|\b(?:Bài|Yêu cầu|Biết rằng|Ghi chú|Lưu ý|Chú ý|Đề số|Mã số|Thời gian)\b)/i;
    let currentOption: {
        label: string;
        text: string;
    } | null = null;
    const postQuestionLines: string[] = []; // Chứa các dòng không phải option nằm sau khi các option bắt đầu
    for (const line of lines) {
        const match = line.match(optionRegex);
        if (match) {
            if (currentOption) {
                options.push(currentOption);
            }
            currentOption = {
                label: match[1].toUpperCase(),
                text: match[2].trim(),
            };
        }
        else {
            if (currentOption) {
                // Nếu đã có option đang chạy, nhưng dòng hiện tại trống hoặc bắt đầu bằng số/bullet/từ khóa đề mục
                // thì ta ngắt option đó và coi dòng này thuộc về phần nội dung sau option (sẽ được nối vào questionBody)
                if (!line.trim() || nonOptionContinuationRegex.test(line)) {
                    options.push(currentOption);
                    currentOption = null;
                    postQuestionLines.push(line);
                }
                else {
                    // Ngược lại thì vẫn tiếp tục gộp vào option hiện tại
                    currentOption.text += "\n" + line.trim();
                }
            }
            else {
                if (options.length > 0) {
                    // Đã xong các option trước đó, dòng này là nội dung xuất hiện sau các option
                    postQuestionLines.push(line);
                }
                else {
                    // Chưa bắt đầu option nào, dòng này thuộc về đề bài
                    questionLines.push(line);
                }
            }
        }
    }
    if (currentOption) {
        options.push(currentOption);
    }
    let questionBody = questionLines.join("\n").trim();
    if (postQuestionLines.length > 0) {
        questionBody += "\n\n" + postQuestionLines.join("\n").trim();
    }
    if (options.length >= 2) {
        return {
            questionBody: questionBody.trim(),
            options,
        };
    }
    // If we couldn't parse 2 distinct options from separate lines, try inline parsing (e.g., A. $1$ B. $2$ C. $3$ D. $4$)
    const inlineRegex = /([A-D])[\.\)\/]\s*([\s\S]*?)(?=\s*[A-D][\.\)\/]|(?:\s*$))/g;
    const plainText = text;
    const firstOptionIdx = plainText.search(/\b[A-D][\.\)\/]/);
    if (firstOptionIdx !== -1) {
        const questionBodyInline = plainText.substring(0, firstOptionIdx).trim();
        const optionsPart = plainText.substring(firstOptionIdx);
        const foundOptions: {
            label: string;
            text: string;
        }[] = [];
        let m;
        while ((m = inlineRegex.exec(optionsPart)) !== null) {
            foundOptions.push({
                label: m[1].toUpperCase(),
                text: m[2].trim(),
            });
        }
        if (foundOptions.length >= 2) {
            return {
                questionBody: questionBodyInline,
                options: foundOptions,
            };
        }
    }
    return {
        questionBody: text.trim(),
        options: [],
    };
}
export function parseMultipleChoice(text: string): ParsedQuestion {
    const { masked, restore } = maskProtectedContent(text);
    const result = parseMultipleChoiceMasked(masked);
    return { questionBody: restore(result.questionBody), options: result.options.map(o => ({ label: o.label, text: restore(o.text) })) };
}
export function convertTabTableToMarkdown(text: string): string {
    const { masked, restore } = maskProtectedContent(text);
    return restore(convertTabTableToMarkdownMasked(masked));
}
