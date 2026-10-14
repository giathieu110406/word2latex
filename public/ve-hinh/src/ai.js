import { validateDocument } from './math.js';

export async function requestProposal(input) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75000);
  try {
    const fetchFn = window.parent.word2latexDrawingFetch || fetch;
    const response = await fetchFn('/api/ve-hinh?action=reconstruct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Provider không trả được bản dựng');
    if (!Array.isArray(data.uncertainties) || data.uncertainties.some(x => typeof x !== 'string') || typeof data.extractedText !== 'string') {
      throw Error('Bản đề xuất sai định dạng');
    }
    return {
      document: validateDocument(data.document),
      uncertainties: data.uncertainties,
      extractedText: data.extractedText
    };
  } catch (e) {
    if (e.name === 'AbortError') throw Error('AI quá thời gian chờ (75s); bản vẽ hiện tại được giữ nguyên');
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
