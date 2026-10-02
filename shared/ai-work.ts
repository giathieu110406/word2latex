export interface WorkStyle { offset: number; length: number; style: Record<string, unknown> }
export interface WorkBlock { id: string; tabId?: string; startIndex: number; text: string; styles?: WorkStyle[] }
export interface WorkEdit { blockId: string; after: string; restoreStyles?: WorkStyle[] }
export interface WorkProposal { summary: string; edits: WorkEdit[] }

export function extractBlocks(document: any): WorkBlock[] {
  const blocks: WorkBlock[] = [];
  const walk = (content: any[], tabId?: string) => {
    for (const item of content || []) {
      if (item.paragraph) {
        const elements = item.paragraph.elements || [];
        // Never delete equations, inline images or other non-text paragraph elements.
        if (!elements.length || elements.some((element: any) => !element.textRun || element.suggestedInsertionIds?.length || element.suggestedDeletionIds?.length || element.textRun.suggestedInsertionIds?.length || element.textRun.suggestedDeletionIds?.length || Object.keys(element.textRun.suggestedTextStyleChanges || {}).length)) continue;
        const text = elements.map((element: any) => element.textRun.content || '').join('').replace(/\n$/, '');
        const startIndex = elements[0].startIndex ?? item.startIndex;
        if (Number.isInteger(startIndex)) {
          let offset = 0;
          const styles = elements.map((element: any) => {
            const length = Math.min(element.textRun.content?.length || 0, text.length - offset);
            const run = { offset, length, style: element.textRun.textStyle || {} };
            offset += element.textRun.content?.length || 0;
            return run;
          }).filter((run: WorkStyle) => run.length > 0);
          blocks.push({ id: `${tabId || 'body'}:${startIndex}`, tabId, startIndex, text, styles });
        }
      }
      if (item.table) for (const row of item.table.tableRows || []) for (const cell of row.tableCells || []) walk(cell.content, tabId);
      if (item.tableOfContents) continue;
    }
  };
  const tabs = (items: any[]) => { for (const tab of items || []) { walk(tab.documentTab?.body?.content, tab.tabProperties?.tabId); tabs(tab.childTabs); } };
  if (document.tabs?.length) tabs(document.tabs); else walk(document.body?.content);
  return blocks;
}

export function validateProposal(raw: any, blocks: WorkBlock[]): WorkProposal {
  if (!raw || typeof raw.summary !== 'string' || raw.summary.length > 2000 || !Array.isArray(raw.edits) || raw.edits.length > 200) throw new Error('Đề xuất AI không đúng định dạng.');
  const seen = new Set<string>();
  const edits = raw.edits.map((edit: any) => {
    const block = blocks.find(block => block.id === edit?.blockId);
    if (!block || seen.has(block.id) || typeof edit.after !== 'string' || edit.after.length > 20000 || /[\r\n\u0000]/.test(edit.after) || edit.after === block.text) throw new Error('AI đề xuất đoạn không hợp lệ. Hãy tạo lại đề xuất.');
    seen.add(block.id);
    return { blockId: block.id, after: edit.after };
  });
  return { summary: raw.summary, edits };
}

// Docs indices are UTF-16 offsets, matching JS string offsets. Keep surrogate pairs intact.
export function textDifference(before: string, after: string) {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  if (prefix && /[\uD800-\uDBFF]/.test(before[prefix - 1])) prefix--;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  if (suffix && /[\uDC00-\uDFFF]/.test(before[before.length - suffix])) suffix--;
  return { prefix, suffix, removed: before.slice(prefix, before.length - suffix), inserted: after.slice(prefix, after.length - suffix) };
}

export function buildRequests(blocks: WorkBlock[], edits: WorkEdit[]): any[] {
  validateProposal({ summary: '', edits }, blocks);
  return [...edits].sort((a, b) => {
    const aa = blocks.find(block => block.id === a.blockId)!;
    const bb = blocks.find(block => block.id === b.blockId)!;
    return (aa.tabId || '').localeCompare(bb.tabId || '') || bb.startIndex - aa.startIndex;
  }).flatMap(edit => {
    const block = blocks.find(block => block.id === edit.blockId)!;
    const diff = textDifference(block.text, edit.after);
    const index = block.startIndex + diff.prefix;
    const tab = block.tabId ? { tabId: block.tabId } : {};
    const requests: any[] = [];
    const fields = ['bold','italic','underline','strikethrough','smallCaps','backgroundColor','foregroundColor','fontSize','weightedFontFamily','baselineOffset','link'];
    let replacementStyle: Record<string, unknown> | undefined;
    // A contiguous replacement can encompass unchanged styled text. Refuse it
    // rather than silently flattening bold text, links or other inline styles.
    if (!edit.restoreStyles && diff.removed) {
      const affected = (block.styles || []).filter(run => run.offset < diff.prefix + diff.removed.length && run.offset + run.length > diff.prefix);
      // const signatures = affected.map(run => JSON.stringify(Object.entries(run.style).sort(([a], [b]) => a.localeCompare(b))));
      // if (new Set(signatures).size > 1) throw new Error('Thay đổi đi qua nhiều định dạng trong cùng đoạn. Hãy yêu cầu AI sửa từng phần nhỏ để giữ nguyên định dạng.');
      replacementStyle = affected[0]?.style;
    }
    if (diff.removed) requests.push({ deleteContentRange: { range: { startIndex: index, endIndex: index + diff.removed.length, ...tab } } });
    if (diff.inserted) requests.push({ insertText: { location: { index, ...tab }, text: diff.inserted } });
    if (diff.inserted && replacementStyle) requests.push({ updateTextStyle: {
      range: { startIndex: index, endIndex: index + diff.inserted.length, ...tab },
      textStyle: Object.fromEntries(Object.entries(replacementStyle).filter(([key]) => fields.includes(key))), fields: fields.join(','),
    } });
    if (edit.restoreStyles) {
      for (const run of edit.restoreStyles) {
        if (run.length > 0) requests.push({ updateTextStyle: {
          range: { startIndex: block.startIndex + run.offset, endIndex: block.startIndex + run.offset + run.length, ...tab },
          textStyle: Object.fromEntries(Object.entries(run.style).filter(([key]) => fields.includes(key))), fields: fields.join(','),
        } });
      }
    }
    return requests;
  });
}

export function inverseEdits(blocks: WorkBlock[], edits: WorkEdit[]) {
  const nextBlocks = blocks.map(block => {
    const shift = edits.reduce((sum, edit) => {
      const other = blocks.find(item => item.id === edit.blockId)!;
      return sum + (other.tabId === block.tabId && other.startIndex < block.startIndex ? edit.after.length - other.text.length : 0);
    }, 0);
    return { ...block, startIndex: block.startIndex + shift, text: edits.find(edit => edit.blockId === block.id)?.after ?? block.text };
  });
  return { blocks: nextBlocks, edits: edits.map(edit => {
    const before = blocks.find(block => block.id === edit.blockId)!;
    return { blockId: edit.blockId, after: before.text, restoreStyles: before.styles };
  }) };
}
